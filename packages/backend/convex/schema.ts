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

  /** 外部連携（Muse・Claude・ChatGPT など）用のアクセストークン。平文は保存しない */
  apiTokens: defineTable({
    userId: v.id("users"),
    name: v.string(),
    /** SHA-256（16進） */
    tokenHash: v.string(),
    /** 一覧で見分けるための末尾4文字 */
    hint: v.string(),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_hash", ["tokenHash"]),

  /** MCP の OAuth で動的登録されたクライアント（Claude・ChatGPT など） */
  oauthClients: defineTable({
    clientId: v.string(),
    name: v.string(),
    redirectUris: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_client_id", ["clientId"]),

  /** 認可コード。5分で失効し、一度使うと消す */
  oauthCodes: defineTable({
    codeHash: v.string(),
    clientId: v.string(),
    userId: v.id("users"),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    expiresAt: v.number(),
  }).index("by_hash", ["codeHash"]),

  /** OAuth で発行したアクセストークンとリフレッシュトークン（ハッシュのみ） */
  oauthGrants: defineTable({
    userId: v.id("users"),
    clientId: v.string(),
    accessHash: v.string(),
    accessExpiresAt: v.number(),
    refreshHash: v.string(),
    refreshExpiresAt: v.number(),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_access", ["accessHash"])
    .index("by_refresh", ["refreshHash"]),

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
