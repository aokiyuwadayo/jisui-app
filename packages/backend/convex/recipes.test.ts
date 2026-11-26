import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { setup, signedIn } from "./test.setup";

const oyakodon = {
  title: " 親子丼 ",
  ingredients: [
    { name: "鶏もも肉", amount: "200g" },
    { name: "卵", amount: "2個" },
    { name: " ", amount: "" },
  ],
  steps: ["フライパンで煮る", " "],
  equipment: ["フライパン"],
  tags: ["丼", "丼"],
  cookMinutes: 15,
};

describe("recipes", () => {
  it("保存時に空行と重複タグを取り除き、作った回数を数える", async () => {
    const t = await setup();
    const me = await signedIn(t);
    const id = await me.mutation(api.recipes.create, oyakodon);

    await me.mutation(api.recipes.markCooked, { id });
    await me.mutation(api.recipes.toggleFavorite, { id });
    const recipe = await me.query(api.recipes.get, { id });
    expect(recipe).toMatchObject({
      title: "親子丼",
      ingredients: [
        { name: "鶏もも肉", amount: "200g" },
        { name: "卵", amount: "2個" },
      ],
      steps: ["フライパンで煮る"],
      tags: ["丼"],
      favorite: true,
      cookedCount: 1,
    });

    const types = await t.run(async (ctx) =>
      (await ctx.db.query("events").collect()).map((e) => e.type),
    );
    expect(types).toEqual(["recipe_saved", "recipe_cooked"]);
  });

  it("編集で調理時間を外せる・削除できる", async () => {
    const t = await setup();
    const me = await signedIn(t);
    const id = await me.mutation(api.recipes.create, oyakodon);
    await me.mutation(api.recipes.update, { id, ...oyakodon, cookMinutes: undefined });
    expect((await me.query(api.recipes.get, { id })).cookMinutes).toBeUndefined();
    await me.mutation(api.recipes.remove, { id });
    expect(await me.query(api.recipes.list)).toEqual([]);
  });

  it("不正な URL は保存しない", async () => {
    const t = await setup();
    const me = await signedIn(t);
    await expect(
      me.mutation(api.recipes.create, { ...oyakodon, sourceUrl: "javascript:alert(1)" }),
    ).rejects.toThrow();
  });

  it("他人のレシピは見えず、操作もできない", async () => {
    const t = await setup();
    const me = await signedIn(t);
    const other = await signedIn(t, "other@example.com");
    const id = await me.mutation(api.recipes.create, oyakodon);
    expect(await other.query(api.recipes.list)).toEqual([]);
    await expect(other.query(api.recipes.get, { id })).rejects.toThrow();
    await expect(other.mutation(api.recipes.remove, { id })).rejects.toThrow();
  });
});

describe("suggestions", () => {
  it("在庫と器具に合うレシピを、期限が近い食材を使う順に返す", async () => {
    const t = await setup();
    const me = await signedIn(t);
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
    await me.mutation(api.ingredients.create, {
      name: "鶏もも肉",
      category: "meat",
      storage: "fridge",
      quantity: 300,
      unit: "g",
      expiresOn: today,
    });
    await me.mutation(api.ingredients.create, {
      name: "卵",
      category: "egg",
      storage: "fridge",
      quantity: 6,
      unit: "個",
    });
    await me.mutation(api.recipes.create, oyakodon);
    await me.mutation(api.recipes.create, {
      title: "卵かけご飯",
      ingredients: [{ name: "卵" }, { name: "ご飯" }],
      steps: [],
      equipment: [],
      tags: [],
    });
    await me.mutation(api.recipes.create, {
      title: "グラタン",
      ingredients: [{ name: "卵" }],
      steps: [],
      equipment: ["オーブン"],
      tags: [],
    });

    // 器具の設定がなければ器具は問わない
    let list = await me.query(api.suggestions.fromBook, {});
    expect(list.map((r) => r.title)).toEqual(["親子丼", "グラタン", "卵かけご飯"]);
    expect(list[0]?.match.urgent).toEqual(["鶏もも肉"]);

    await me.mutation(api.settings.setEquipment, { equipment: ["フライパン", "電子レンジ"] });
    list = await me.query(api.suggestions.fromBook, {});
    expect(list.map((r) => r.title)).toEqual(["親子丼", "卵かけご飯"]);

    list = await me.query(api.suggestions.fromBook, { mustUse: ["卵"], equipment: [] });
    expect(list.map((r) => r.title)).toEqual(["卵かけご飯"]);
  });

  it("知らない器具は設定できない", async () => {
    const t = await setup();
    const me = await signedIn(t);
    await expect(
      me.mutation(api.settings.setEquipment, { equipment: ["タイムマシン"] }),
    ).rejects.toThrow();
    await me.mutation(api.settings.setEquipment, { equipment: ["鍋", "フライパン", "鍋"] });
    expect(await me.query(api.settings.equipment)).toEqual(["フライパン", "鍋"]);
  });
});
