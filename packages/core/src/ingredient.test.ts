import { describe, expect, it } from "vitest";
import { adjustQuantity, compareByExpiry, stepFor, validateIngredient } from "./ingredient";

describe("stepFor", () => {
  it("g と ml は 50 刻み、それ以外は 1", () => {
    expect(stepFor("g")).toBe(50);
    expect(stepFor("ml")).toBe(50);
    expect(stepFor("個")).toBe(1);
  });
});

describe("adjustQuantity", () => {
  it("0 未満にならない", () => {
    expect(adjustQuantity(1, -3)).toBe(0);
  });
  it("小数の誤差を丸める", () => {
    expect(adjustQuantity(0.1, 0.2)).toBe(0.3);
  });
});

describe("validateIngredient", () => {
  it("正しい入力はエラーなし", () => {
    expect(validateIngredient({ name: "卵", quantity: 6, expiresOn: "2026-12-01" })).toEqual([]);
  });
  it("問題をすべて返す", () => {
    expect(
      validateIngredient({ name: "  ", quantity: -1, expiresOn: "2026-13-01", purchasedOn: "x" }),
    ).toHaveLength(4);
  });
  it("長すぎる名前を弾く", () => {
    expect(validateIngredient({ name: "あ".repeat(41), quantity: 1 })).toHaveLength(1);
  });
});

describe("compareByExpiry", () => {
  it("期限の近い順、期限なしは最後、同じなら名前順", () => {
    const items = [
      { name: "塩" },
      { name: "たまご", expiresOn: "2026-12-05" },
      { name: "もやし", expiresOn: "2026-11-27" },
      { name: "ぎゅうにゅう", expiresOn: "2026-12-05" },
    ];
    expect(items.sort(compareByExpiry).map((i) => i.name)).toEqual(["もやし", "ぎゅうにゅう", "たまご", "塩"]);
  });
});
