import {
  adjustQuantity,
  compareByExpiry,
  validateIngredient,
} from "@jisui/core";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query, type QueryCtx } from "./_generated/server";
import { logEvent, requireUserId } from "./lib";
import { category, storage } from "./schema";

export const ingredientFields = {
  name: v.string(),
  category,
  storage,
  quantity: v.number(),
  unit: v.string(),
  expiresOn: v.optional(v.string()),
  purchasedOn: v.optional(v.string()),
  note: v.optional(v.string()),
};

function assertValid(input: Parameters<typeof validateIngredient>[0]) {
  const errors = validateIngredient(input);
  if (errors.length > 0) throw new ConvexError(errors.join("\n"));
}

/** 自分の食材だけを取得する。他人のものや存在しないものは例外 */
async function getOwned(ctx: QueryCtx, id: Id<"ingredients">) {
  const userId = await requireUserId(ctx);
  const item = await ctx.db.get(id);
  if (!item || item.userId !== userId) throw new ConvexError("食材が見つかりません");
  return { userId, item };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const items = await ctx.db
      .query("ingredients")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return items.sort(compareByExpiry);
  },
});

/** 過去に登録した食材（新しい順・名前で重複なし）。入力候補に使う */
export const history = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const events = await ctx.db
      .query("events")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .order("desc")
      .take(300);
    const seen = new Map<string, { name: string; category: string; storage: string; unit: string }>();
    for (const e of events) {
      if (e.type !== "ingredient_added") continue;
      const p = e.payload as { name: string; category: string; storage: string; unit: string };
      if (!seen.has(p.name)) {
        seen.set(p.name, { name: p.name, category: p.category, storage: p.storage, unit: p.unit });
      }
    }
    return [...seen.values()];
  },
});

export const create = mutation({
  args: ingredientFields,
  handler: async (ctx, args) => createIngredient(ctx, await requireUserId(ctx), args),
});

export const update = mutation({
  args: { id: v.id("ingredients"), ...ingredientFields },
  handler: async (ctx, { id, ...args }) => {
    const { userId } = await getOwned(ctx, id);
    const data = { ...args, name: args.name.trim() };
    assertValid(data);
    // optional を外したとき確実に消えるよう undefined も明示して置き換える
    await ctx.db.patch(id, {
      ...data,
      expiresOn: data.expiresOn,
      purchasedOn: data.purchasedOn,
      note: data.note,
      updatedAt: Date.now(),
    });
    await logEvent(ctx, userId, "ingredient_updated", id, data);
  },
});

/** まとめて追加する（レシートの読み取り結果など） */
export const createMany = mutation({
  args: { items: v.array(v.object(ingredientFields)) },
  handler: async (ctx, { items }) => {
    const userId = await requireUserId(ctx);
    if (items.length > 100) throw new ConvexError("一度に追加できるのは100件までです");
    const ids = [];
    for (const item of items) ids.push(await createIngredient(ctx, userId, item));
    return ids;
  },
});

/** 量を増減する（＋/− ボタン） */
export const adjust = mutation({
  args: { id: v.id("ingredients"), delta: v.number() },
  handler: async (ctx, { id, delta }) => {
    const { userId, item } = await getOwned(ctx, id);
    return setQuantity(ctx, userId, item, adjustQuantity(item.quantity, delta));
  },
});

/** 在庫から外す。使い切った（consumed）か捨てた（discarded）かを記録する */
export const remove = mutation({
  args: {
    id: v.id("ingredients"),
    reason: v.union(v.literal("consumed"), v.literal("discarded")),
  },
  handler: async (ctx, { id, reason }) => {
    const { userId, item } = await getOwned(ctx, id);
    await removeIngredient(ctx, userId, item, reason);
  },
});

// ここから下はアプリと外部連携（REST / MCP）で共通の処理

type IngredientData = Omit<Doc<"ingredients">, "_id" | "_creationTime" | "userId" | "updatedAt">;

export async function createIngredient(ctx: MutationCtx, userId: Id<"users">, args: IngredientData) {
  const data = { ...args, name: args.name.trim() };
  assertValid(data);
  const id = await ctx.db.insert("ingredients", { ...data, userId, updatedAt: Date.now() });
  await logEvent(ctx, userId, "ingredient_added", id, data);
  return id;
}

export async function setQuantity(
  ctx: MutationCtx,
  userId: Id<"users">,
  item: Doc<"ingredients">,
  quantity: number,
) {
  const next = adjustQuantity(quantity, 0);
  await ctx.db.patch(item._id, { quantity: next, updatedAt: Date.now() });
  await logEvent(ctx, userId, "ingredient_updated", item._id, {
    name: item.name,
    from: item.quantity,
    to: next,
    unit: item.unit,
  });
  return next;
}

/** 在庫から外す。使い切った（consumed）か捨てた（discarded）かを記録する */
export async function removeIngredient(
  ctx: MutationCtx,
  userId: Id<"users">,
  item: Doc<"ingredients">,
  reason: "consumed" | "discarded",
) {
  await ctx.db.delete(item._id);
  await logEvent(
    ctx,
    userId,
    reason === "consumed" ? "ingredient_consumed" : "ingredient_discarded",
    item._id,
    {
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      expiresOn: item.expiresOn,
    },
  );
}
