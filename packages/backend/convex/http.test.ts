import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { setup, signedIn } from "./test.setup";

async function withToken() {
  const t = await setup();
  const me = await signedIn(t);
  const token = await me.action(api.tokens.create, { name: "Muse" });
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  return { t, me, token, auth };
}

async function rpc(t: Awaited<ReturnType<typeof setup>>, auth: Record<string, string>, body: unknown) {
  const res = await t.fetch("/mcp", { method: "POST", headers: auth, body: JSON.stringify(body) });
  return { status: res.status, body: res.status === 202 ? null : await res.json() };
}

describe("トークン", () => {
  it("平文は保存せず、一覧には末尾だけ出す。削除すると使えなくなる", async () => {
    const { t, me, token, auth } = await withToken();
    expect(token).toMatch(/^jsk_[0-9a-f]{64}$/);
    const [listed] = await me.query(api.tokens.list);
    expect(listed).toMatchObject({ name: "Muse", hint: token.slice(-4) });
    const stored = await t.run((ctx) => ctx.db.query("apiTokens").first());
    expect(JSON.stringify(stored)).not.toContain(token);

    expect((await t.fetch("/api/v1/ingredients", { headers: auth })).status).toBe(200);
    if (!listed) throw new Error("no token");
    await me.mutation(api.tokens.revoke, { id: listed._id });
    expect((await t.fetch("/api/v1/ingredients", { headers: auth })).status).toBe(401);
  });

  it("他人のトークンは削除できない", async () => {
    const { t, me } = await withToken();
    const other = await signedIn(t, "other@example.com");
    const [listed] = await me.query(api.tokens.list);
    if (!listed) throw new Error("no token");
    await expect(other.mutation(api.tokens.revoke, { id: listed._id })).rejects.toThrow();
  });
});

describe("REST API", () => {
  it("トークンなしは 401", async () => {
    const t = await setup();
    expect((await t.fetch("/api/v1/tools/list_ingredients", { method: "POST" })).status).toBe(401);
  });

  it("追加・使用・一覧・使い切りができ、プリセットで既定値を補う", async () => {
    const { t, auth } = await withToken();
    const call = async (name: string, body: unknown) => {
      const res = await t.fetch(`/api/v1/tools/${name}`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify(body),
      });
      return { status: res.status, body: await res.json() };
    };

    const added = await call("add_ingredient", { name: "キャベツ" });
    expect(added.body.result).toMatchObject({ name: "キャベツ", unit: "玉", storage: "fridge", quantity: 1 });
    expect(added.body.result.expiresOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await call("add_ingredient", { name: "卵", quantity: 6, unit: "個", expiresOn: "2026-12-10" });
    expect((await call("update_ingredient", { ingredient: "たまご", delta: -2 })).body.result.quantity).toBe(4);

    const listed = await (await t.fetch("/api/v1/ingredients?storage=fridge", { headers: auth })).json();
    expect(listed.result.map((i: { name: string }) => i.name).sort()).toEqual(["キャベツ", "卵"]);

    expect((await call("remove_ingredient", { ingredient: "卵", reason: "consumed" })).body.result).toEqual({
      removed: "卵",
      reason: "consumed",
    });
    expect((await call("remove_ingredient", { ingredient: "卵", reason: "consumed" })).status).toBe(400);
    expect((await call("add_ingredient", { quantity: 1 })).status).toBe(400);
    expect((await call("no_such_tool", {})).status).toBe(404);
  });

  it("OpenAPI にツールが並ぶ", async () => {
    const t = await setup();
    const spec = await (await t.fetch("/api/v1/openapi.json")).json();
    expect(Object.keys(spec.paths)).toContain("/api/v1/tools/save_recipe_from_url");
  });
});

describe("MCP", () => {
  it("初期化・ツール一覧・呼び出し・通知", async () => {
    const { t, auth } = await withToken();
    const init = await rpc(t, auth, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } },
    });
    expect(init.body.result.protocolVersion).toBe("2025-06-18");
    expect((await rpc(t, auth, { jsonrpc: "2.0", method: "notifications/initialized" })).status).toBe(202);

    const tools = await rpc(t, auth, { jsonrpc: "2.0", id: 2, method: "tools/list" });
    const names = tools.body.result.tools.map((x: { name: string }) => x.name);
    expect(names).toContain("suggest_recipes");
    expect(tools.body.result.tools[0].inputSchema.type).toBe("object");

    await rpc(t, auth, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "save_recipe",
        arguments: { title: "卵かけご飯", ingredients: [{ name: "卵" }, { name: "ご飯" }], steps: ["混ぜる"] },
      },
    });
    await rpc(t, auth, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "add_ingredient", arguments: { name: "卵", quantity: 2 } },
    });
    const suggested = await rpc(t, auth, {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "suggest_recipes", arguments: {} },
    });
    expect(suggested.body.result.structuredContent.result[0]).toMatchObject({
      title: "卵かけご飯",
      canMakeNow: false,
      missing: ["ご飯"],
    });

    const failed = await rpc(t, auth, {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "update_ingredient", arguments: { ingredient: "牛乳", delta: 1 } },
    });
    expect(failed.body.result.isError).toBe(true);
    expect(failed.body.result.content[0].text).toContain("牛乳");
  });

  it("トークンなしは 401、他人の在庫は見えない", async () => {
    const { t, me, auth } = await withToken();
    expect((await rpc(t, {}, { jsonrpc: "2.0", id: 1, method: "tools/list" })).status).toBe(401);
    await me.mutation(api.ingredients.create, {
      name: "鮭",
      category: "fish",
      storage: "fridge",
      quantity: 1,
      unit: "枚",
    });
    const other = await signedIn(t, "other@example.com");
    const otherToken = await other.action(api.tokens.create, { name: "x" });
    const res = await rpc(
      t,
      { ...auth, Authorization: `Bearer ${otherToken}` },
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_ingredients", arguments: {} } },
    );
    expect(res.body.result.structuredContent.result).toEqual([]);
  });
});
