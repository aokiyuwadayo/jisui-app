import {
  addDays,
  compareByExpiry,
  daysUntil,
  filterRecipes,
  nameKey,
  presetFor,
  rankRecipes,
  sameIngredient,
  todayInTokyo,
} from "@jisui/core";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { createIngredient, removeIngredient, setQuantity } from "./ingredients";
import { createRecipe, recipeFields } from "./recipes";
import { category, storage } from "./schema";

// 外部連携（REST / MCP）から呼ぶ内部関数。認証はトークンで済ませ、userId を受け取る

async function stockOf(ctx: QueryCtx, userId: Id<"users">) {
  const items = await ctx.db
    .query("ingredients")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return items.sort(compareByExpiry);
}

function present(item: Doc<"ingredients">, today: string) {
  return {
    id: item._id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    category: item.category,
    storage: item.storage,
    expiresOn: item.expiresOn ?? null,
    daysLeft: item.expiresOn ? daysUntil(item.expiresOn, today) : null,
    note: item.note ?? null,
  };
}

/** id か名前で在庫を1つ選ぶ。同名が複数あれば期限が近いものから使う */
async function resolveIngredient(ctx: QueryCtx, userId: Id<"users">, ref: string) {
  const id = ctx.db.normalizeId("ingredients", ref);
  if (id) {
    const item = await ctx.db.get(id);
    if (item && item.userId === userId) return item;
  }
  const stock = await stockOf(ctx, userId);
  const exact = stock.filter((s) => nameKey(s.name) === nameKey(ref));
  const hits = exact.length > 0 ? exact : stock.filter((s) => sameIngredient(s.name, ref));
  const [first] = hits;
  if (!first) throw new ConvexError(`在庫に「${ref}」が見つかりません`);
  return first;
}

export const listIngredients = internalQuery({
  args: {
    userId: v.id("users"),
    storage: v.optional(storage),
    category: v.optional(category),
    expiringWithinDays: v.optional(v.number()),
  },
  handler: async (ctx, { userId, storage, category, expiringWithinDays }) => {
    const today = todayInTokyo();
    return (await stockOf(ctx, userId))
      .filter((i) => !storage || i.storage === storage)
      .filter((i) => !category || i.category === category)
      .filter((i) => {
        if (expiringWithinDays === undefined) return true;
        const d = i.expiresOn ? daysUntil(i.expiresOn, today) : null;
        return d !== null && d <= expiringWithinDays;
      })
      .map((i) => present(i, today));
  },
});

export const addIngredient = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    category: v.optional(category),
    storage: v.optional(storage),
    expiresOn: v.optional(v.string()),
    purchasedOn: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { userId, ...args }) => {
    const today = todayInTokyo();
    // 分からない項目はプリセット（よく買う食材）から補う
    const preset = presetFor(args.name);
    const purchasedOn = args.purchasedOn ?? today;
    const expiresOn =
      args.expiresOn ??
      (preset?.shelfLifeDays ? (addDays(purchasedOn, preset.shelfLifeDays) ?? undefined) : undefined);
    const id = await createIngredient(ctx, userId, {
      name: args.name,
      quantity: args.quantity ?? 1,
      unit: args.unit ?? preset?.unit ?? "個",
      category: args.category ?? preset?.category ?? "other",
      storage: args.storage ?? preset?.storage ?? "fridge",
      expiresOn,
      purchasedOn,
      note: args.note,
    });
    const item = await ctx.db.get(id);
    return item && present(item, today);
  },
});

export const updateIngredient = internalMutation({
  args: {
    userId: v.id("users"),
    ingredient: v.string(),
    quantity: v.optional(v.number()),
    delta: v.optional(v.number()),
    expiresOn: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { userId, ingredient, quantity, delta, expiresOn }) => {
    const item = await resolveIngredient(ctx, userId, ingredient);
    if (quantity !== undefined || delta !== undefined) {
      await setQuantity(ctx, userId, item, quantity ?? item.quantity + (delta ?? 0));
    }
    if (expiresOn !== undefined) {
      await ctx.db.patch(item._id, { expiresOn: expiresOn ?? undefined, updatedAt: Date.now() });
    }
    const updated = await ctx.db.get(item._id);
    return updated && present(updated, todayInTokyo());
  },
});

export const removeIngredientByRef = internalMutation({
  args: {
    userId: v.id("users"),
    ingredient: v.string(),
    reason: v.union(v.literal("consumed"), v.literal("discarded")),
  },
  handler: async (ctx, { userId, ingredient, reason }) => {
    const item = await resolveIngredient(ctx, userId, ingredient);
    await removeIngredient(ctx, userId, item, reason);
    return { removed: item.name, reason };
  },
});

export const listRecipes = internalQuery({
  args: {
    userId: v.id("users"),
    query: v.optional(v.string()),
    favoriteOnly: v.optional(v.boolean()),
    maxMinutes: v.optional(v.number()),
  },
  handler: async (ctx, { userId, ...filter }) => {
    const recipes = await ctx.db
      .query("recipes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return filterRecipes(recipes, filter).map((r) => ({
      id: r._id,
      title: r.title,
      cookMinutes: r.cookMinutes ?? null,
      servings: r.servings ?? null,
      ingredients: r.ingredients,
      steps: r.steps,
      equipment: r.equipment,
      tags: r.tags,
      favorite: r.favorite,
      cookedCount: r.cookedCount,
      sourceUrl: r.sourceUrl ?? null,
    }));
  },
});

export const saveRecipe = internalMutation({
  args: { userId: v.id("users"), ...recipeFields },
  handler: async (ctx, { userId, ...args }) => {
    const id = await createRecipe(ctx, userId, args);
    return { id, title: args.title.trim() };
  },
});

export const suggestRecipes = internalQuery({
  args: { userId: v.id("users"), mustUse: v.optional(v.array(v.string())) },
  handler: async (ctx, { userId, mustUse = [] }) => {
    const [user, stock, recipes] = await Promise.all([
      ctx.db.get(userId),
      stockOf(ctx, userId),
      ctx.db
        .query("recipes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);
    return rankRecipes(recipes, stock, todayInTokyo(), user?.equipment)
      .filter((r) => r.match.missingEquipment.length === 0)
      .filter((r) => mustUse.every((name) => r.ingredients.some((i) => sameIngredient(i.name, name))))
      .slice(0, 10)
      .map((r) => ({
        id: r._id,
        title: r.title,
        cookMinutes: r.cookMinutes ?? null,
        canMakeNow: r.match.missing.length === 0,
        missing: r.match.missing,
        usesSoonExpiring: r.match.urgent,
      }));
  },
});
