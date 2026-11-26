"use node";

import { createSign } from "node:crypto";
import { todayInTokyo } from "@jisui/core";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

// 操作ログと在庫の写しを毎日 BigQuery に書き出す。
// 環境変数 GCP_SERVICE_ACCOUNT_JSON がなければ何もしない

type ServiceAccount = { client_email: string; private_key: string; project_id: string };

type Field = { name: string; type: string; mode?: "REQUIRED" | "NULLABLE" };

export const TABLES: Record<string, { fields: Field[]; partitionField: string }> = {
  events: {
    partitionField: "at",
    fields: [
      { name: "event_id", type: "STRING", mode: "REQUIRED" },
      { name: "user_id", type: "STRING", mode: "REQUIRED" },
      { name: "type", type: "STRING", mode: "REQUIRED" },
      { name: "subject_id", type: "STRING" },
      { name: "payload", type: "JSON" },
      { name: "at", type: "TIMESTAMP", mode: "REQUIRED" },
    ],
  },
  inventory_snapshots: {
    partitionField: "snapshot_date",
    fields: [
      { name: "snapshot_date", type: "DATE", mode: "REQUIRED" },
      { name: "user_id", type: "STRING", mode: "REQUIRED" },
      { name: "ingredient_id", type: "STRING", mode: "REQUIRED" },
      { name: "name", type: "STRING", mode: "REQUIRED" },
      { name: "category", type: "STRING" },
      { name: "storage", type: "STRING" },
      { name: "quantity", type: "FLOAT" },
      { name: "unit", type: "STRING" },
      { name: "expires_on", type: "DATE" },
      { name: "purchased_on", type: "DATE" },
    ],
  },
};

const API = "https://bigquery.googleapis.com/bigquery/v2";
const BATCH = 500;

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

/** サービスアカウントの鍵で署名した JWT をアクセストークンに交換する */
export async function accessToken(sa: ServiceAccount, fetchImpl: typeof fetch = fetch) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/bigquery",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(sa.private_key);
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${base64url(signature)}`,
    }),
  });
  if (!res.ok) throw new Error(`Google の認証に失敗しました（${res.status}）`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export class BigQuery {
  constructor(
    private token: string,
    private project: string,
    private dataset: string,
    private location: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async call(method: string, path: string, body?: unknown) {
    const res = await this.fetchImpl(`${API}/projects/${this.project}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return res;
  }

  /** データセットとテーブルがなければ作る */
  async ensure() {
    const ds = await this.call("GET", `/datasets/${this.dataset}`);
    if (ds.status === 404) {
      const created = await this.call("POST", "/datasets", {
        datasetReference: { projectId: this.project, datasetId: this.dataset },
        location: this.location,
      });
      if (!created.ok) throw new Error(`データセットを作れませんでした（${created.status}）`);
    } else if (!ds.ok) {
      throw new Error(`データセットを確認できませんでした（${ds.status}）`);
    }
    for (const [tableId, def] of Object.entries(TABLES)) {
      const table = await this.call("GET", `/datasets/${this.dataset}/tables/${tableId}`);
      if (table.status !== 404) continue;
      const created = await this.call("POST", `/datasets/${this.dataset}/tables`, {
        tableReference: { projectId: this.project, datasetId: this.dataset, tableId },
        schema: { fields: def.fields },
        timePartitioning: { type: "DAY", field: def.partitionField },
      });
      if (!created.ok) throw new Error(`テーブル ${tableId} を作れませんでした（${created.status}）`);
    }
  }

  /** insertId で同じ行の二重登録を防ぎながら書き込む */
  async insert(tableId: string, rows: { insertId: string; json: Record<string, unknown> }[]) {
    for (let i = 0; i < rows.length; i += BATCH) {
      const res = await this.call("POST", `/datasets/${this.dataset}/tables/${tableId}/insertAll`, {
        rows: rows.slice(i, i + BATCH),
      });
      const body = (await res.json()) as { insertErrors?: unknown[] };
      if (!res.ok || (body.insertErrors?.length ?? 0) > 0) {
        throw new Error(`${tableId} への書き込みに失敗しました: ${JSON.stringify(body).slice(0, 500)}`);
      }
    }
  }
}

export const run = internalAction({
  args: {},
  handler: async (ctx): Promise<string> => {
    const raw = process.env.GCP_SERVICE_ACCOUNT_JSON;
    if (!raw) return "GCP_SERVICE_ACCOUNT_JSON が未設定のため書き出しを省略";
    const sa = JSON.parse(raw) as ServiceAccount;
    const bq = new BigQuery(
      await accessToken(sa),
      process.env.BIGQUERY_PROJECT ?? sa.project_id,
      process.env.BIGQUERY_DATASET ?? "jisui",
      process.env.BIGQUERY_LOCATION ?? "asia-northeast1",
    );
    await bq.ensure();

    const until = Date.now();
    const state = await ctx.runQuery(internal.exportData.state, {});
    let after = state?.exportedUntil ?? 0;
    let exported = 0;
    for (;;) {
      const events = await ctx.runQuery(internal.exportData.eventsBetween, { after, until, limit: 1000 });
      if (events.length === 0) break;
      await bq.insert(
        "events",
        events.map(({ atMs: _, ...row }) => ({ insertId: row.event_id, json: row })),
      );
      exported += events.length;
      after = events[events.length - 1]?.atMs ?? until;
      // 途中で失敗しても、書けたところまでは次回やり直さない
      await ctx.runMutation(internal.exportData.markExported, { exportedUntil: after });
    }
    await ctx.runMutation(internal.exportData.markExported, { exportedUntil: until });

    const date = todayInTokyo();
    const inventory = await ctx.runQuery(internal.exportData.inventory, {});
    await bq.insert(
      "inventory_snapshots",
      inventory.map((row) => ({
        insertId: `${date}-${row.ingredient_id}`,
        json: { snapshot_date: date, ...row },
      })),
    );
    return `操作ログ ${exported} 件・在庫 ${inventory.length} 件を書き出し`;
  },
});
