import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { setup, signedIn } from "./test.setup";

const egg = {
  name: " 卵 ",
  category: "egg" as const,
  storage: "fridge" as const,
  quantity: 6,
  unit: "個",
  expiresOn: "2026-12-05",
};

describe("ingredients", () => {
  it("未ログインでは一覧を取れない", async () => {
    const t = await setup();
    await expect(t.query(api.ingredients.list)).rejects.toThrow();
  });

  it("追加・増減・使い切りができ、操作ログが残る", async () => {
    const t = await setup();
    const me = await signedIn(t);
    const id = await me.mutation(api.ingredients.create, egg);

    expect(await me.mutation(api.ingredients.adjust, { id, delta: -10 })).toBe(0);
    const [item] = await me.query(api.ingredients.list);
    expect(item).toMatchObject({ name: "卵", quantity: 0 });

    await me.mutation(api.ingredients.remove, { id, reason: "consumed" });
    expect(await me.query(api.ingredients.list)).toEqual([]);

    const types = await t.run(async (ctx) =>
      (await ctx.db.query("events").collect()).map((e) => e.type),
    );
    expect(types).toEqual(["ingredient_added", "ingredient_updated", "ingredient_consumed"]);
    expect(await me.query(api.ingredients.history)).toEqual([
      { name: "卵", category: "egg", storage: "fridge", unit: "個" },
    ]);
  });

  it("不正な入力は保存しない", async () => {
    const t = await setup();
    const me = await signedIn(t);
    await expect(
      me.mutation(api.ingredients.create, { ...egg, name: "", quantity: -1 }),
    ).rejects.toThrow();
  });

  it("編集で期限を外せる", async () => {
    const t = await setup();
    const me = await signedIn(t);
    const id = await me.mutation(api.ingredients.create, egg);
    await me.mutation(api.ingredients.update, { id, ...egg, expiresOn: undefined });
    const [item] = await me.query(api.ingredients.list);
    expect(item?.expiresOn).toBeUndefined();
  });

  it("他人の食材は見えず、操作もできない", async () => {
    const t = await setup();
    const me = await signedIn(t);
    const other = await signedIn(t, "other@example.com");
    const id = await me.mutation(api.ingredients.create, egg);

    expect(await other.query(api.ingredients.list)).toEqual([]);
    await expect(other.mutation(api.ingredients.adjust, { id, delta: 1 })).rejects.toThrow();
    await expect(
      other.mutation(api.ingredients.remove, { id, reason: "discarded" }),
    ).rejects.toThrow();
  });
});
