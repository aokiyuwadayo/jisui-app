import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { hashToken, randomToken } from "./crypto";
import { requireUserId } from "./lib";

// MCP の認可（OAuth 2.1 + PKCE + 動的クライアント登録）。
// claude.ai のカスタムコネクタなど、トークンを直接貼れない連携先向け

const CODE_TTL_MS = 5 * 60_000;
export const ACCESS_TTL_MS = 60 * 60_000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60_000;
const TOUCH_INTERVAL_MS = 60_000;

const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "file:", "vbscript:", "blob:"]);

/** 登録を受け付けるリダイレクト先。https、ループバックの http、アプリ独自スキームのみ */
export function isAllowedRedirectUri(uri: string) {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (url.protocol === "https:") return true;
  if (url.protocol === "http:") return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return !BLOCKED_SCHEMES.has(url.protocol);
}

export const registerClient = internalMutation({
  args: { clientId: v.string(), name: v.string(), redirectUris: v.array(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.insert("oauthClients", { ...args, createdAt: Date.now() });
  },
});

/** 同意画面に出すクライアント情報。リダイレクト先が登録と一致しなければ null */
export const clientInfo = query({
  args: { clientId: v.string(), redirectUri: v.string() },
  handler: async (ctx, { clientId, redirectUri }) => {
    await requireUserId(ctx);
    const client = await ctx.db
      .query("oauthClients")
      .withIndex("by_client_id", (q) => q.eq("clientId", clientId))
      .unique();
    if (!client || !client.redirectUris.includes(redirectUri)) return null;
    return { name: client.name, redirectHost: new URL(redirectUri).host };
  },
});

/** 同意したら認可コードを発行する（乱数のためアクション） */
export const approve = action({
  args: { clientId: v.string(), redirectUri: v.string(), codeChallenge: v.string() },
  handler: async (ctx, args): Promise<string> => {
    const userId = await requireUserId(ctx);
    const code = randomToken("jsc_");
    await ctx.runMutation(internal.oauth.storeCode, {
      ...args,
      userId,
      codeHash: await hashToken(code),
    });
    return code;
  },
});

export const storeCode = internalMutation({
  args: {
    clientId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    userId: v.id("users"),
    codeHash: v.string(),
  },
  handler: async (ctx, args) => {
    const client = await ctx.db
      .query("oauthClients")
      .withIndex("by_client_id", (q) => q.eq("clientId", args.clientId))
      .unique();
    if (!client || !client.redirectUris.includes(args.redirectUri)) {
      throw new ConvexError("連携先の情報が正しくありません");
    }
    if (!/^[A-Za-z0-9_-]{43}$/.test(args.codeChallenge)) {
      throw new ConvexError("code_challenge が正しくありません");
    }
    await ctx.db.insert("oauthCodes", { ...args, expiresAt: Date.now() + CODE_TTL_MS });
  },
});

type GrantResult = { ok: true } | { ok: false; error: string; description: string };

/** 認可コードをトークンに交換する。PKCE の照合値は HTTP 側で計算して渡す */
export const exchangeCode = internalMutation({
  args: {
    codeHash: v.string(),
    clientId: v.string(),
    redirectUri: v.string(),
    verifierChallenge: v.string(),
    accessHash: v.string(),
    refreshHash: v.string(),
  },
  handler: async (ctx, args): Promise<GrantResult> => {
    const code = await ctx.db
      .query("oauthCodes")
      .withIndex("by_hash", (q) => q.eq("codeHash", args.codeHash))
      .unique();
    if (!code) return { ok: false, error: "invalid_grant", description: "認可コードが無効です" };
    // 失敗しても使い回しを防ぐため、まず消す
    await ctx.db.delete(code._id);
    if (
      code.expiresAt < Date.now() ||
      code.clientId !== args.clientId ||
      code.redirectUri !== args.redirectUri ||
      code.codeChallenge !== args.verifierChallenge
    ) {
      return { ok: false, error: "invalid_grant", description: "認可コードを確認できませんでした" };
    }
    const now = Date.now();
    await ctx.db.insert("oauthGrants", {
      userId: code.userId,
      clientId: code.clientId,
      accessHash: args.accessHash,
      accessExpiresAt: now + ACCESS_TTL_MS,
      refreshHash: args.refreshHash,
      refreshExpiresAt: now + REFRESH_TTL_MS,
      createdAt: now,
    });
    return { ok: true };
  },
});

/** リフレッシュトークンで新しい組に入れ替える（古いリフレッシュトークンは使えなくなる） */
export const refresh = internalMutation({
  args: {
    refreshHash: v.string(),
    clientId: v.string(),
    accessHash: v.string(),
    newRefreshHash: v.string(),
  },
  handler: async (ctx, args): Promise<GrantResult> => {
    const grant = await ctx.db
      .query("oauthGrants")
      .withIndex("by_refresh", (q) => q.eq("refreshHash", args.refreshHash))
      .unique();
    if (!grant || grant.clientId !== args.clientId || grant.refreshExpiresAt < Date.now()) {
      return { ok: false, error: "invalid_grant", description: "リフレッシュトークンが無効です" };
    }
    const now = Date.now();
    await ctx.db.patch(grant._id, {
      accessHash: args.accessHash,
      accessExpiresAt: now + ACCESS_TTL_MS,
      refreshHash: args.newRefreshHash,
      refreshExpiresAt: now + REFRESH_TTL_MS,
    });
    return { ok: true };
  },
});

/** アクセストークンからユーザーを特定する。無効・期限切れなら null */
export const authenticate = internalMutation({
  args: { accessHash: v.string() },
  handler: async (ctx, { accessHash }) => {
    const grant = await ctx.db
      .query("oauthGrants")
      .withIndex("by_access", (q) => q.eq("accessHash", accessHash))
      .unique();
    const now = Date.now();
    if (!grant || grant.accessExpiresAt < now) return null;
    if (!grant.lastUsedAt || now - grant.lastUsedAt > TOUCH_INTERVAL_MS) {
      await ctx.db.patch(grant._id, { lastUsedAt: now });
    }
    return grant.userId;
  },
});

/** 設定画面に出す「OAuth で接続中の連携先」 */
export const connections = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const grants = await ctx.db
      .query("oauthGrants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return Promise.all(
      grants.map(async (g) => {
        const client = await ctx.db
          .query("oauthClients")
          .withIndex("by_client_id", (q) => q.eq("clientId", g.clientId))
          .unique();
        return {
          _id: g._id,
          name: client?.name ?? "不明な連携先",
          createdAt: g.createdAt,
          lastUsedAt: g.lastUsedAt,
        };
      }),
    );
  },
});

export const disconnect = mutation({
  args: { id: v.id("oauthGrants") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const grant = await ctx.db.get(id);
    if (!grant || grant.userId !== userId) throw new ConvexError("接続が見つかりません");
    await ctx.db.delete(id);
  },
});

/** 期限切れの認可コードと接続を掃除する（cron から） */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    for (const code of await ctx.db.query("oauthCodes").collect()) {
      if (code.expiresAt < now) await ctx.db.delete(code._id);
    }
    for (const grant of await ctx.db.query("oauthGrants").collect()) {
      if (grant.refreshExpiresAt < now) await ctx.db.delete(grant._id);
    }
  },
});
