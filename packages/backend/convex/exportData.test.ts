import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import { setup, signedIn } from "./test.setup";

const item = (name: string) => ({
  name,
  category: "vegetable" as const,
  storage: "fridge" as const,
  quantity: 1,
  unit: "個",
});

describe("まとめて追加", () => {
  it("レシートの読み取り結果をまとめて入れられ、操作ログも残る", async () => {
    const t = await setup();
    const me = await signedIn(t);
    await me.mutation(api.ingredients.createMany, { items: [item("にんじん"), item(" 大根 ")] });
    expect((await me.query(api.ingredients.list)).map((i) => i.name).sort()).toEqual(["にんじん", "大根"]);
    await expect(
      me.mutation(api.ingredients.createMany, { items: Array.from({ length: 101 }, () => item("x")) }),
    ).rejects.toThrow();
  });

  it("AI の鍵がなければ案内する", async () => {
    const t = await setup();
    const me = await signedIn(t);
    delete process.env.ANTHROPIC_API_KEY;
    await expect(
      me.action(api.ai.readReceipt, { imageBase64: "AAAA", mediaType: "image/jpeg" }),
    ).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe("BigQuery 用の読み出し", () => {
  it("書き出し済みの位置より後の操作ログだけを古い順に返す", async () => {
    const t = await setup();
    const me = await signedIn(t);
    await me.mutation(api.ingredients.createMany, { items: [item("a"), item("b"), item("c")] });
    const all = await t.query(internal.exportData.eventsBetween, { after: 0, until: Date.now(), limit: 10 });
    expect(all).toHaveLength(3);
    expect(JSON.parse(all[0]?.payload ?? "null")).toMatchObject({ name: "a" });

    const first = all[0];
    if (!first) throw new Error("no events");
    await t.mutation(internal.exportData.markExported, { exportedUntil: first.atMs });
    const state = await t.query(internal.exportData.state, {});
    const rest = await t.query(internal.exportData.eventsBetween, {
      after: state?.exportedUntil ?? 0,
      until: Date.now(),
      limit: 10,
    });
    expect(rest.length).toBeLessThan(3);

    const inventory = await t.query(internal.exportData.inventory, {});
    expect(inventory.map((i) => i.name).sort()).toEqual(["a", "b", "c"]);
  });
});
