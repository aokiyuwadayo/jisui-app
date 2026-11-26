import { defineSchema, defineTable } from "convex/server";
import { CATEGORIES, STORAGES } from "@jisui/core";
import { v } from "convex/values";

export const storage = v.union(...STORAGES.map((s) => v.literal(s)));

export const category = v.union(...CATEGORIES.map((c) => v.literal(c)));

export const eventType = v.union(
  v.literal("ingredient_added"),
  v.literal("ingredient_updated"),
  v.literal("ingredient_consumed"),
  v.literal("ingredient_discarded"),
  v.literal("recipe_saved"),
  v.literal("recipe_cooked"),
);

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    /** 持っている器具。未設定なら提案で器具を問わない */
    equipment: v.optional(v.array(v.string())),
  }).index("by_email", ["email"]),

  /** 食材・調味料の在庫 */
  ingredients: defineTable({
    userId: v.id("users"),
    name: v.string(),
    category,
    storage,
    quantity: v.number(),
    unit: v.string(),
    /** YYYY-MM-DD（日本時間） */
    expiresOn: v.optional(v.string()),
    purchasedOn: v.optional(v.string()),
    note: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_expires", ["userId", "expiresOn"]),

  /** レシピブック */
  recipes: defineTable({
    userId: v.id("users"),
    title: v.string(),
    sourceUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    servings: v.optional(v.number()),
    cookMinutes: v.optional(v.number()),
    ingredients: v.array(
      v.object({
        name: v.string(),
        amount: v.optional(v.string()),
        optional: v.optional(v.boolean()),
      }),
    ),
    steps: v.array(v.string()),
    /** 使う器具（フライパン・電子レンジなど） */
    equipment: v.array(v.string()),
    tags: v.array(v.string()),
    favorite: v.boolean(),
    cookedCount: v.number(),
    lastCookedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  /** 操作ログ。BigQuery への日次バッチの元データ */
  events: defineTable({
    userId: v.id("users"),
    type: eventType,
    subjectId: v.optional(v.string()),
    payload: v.any(),
    at: v.number(),
  })
    .index("by_user_at", ["userId", "at"])
    .index("by_at", ["at"]),
});
