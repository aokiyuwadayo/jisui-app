import { describe, expect, it } from "vitest";
import {
  filterRecipes,
  inferEquipment,
  matchRecipe,
  formatIngredientLines,
  nameKey,
  parseIngredientLines,
  rankRecipes,
  sameIngredient,
  sortRecipes,
  splitIngredientLine,
  validateRecipe,
} from "./recipe";

const today = "2026-11-26";

const oyakodon = {
  title: "親子丼",
  ingredients: [
    { name: "鶏もも肉", amount: "200g" },
    { name: "卵", amount: "2個" },
    { name: "玉ねぎ", amount: "1/2個" },
    { name: "三つ葉", optional: true },
    { name: "水", amount: "100ml" },
    { name: "塩コショウ", amount: "少々" },
  ],
  equipment: ["フライパン"],
  cookMinutes: 15,
};

describe("sameIngredient", () => {
  it("表記ゆれと部分一致を同じものとみなす", () => {
    expect(sameIngredient("たまご", "卵")).toBe(true);
    expect(sameIngredient("タマネギ", "玉ねぎ")).toBe(true);
    expect(sameIngredient("鶏むね肉（皮なし）", "鶏むね肉")).toBe(true);
    expect(sameIngredient("鶏むね", "鶏むね肉")).toBe(true);
  });

  it("1文字の部分一致や別の食材は一致させない", () => {
    expect(sameIngredient("鶏もも肉", "鶏むね肉")).toBe(false);
    expect(sameIngredient("塩", "塩こうじ")).toBe(false);
  });

  it("nameKey は記号と空白を除いてひらがなにする", () => {
    expect(nameKey("★ タマネギ ")).toBe("たまねぎ");
  });
});

describe("matchRecipe", () => {
  it("在庫・不足・期限が近い食材・足りない器具を分ける", () => {
    const m = matchRecipe(
      oyakodon,
      [
        { name: "鶏もも肉", quantity: 300, expiresOn: "2026-11-27" },
        { name: "たまご", quantity: 6, expiresOn: "2026-12-10" },
        { name: "玉ねぎ", quantity: 0 },
      ],
      today,
      ["電子レンジ"],
    );
    expect(m.have).toEqual(["鶏もも肉", "卵", "水", "塩コショウ"]);
    expect(m.missing).toEqual(["玉ねぎ"]);
    expect(m.urgent).toEqual(["鶏もも肉"]);
    expect(m.missingEquipment).toEqual(["フライパン"]);
  });

  it("器具を指定しなければ器具は問わない", () => {
    expect(matchRecipe(oyakodon, [], today).missingEquipment).toEqual([]);
  });
});

describe("rankRecipes", () => {
  it("期限が近い食材を使う料理を上にし、何も使えない料理は除く", () => {
    const salad = {
      title: "サラダ",
      ingredients: [{ name: "キャベツ" }, { name: "卵" }],
      equipment: [],
    };
    const pasta = { title: "パスタ", ingredients: [{ name: "パスタ" }], equipment: ["鍋"] };
    const stock = [
      { name: "キャベツ", quantity: 1, expiresOn: "2026-11-26" },
      { name: "卵", quantity: 6 },
      { name: "鶏もも肉", quantity: 200 },
      { name: "玉ねぎ", quantity: 1 },
    ];
    const ranked = rankRecipes([oyakodon, salad, pasta], stock, today);
    expect(ranked.map((r) => r.title)).toEqual(["サラダ", "親子丼"]);
  });
});

describe("sortRecipes / filterRecipes", () => {
  const base = { ingredients: [], equipment: [], tags: [], favorite: false, cookedCount: 0 };
  const list = [
    { ...base, title: "カレー", updatedAt: 1, cookedCount: 5, cookMinutes: 60, tags: ["定番"] },
    { ...base, title: "うどん", updatedAt: 3, cookMinutes: 10, favorite: true, equipment: ["鍋"] },
    { ...base, title: "あんかけ", updatedAt: 2, ingredients: [{ name: "片栗粉" }] },
  ];

  it("並び替え", () => {
    expect(sortRecipes(list, "recent").map((r) => r.title)).toEqual(["うどん", "あんかけ", "カレー"]);
    expect(sortRecipes(list, "cooked")[0]?.title).toBe("カレー");
    expect(sortRecipes(list, "quick").map((r) => r.title)).toEqual(["うどん", "カレー", "あんかけ"]);
    expect(sortRecipes(list, "title").map((r) => r.title)).toEqual(["あんかけ", "うどん", "カレー"]);
  });

  it("絞り込み", () => {
    expect(filterRecipes(list, { favoriteOnly: true }).map((r) => r.title)).toEqual(["うどん"]);
    expect(filterRecipes(list, { maxMinutes: 15 }).map((r) => r.title)).toEqual(["うどん"]);
    expect(filterRecipes(list, { tag: "定番" }).map((r) => r.title)).toEqual(["カレー"]);
    expect(filterRecipes(list, { query: "片栗" }).map((r) => r.title)).toEqual(["あんかけ"]);
    expect(filterRecipes(list, { equipment: ["フライパン"] }).map((r) => r.title)).toEqual([
      "カレー",
      "あんかけ",
    ]);
  });
});

describe("validateRecipe", () => {
  it("料理名・URL・数値を確認する", () => {
    expect(validateRecipe({ title: "親子丼", ingredients: [{ name: "卵" }] })).toEqual([]);
    expect(
      validateRecipe({ title: " ", sourceUrl: "javascript:alert(1)", ingredients: [{ name: "" }], servings: 0 }),
    ).toHaveLength(4);
  });
});

describe("helpers", () => {
  it("材料の行を名前と分量に分ける", () => {
    expect(splitIngredientLine("★鶏もも肉　300g")).toEqual({ name: "鶏もも肉", amount: "300g" });
    expect(splitIngredientLine("塩こしょう 少々")).toEqual({ name: "塩こしょう", amount: "少々" });
    expect(splitIngredientLine("醤油")).toEqual({ name: "醤油" });
  });

  it("手順から器具を推測する", () => {
    expect(inferEquipment(["フライパンで焼く", "レンジで2分温める"])).toEqual(["フライパン", "電子レンジ"]);
  });
});

describe("parseIngredientLines / formatIngredientLines", () => {
  it("行と分量・任意の印を相互に変換する", () => {
    const text = "鶏もも肉 200g\n\n三つ葉 適量 （お好みで）\n塩";
    const items = parseIngredientLines(text);
    expect(items).toEqual([
      { name: "鶏もも肉", amount: "200g" },
      { name: "三つ葉", amount: "適量", optional: true },
      { name: "塩" },
    ]);
    expect(formatIngredientLines(items)).toBe("鶏もも肉 200g\n三つ葉 適量 （お好みで）\n塩");
  });
});
