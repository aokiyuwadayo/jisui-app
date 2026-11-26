import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { hashToken, randomToken } from "./crypto";
import { requireUserId } from "./lib";

const PREFIX = "jsk_";
const MAX_TOKENS = 10;
/** 最終利用日時の更新は1分に1回まで（毎リクエスト書き込まない） */
const TOUCH_INTERVAL_MS = 60_000;

/** トークンを発行する。平文はこの戻り値でしか見られない */
export const create = action({
  args: { name: v.string() },
  handler: async (ctx, { name }): Promise<string> => {
    const userId = await requireUserId(ctx);
    const token = randomToken(PREFIX);
    await ctx.runMutation(internal.tokens.insert, {
      userId,
      name: name.trim().slice(0, 40) || "連携",
      tokenHash: await hashToken(token),
      hint: token.slice(-4),
    });
    return token;
  },
});

export const insert = internalMutation({
  args: { userId: v.id("users"), name: v.string(), tokenHash: v.string(), hint: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("apiTokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    if (existing.length >= MAX_TOKENS) {
      throw new ConvexError(`トークンは${MAX_TOKENS}個までです。使わないものを削除してください`);
    }
    await ctx.db.insert("apiTokens", { ...args, createdAt: Date.now() });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const tokens = await ctx.db
      .query("apiTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return tokens.map(({ _id, name, hint, createdAt, lastUsedAt }) => ({
      _id,
      name,
      hint,
      createdAt,
      lastUsedAt,
    }));
  },
});

export const revoke = mutation({
  args: { id: v.id("apiTokens") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const token = await ctx.db.get(id);
    if (!token || token.userId !== userId) throw new ConvexError("トークンが見つかりません");
    await ctx.db.delete(id);
  },
});

/** トークンからユーザーを特定する。無効なら null */
export const authenticate = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const token = await ctx.db
      .query("apiTokens")
      .withIndex("by_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!token) return null;
    const now = Date.now();
    if (!token.lastUsedAt || now - token.lastUsedAt > TOUCH_INTERVAL_MS) {
      await ctx.db.patch(token._id, { lastUsedAt: now });
    }
    return token.userId;
  },
});
