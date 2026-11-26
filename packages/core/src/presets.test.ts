import { describe, expect, it } from "vitest";
import { INGREDIENT_PRESETS, normalizeKana, presetFor, searchPresets } from "./presets";

describe("normalizeKana", () => {
  it("カタカナをひらがなにする", () => {
    expect(normalizeKana(" キャベツ ")).toBe("きゃべつ");
  });
});

describe("searchPresets", () => {
  it("読みのひらがなで漢字の食材を見つける", () => {
    expect(searchPresets("とりむね").map((p) => p.name)).toEqual(["鶏むね肉"]);
  });
  it("カタカナ入力でも見つかる", () => {
    expect(searchPresets("トリ").map((p) => p.name)).toContain("鶏もも肉");
  });
  it("前方一致を部分一致より先に並べる", () => {
    const names = searchPresets("ねぎ").map((p) => p.name);
    expect(names[0]).toBe("ねぎ");
    expect(names).toContain("玉ねぎ");
  });
  it("空なら候補なし", () => {
    expect(searchPresets("  ")).toEqual([]);
  });
  it("プリセットの名前が重複していない", () => {
    const names = INGREDIENT_PRESETS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("presetFor", () => {
  it("名前か読みの完全一致だけを返す", () => {
    expect(presetFor("キャベツ")?.storage).toBe("fridge");
    expect(presetFor("きゃべつ")?.name).toBe("キャベツ");
    expect(presetFor("きゃべ")).toBeUndefined();
  });
});
