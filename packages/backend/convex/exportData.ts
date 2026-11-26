import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// BigQuery への日次バッチ用の読み出し。書き出し本体は bigquery.ts（Node）

const KEY = "bigquery";

export const state = internalQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("exportState")
      .withIndex("by_key", (q) => q.eq("key", KEY))
      .unique(),
});

/** after < at <= until の操作ログを古い順に最大 limit 件 */
export const eventsBetween = internalQuery({
  args: { after: v.number(), until: v.number(), limit: v.number() },
  handler: async (ctx, { after, until, limit }) => {
    const events = await ctx.db
      .query("events")
      .withIndex("by_at", (q) => q.gt("at", after).lte("at", until))
      .take(limit);
    return events.map((e) => ({
      event_id: e._id,
      user_id: e.userId,
      type: e.type,
      subject_id: e.subjectId ?? null,
      payload: JSON.stringify(e.payload ?? null),
      at: new Date(e.at).toISOString(),
      atMs: e.at,
    }));
  },
});

/** その日の在庫の写し（全ユーザー） */
export const inventory = internalQuery({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("ingredients").collect();
    return items.map((i) => ({
      user_id: i.userId,
      ingredient_id: i._id,
      name: i.name,
      category: i.category,
      storage: i.storage,
      quantity: i.quantity,
      unit: i.unit,
      expires_on: i.expiresOn ?? null,
      purchased_on: i.purchasedOn ?? null,
    }));
  },
});

export const markExported = internalMutation({
  args: { exportedUntil: v.number() },
  handler: async (ctx, { exportedUntil }) => {
    const current = await ctx.db
      .query("exportState")
      .withIndex("by_key", (q) => q.eq("key", KEY))
      .unique();
    const now = Date.now();
    if (current) await ctx.db.patch(current._id, { exportedUntil, lastRunAt: now });
    else await ctx.db.insert("exportState", { key: KEY, exportedUntil, lastRunAt: now });
  },
});
