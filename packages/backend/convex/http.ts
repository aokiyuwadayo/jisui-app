import { httpRouter } from "convex/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, httpAction } from "./_generated/server";
import { findTool, inputSchema, runTool, TOOLS, ToolInputError } from "./agentTools";
import { hashToken, pkceChallenge, randomToken } from "./crypto";
import { ACCESS_TTL_MS, isAllowedRedirectUri } from "./oauth";

const http = httpRouter();

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

/** Authorization: Bearer <トークン> からユーザーを特定する。設定画面のトークンと OAuth の両方を受け付ける */
async function authenticate(ctx: ActionCtx, request: Request): Promise<Id<"users"> | null> {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("Authorization") ?? "");
  if (!match?.[1]) return null;
  const hash = await hashToken(match[1]);
  return (
    (await ctx.runMutation(internal.tokens.authenticate, { tokenHash: hash })) ??
    (await ctx.runMutation(internal.oauth.authenticate, { accessHash: hash }))
  );
}

const siteUrl = () => (process.env.CONVEX_SITE_URL ?? "").replace(/\/$/, "");

/** 同意画面のあるアプリの URL */
function appUrl() {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  return (process.env.ALLOWED_REDIRECT_ORIGINS ?? "http://localhost:3000").split(",")[0]?.trim() ?? "";
}

function errorMessage(e: unknown) {
  if (e instanceof ConvexError) return String(e.data);
  if (e instanceof ToolInputError) return e.message;
  console.error(e);
  return "処理に失敗しました";
}

const unauthorized = () =>
  json({ error: "トークンが無効です" }, 401, {
    // MCP クライアントはここから OAuth の情報をたどる
    "WWW-Authenticate": `Bearer realm="jisui", resource_metadata="${siteUrl()}/.well-known/oauth-protected-resource"`,
  });

// ---- REST API ----

http.route({
  path: "/api/v1/tools",
  method: "GET",
  handler: httpAction(async () =>
    json({
      tools: TOOLS.map((t) => ({
        name: t.name,
        title: t.title,
        description: t.description,
        readOnly: t.readOnly,
        inputSchema: inputSchema(t),
      })),
    }),
  ),
});

http.route({
  pathPrefix: "/api/v1/tools/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const userId = await authenticate(ctx, request);
    if (!userId) return unauthorized();
    const name = new URL(request.url).pathname.slice("/api/v1/tools/".length);
    const t = findTool(name);
    if (!t) return json({ error: `ツール「${name}」はありません` }, 404);
    let body: unknown = {};
    const text = await request.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        return json({ error: "JSON の形式が正しくありません" }, 400);
      }
    }
    try {
      return json({ result: await runTool(ctx, userId, t, body) });
    } catch (e) {
      return json({ error: errorMessage(e) }, 400);
    }
  }),
});

/** よく使う「在庫を見る」は GET でも呼べるようにする */
http.route({
  path: "/api/v1/ingredients",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const userId = await authenticate(ctx, request);
    if (!userId) return unauthorized();
    const t = findTool("list_ingredients");
    if (!t) throw new Error("list_ingredients がありません");
    const params = new URL(request.url).searchParams;
    const within = params.get("expiringWithinDays");
    try {
      const result = await runTool(ctx, userId, t, {
        storage: params.get("storage") ?? undefined,
        category: params.get("category") ?? undefined,
        expiringWithinDays: within ? Number(within) : undefined,
      });
      return json({ result });
    } catch (e) {
      return json({ error: errorMessage(e) }, 400);
    }
  }),
});

/** ChatGPT の GPT Actions などに読み込ませる OpenAPI 定義 */
http.route({
  path: "/api/v1/openapi.json",
  method: "GET",
  handler: httpAction(async () =>
    json({
      openapi: "3.1.0",
      info: {
        title: "jisui",
        version: "1.0.0",
        description: "自炊アプリの在庫とレシピを読み書きする API",
      },
      servers: [{ url: process.env.CONVEX_SITE_URL }],
      components: {
        securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
      },
      security: [{ bearer: [] }],
      paths: Object.fromEntries(
        TOOLS.map((t) => [
          `/api/v1/tools/${t.name}`,
          {
            post: {
              operationId: t.name,
              summary: t.title,
              description: t.description,
              requestBody: {
                required: true,
                content: { "application/json": { schema: inputSchema(t) } },
              },
              responses: { "200": { description: "成功。result に結果が入る" } },
            },
          },
        ]),
      ),
    }),
  ),
});

// ---- OAuth（MCP の認可） ----

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Protocol-Version",
};

function oauthError(error: string, description: string, status = 400) {
  return json({ error, error_description: description }, status, { ...CORS, "Cache-Control": "no-store" });
}

const protectedResource = httpAction(async () =>
  json(
    {
      resource: `${siteUrl()}/mcp`,
      authorization_servers: [siteUrl()],
      bearer_methods_supported: ["header"],
      resource_name: "jisui",
    },
    200,
    CORS,
  ),
);

for (const path of ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"]) {
  http.route({ path, method: "GET", handler: protectedResource });
}

http.route({
  path: "/.well-known/oauth-authorization-server",
  method: "GET",
  handler: httpAction(async () =>
    json(
      {
        issuer: siteUrl(),
        authorization_endpoint: `${appUrl()}/connect/authorize`,
        token_endpoint: `${siteUrl()}/mcp-oauth/token`,
        registration_endpoint: `${siteUrl()}/mcp-oauth/register`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
      },
      200,
      CORS,
    ),
  ),
});

