import { parseRecipeFromHtml, validateRecipe } from "@jisui/core";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { Infer } from "convex/values";
import { action, type MutationCtx, mutation, query, type QueryCtx } from "./_generated/server";
import { logEvent, requireUserId } from "./lib";

export const recipeFields = {
  title: v.string(),
  sourceUrl: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  servings: v.optional(v.number()),
  cookMinutes: v.optional(v.number()),
  ingredients: v.array(
    v.object({ name: v.string(), amount: v.optional(v.string()), optional: v.optional(v.boolean()) }),
  ),
  steps: v.array(v.string()),
  equipment: v.array(v.string()),
  tags: v.array(v.string()),
};

type RecipeInput = {
  title: string;
  sourceUrl?: string;
  ingredients: { name: string; amount?: string; optional?: boolean }[];
  steps: string[];
  tags: string[];
  servings?: number;
  cookMinutes?: number;
};

/** 前後の空白・空行・重複タグを取り除き、検証する */
function normalize<T extends RecipeInput>(input: T): T {
  const data = {
    ...input,
    title: input.title.trim(),
    sourceUrl: input.sourceUrl?.trim() || undefined,
    ingredients: input.ingredients
      .map((i) => ({ ...i, name: i.name.trim(), amount: i.amount?.trim() || undefined }))
      .filter((i) => i.name),
    steps: input.steps.map((s) => s.trim()).filter(Boolean),
    tags: [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))],
  };
  const errors = validateRecipe(data);
  if (errors.length > 0) throw new ConvexError(errors.join("\n"));
  return data;
}

async function getOwned(ctx: QueryCtx, id: Id<"recipes">) {
  const userId = await requireUserId(ctx);
  const recipe = await ctx.db.get(id);
  if (!recipe || recipe.userId !== userId) throw new ConvexError("レシピが見つかりません");
  return { userId, recipe };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return ctx.db
      .query("recipes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("recipes") },
  handler: async (ctx, { id }) => (await getOwned(ctx, id)).recipe,
});

export const create = mutation({
  args: recipeFields,
  handler: async (ctx, args) => createRecipe(ctx, await requireUserId(ctx), args),
});

export const update = mutation({
  args: { id: v.id("recipes"), ...recipeFields },
  handler: async (ctx, { id, ...args }) => {
    await getOwned(ctx, id);
    const data = normalize(args);
    await ctx.db.patch(id, {
      ...data,
      sourceUrl: data.sourceUrl,
      imageUrl: data.imageUrl,
      servings: data.servings,
      cookMinutes: data.cookMinutes,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("recipes") },
  handler: async (ctx, { id }) => {
    await getOwned(ctx, id);
    await ctx.db.delete(id);
  },
});

export const toggleFavorite = mutation({
  args: { id: v.id("recipes") },
  handler: async (ctx, { id }) => {
    const { recipe } = await getOwned(ctx, id);
    await ctx.db.patch(id, { favorite: !recipe.favorite });
  },
});

/** 「作った」を記録する。将来の人気順・よく作る順の元データ */
export const markCooked = mutation({
  args: { id: v.id("recipes") },
  handler: async (ctx, { id }) => {
    const { userId, recipe } = await getOwned(ctx, id);
    const now = Date.now();
    await ctx.db.patch(id, { cookedCount: recipe.cookedCount + 1, lastCookedAt: now });
    await logEvent(ctx, userId, "recipe_cooked", id, { title: recipe.title });
  },
});

const recipeData = v.object(recipeFields);

export async function createRecipe(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: Infer<typeof recipeData>,
) {
  const data = normalize(args);
  const id = await ctx.db.insert("recipes", {
    ...data,
    userId,
    favorite: false,
    cookedCount: 0,
    updatedAt: Date.now(),
  });
  await logEvent(ctx, userId, "recipe_saved", id, { title: data.title, sourceUrl: data.sourceUrl });
  return id;
}

/** レシピページの URL から下書きを作る（保存はしない） */
export const importFromUrl = action({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
    await requireUserId(ctx);
    return fetchRecipeDraft(url);
  },
});

const MAX_HTML_BYTES = 3_000_000;

export async function fetchRecipeDraft(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new ConvexError("URLの形式が正しくありません");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ConvexError("http(s) のURLを入力してください");
  }

  let html: string;
  try {
    const res = await fetch(parsed, {
      headers: { "User-Agent": "Mozilla/5.0 (jisui recipe importer)", Accept: "text/html" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new ConvexError(`ページを開けませんでした（${res.status}）`);
    html = (await res.text()).slice(0, MAX_HTML_BYTES);
  } catch (e) {
    if (e instanceof ConvexError) throw e;
    throw new ConvexError("ページを開けませんでした");
  }

  const draft = parseRecipeFromHtml(html, parsed.toString());
  if (!draft) {
    throw new ConvexError("このページからレシピ情報を読み取れませんでした。手入力してください");
  }
  return draft;
}
