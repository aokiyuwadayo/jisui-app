import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { pkceChallenge } from "./crypto";
import { isAllowedRedirectUri } from "./oauth";
import { setup, signedIn } from "./test.setup";

const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const VERIFIER = "v".repeat(20) + "-verifier-for-pkce-0123456789";

type T = Awaited<ReturnType<typeof setup>>;

async function register(t: T) {
  const res = await t.fetch("/mcp-oauth/register", {
    method: "POST",
    body: JSON.stringify({ client_name: "Claude", redirect_uris: [REDIRECT] }),
  });
  return { status: res.status, body: await res.json() };
}

async function token(t: T, params: Record<string, string>) {
  const res = await t.fetch("/mcp-oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  return { status: res.status, body: await res.json() };
}

async function authorized(t: T) {
  const me = await signedIn(t);
  const { body: client } = await register(t);
  const code = await me.action(api.oauth.approve, {
    clientId: client.client_id,
    redirectUri: REDIRECT,
    codeChallenge: await pkceChallenge(VERIFIER),
  });
  return { me, clientId: client.client_id as string, code };
}

describe("OAuth（MCP の認可）", () => {
  it("メタデータと 401 の案内", async () => {
    const t = await setup();
    const res = await t.fetch("/mcp", { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("/.well-known/oauth-protected-resource");
    const as = await (await t.fetch("/.well-known/oauth-authorization-server")).json();
    expect(as.code_challenge_methods_supported).toEqual(["S256"]);
    expect(as.authorization_endpoint).toMatch(/\/connect\/authorize$/);
  });

  it("登録 → 同意 → コード交換 → MCP 呼び出し → 更新", async () => {
    const t = await setup();
    const { me, clientId, code } = await authorized(t);
    const issued = await token(t, {
      grant_type: "authorization_code",
      code,
      code_verifier: VERIFIER,
      redirect_uri: REDIRECT,
      client_id: clientId,
    });
    expect(issued.status).toBe(200);
    expect(issued.body.token_type).toBe("Bearer");

    const call = (access: string) =>
      t.fetch("/mcp", {
        method: "POST",
        headers: { Authorization: `Bearer ${access}` },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
    expect((await call(issued.body.access_token)).status).toBe(200);

    // 同じコードは二度使えない
    const again = await token(t, {
      grant_type: "authorization_code",
      code,
      code_verifier: VERIFIER,
      redirect_uri: REDIRECT,
      client_id: clientId,
    });
    expect(again.body.error).toBe("invalid_grant");

    const refreshed = await token(t, {
      grant_type: "refresh_token",
      refresh_token: issued.body.refresh_token,
      client_id: clientId,
    });
    expect(refreshed.status).toBe(200);
    expect((await call(issued.body.access_token)).status).toBe(401);
    expect((await call(refreshed.body.access_token)).status).toBe(200);
    // 古いリフレッシュトークンは使えない
    const stale = await token(t, {
      grant_type: "refresh_token",
      refresh_token: issued.body.refresh_token,
      client_id: clientId,
    });
    expect(stale.status).toBe(400);

    const [connection] = await me.query(api.oauth.connections);
    expect(connection?.name).toBe("Claude");
    if (!connection) throw new Error("no connection");
    await me.mutation(api.oauth.disconnect, { id: connection._id });
    expect((await call(refreshed.body.access_token)).status).toBe(401);
  });

  it("PKCE の検証値やリダイレクト先が違えば交換できない", async () => {
    const t = await setup();
    const { clientId, code } = await authorized(t);
    const wrong = await token(t, {
      grant_type: "authorization_code",
      code,
      code_verifier: "wrong-verifier-wrong-verifier-wrong-verifier",
      redirect_uri: REDIRECT,
      client_id: clientId,
    });
    expect(wrong.body.error).toBe("invalid_grant");
  });

  it("登録外のリダイレクト先には同意できない", async () => {
    const t = await setup();
    const me = await signedIn(t);
    const { body: client } = await register(t);
    expect(
      await me.query(api.oauth.clientInfo, { clientId: client.client_id, redirectUri: "https://evil.example/cb" }),
    ).toBeNull();
    await expect(
      me.action(api.oauth.approve, {
        clientId: client.client_id,
        redirectUri: "https://evil.example/cb",
        codeChallenge: await pkceChallenge(VERIFIER),
      }),
    ).rejects.toThrow();
  });

  it("リダイレクト先の形式を確認する", async () => {
    expect(isAllowedRedirectUri(REDIRECT)).toBe(true);
    expect(isAllowedRedirectUri("http://127.0.0.1:6274/callback")).toBe(true);
    expect(isAllowedRedirectUri("cursor://anysphere.cursor-mcp/oauth/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://example.com/cb")).toBe(false);
    expect(isAllowedRedirectUri("javascript:alert(1)")).toBe(false);
    const t = await setup();
    const res = await t.fetch("/mcp-oauth/register", {
      method: "POST",
      body: JSON.stringify({ redirect_uris: ["http://example.com/cb"] }),
    });
    expect(res.status).toBe(400);
  });
});