/** 動的クライアント登録（RFC 7591）。公開クライアントのみ */
http.route({
  path: "/mcp-oauth/register",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: { redirect_uris?: unknown; client_name?: unknown };
    try {
      body = await request.json();
    } catch {
      return oauthError("invalid_client_metadata", "JSON の形式が正しくありません");
    }
    const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.map(String) : [];
    if (redirectUris.length === 0 || redirectUris.length > 10 || !redirectUris.every(isAllowedRedirectUri)) {
      return oauthError("invalid_redirect_uri", "redirect_uris が正しくありません");
    }
    const name = (typeof body.client_name === "string" ? body.client_name : "").trim().slice(0, 60) || "MCP クライアント";
    const clientId = randomToken("jsi_");
    await ctx.runMutation(internal.oauth.registerClient, { clientId, name, redirectUris });
    return json(
      {
        client_id: clientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: name,
        redirect_uris: redirectUris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      },
      201,
      CORS,
    );
  }),
});

http.route({
  path: "/mcp-oauth/token",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const form = new URLSearchParams(await request.text());
    const clientId = form.get("client_id") ?? "";
    const accessToken = randomToken("jsa_");
    const refreshToken = randomToken("jsr_");
    const [accessHash, refreshHash] = await Promise.all([hashToken(accessToken), hashToken(refreshToken)]);

    let result: { ok: true } | { ok: false; error: string; description: string };
    switch (form.get("grant_type")) {
      case "authorization_code": {
        const code = form.get("code");
        const verifier = form.get("code_verifier");
        if (!code || !verifier) return oauthError("invalid_request", "code と code_verifier が必要です");
        result = await ctx.runMutation(internal.oauth.exchangeCode, {
          codeHash: await hashToken(code),
          clientId,
          redirectUri: form.get("redirect_uri") ?? "",
          verifierChallenge: await pkceChallenge(verifier),
          accessHash,
          refreshHash,
        });
        break;
      }
      case "refresh_token": {
        const current = form.get("refresh_token");
        if (!current) return oauthError("invalid_request", "refresh_token が必要です");
        result = await ctx.runMutation(internal.oauth.refresh, {
          refreshHash: await hashToken(current),
          clientId,
          accessHash,
          newRefreshHash: refreshHash,
        });
        break;
      }
      default:
        return oauthError("unsupported_grant_type", "対応していない grant_type です");
    }
    if (!result.ok) return oauthError(result.error, result.description);
    return json(
      {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: ACCESS_TTL_MS / 1000,
        refresh_token: refreshToken,
      },
      200,
      { ...CORS, "Cache-Control": "no-store" },
    );
  }),
});

for (const path of [
  "/.well-known/oauth-protected-resource",
  "/.well-known/oauth-protected-resource/mcp",
  "/.well-known/oauth-authorization-server",
  "/mcp-oauth/register",
  "/mcp-oauth/token",
  "/mcp",
]) {
  http.route({
    path,
    method: "OPTIONS",
    handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })),
  });
}

// ---- MCP（Streamable HTTP。状態を持たず、毎回 JSON で返す） ----

const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];

type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: unknown };

const rpcResult = (id: RpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id: RpcRequest["id"], code: number, message: string) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});

async function handleRpc(ctx: ActionCtx, userId: Id<"users">, req: RpcRequest) {
  const params = (req.params ?? {}) as Record<string, unknown>;
  switch (req.method) {
    case "initialize": {
      const requested = String(params.protocolVersion ?? "");
      return rpcResult(req.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "jisui", title: "jisui 自炊アプリ", version: "1.0.0" },
        instructions:
          "ユーザーの冷蔵庫の在庫とレシピブックを扱う。食材を買った・使った・捨てたと聞いたら在庫を更新し、献立の相談では list_ingredients と suggest_recipes を使う。",
      });
    }
    case "ping":
      return rpcResult(req.id, {});
    case "tools/list":
      return rpcResult(req.id, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: inputSchema(t),
          annotations: { readOnlyHint: t.readOnly, destructiveHint: t.name === "remove_ingredient" },
        })),
      });
    case "tools/call": {
      const t = findTool(String(params.name ?? ""));
      if (!t) return rpcError(req.id, -32602, `ツール「${String(params.name)}」はありません`);
      try {
        const result = await runTool(ctx, userId, t, params.arguments);
        return rpcResult(req.id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: { result },
        });
      } catch (e) {
        // ツールの失敗は isError で返し、AI が読み直せるようにする
        return rpcResult(req.id, { content: [{ type: "text", text: errorMessage(e) }], isError: true });
      }
    }
    default:
      return rpcError(req.id, -32601, `未対応のメソッドです: ${req.method}`);
  }
}

http.route({
  path: "/mcp",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const userId = await authenticate(ctx, request);
    if (!userId) return unauthorized();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json(rpcError(null, -32700, "JSON の形式が正しくありません"), 400);
    }
    const batch = Array.isArray(body);
    const requests = (batch ? body : [body]) as RpcRequest[];
    const responses = [];
    for (const req of requests) {
      if (typeof req?.method !== "string") {
        responses.push(rpcError(req?.id, -32600, "不正なリクエストです"));
        continue;
      }
      // id のないもの（通知）には返事をしない
      if (req.id === undefined) continue;
      responses.push(await handleRpc(ctx, userId, req));
    }
    if (responses.length === 0) return new Response(null, { status: 202 });
    return json(batch ? responses : responses[0]);
  }),
});

// 状態を持たないので、サーバーからの通知用ストリーム（GET）は提供しない
http.route({
  path: "/mcp",
  method: "GET",
  handler: httpAction(async () => new Response(null, { status: 405, headers: { Allow: "POST" } })),
});

export default http;
