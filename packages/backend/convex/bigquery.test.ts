// @vitest-environment node
import { generateKeyPairSync, createVerify } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { accessToken, BigQuery, TABLES } from "./bigquery";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const sa = {
  client_email: "export@example.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  project_id: "my-project",
};

function respond(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status });
}

describe("BigQuery への書き出し", () => {
  it("署名付き JWT でアクセストークンを取る", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const assertion = new URLSearchParams(String(init?.body)).get("assertion") ?? "";
      const [h, c, sig] = assertion.split(".");
      const ok = createVerify("RSA-SHA256")
        .update(`${h}.${c}`)
        .verify(publicKey, Buffer.from(sig ?? "", "base64url"));
      expect(ok).toBe(true);
      expect(JSON.parse(Buffer.from(c ?? "", "base64url").toString()).iss).toBe(sa.client_email);
      return respond(200, { access_token: "ya29.token" });
    });
    expect(await accessToken(sa, fetchMock as typeof fetch)).toBe("ya29.token");
  });

  it("なければデータセットとテーブルを作り、500 行ずつ書き込む", async () => {
    const calls: { method: string; url: string; body?: { rows?: unknown[] } }[] = [];
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method: init?.method ?? "GET", url: String(url), body });
      if (init?.method === "GET") return respond(404);
      return respond(200, {});
    });
    const bq = new BigQuery("t", "my-project", "jisui", "asia-northeast1", fetchMock as typeof fetch);
    await bq.ensure();
    const created = calls.filter((c) => c.method === "POST").map((c) => c.url.split("/v2")[1]);
    expect(created).toEqual([
      "/projects/my-project/datasets",
      "/projects/my-project/datasets/jisui/tables",
      "/projects/my-project/datasets/jisui/tables",
    ]);
    expect(Object.keys(TABLES)).toEqual(["events", "inventory_snapshots"]);

    calls.length = 0;
    const rows = Array.from({ length: 1200 }, (_, i) => ({ insertId: `e${i}`, json: { event_id: `e${i}` } }));
    await bq.insert("events", rows);
    expect(calls.map((c) => c.body?.rows?.length)).toEqual([500, 500, 200]);
  });

  it("insertErrors があれば失敗にする", async () => {
    const fetchMock = vi.fn(async () => respond(200, { insertErrors: [{ index: 0 }] }));
    const bq = new BigQuery("t", "p", "d", "l", fetchMock as typeof fetch);
    await expect(bq.insert("events", [{ insertId: "a", json: {} }])).rejects.toThrow();
  });
});
