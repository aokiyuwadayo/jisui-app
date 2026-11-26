import type { Category, Storage } from "./ingredient";

export type IngredientPreset = {
  name: string;
  /** 検索用のひらがな読み */
  kana: string;
  category: Category;
  storage: Storage;
  unit: string;
  /** 購入日からの日持ちの目安（日）。調味料など目安がないものは省略 */
  shelfLifeDays?: number;
};

const p = (
  name: string,
  kana: string,
  category: Category,
  storage: Storage,
  unit: string,
  shelfLifeDays?: number,
): IngredientPreset => ({ name, kana, category, storage, unit, shelfLifeDays });

/** よく買う食材と日持ちの目安（家庭での一般的な目安） */
export const INGREDIENT_PRESETS: IngredientPreset[] = [
  p("キャベツ", "きゃべつ", "vegetable", "fridge", "玉", 14),
  p("玉ねぎ", "たまねぎ", "vegetable", "pantry", "個", 30),
  p("にんじん", "にんじん", "vegetable", "fridge", "本", 14),
  p("じゃがいも", "じゃがいも", "vegetable", "pantry", "個", 30),
  p("もやし", "もやし", "vegetable", "fridge", "袋", 2),
  p("ほうれん草", "ほうれんそう", "vegetable", "fridge", "袋", 3),
  p("小松菜", "こまつな", "vegetable", "fridge", "袋", 4),
  p("ねぎ", "ねぎ", "vegetable", "fridge", "本", 7),
  p("きゅうり", "きゅうり", "vegetable", "fridge", "本", 5),
  p("トマト", "とまと", "vegetable", "fridge", "個", 7),
  p("なす", "なす", "vegetable", "fridge", "本", 5),
  p("ピーマン", "ぴーまん", "vegetable", "fridge", "個", 10),
  p("ブロッコリー", "ぶろっこりー", "vegetable", "fridge", "個", 5),
  p("白菜", "はくさい", "vegetable", "fridge", "個", 14),
  p("大根", "だいこん", "vegetable", "fridge", "本", 10),
  p("レタス", "れたす", "vegetable", "fridge", "玉", 5),
  p("しめじ", "しめじ", "vegetable", "fridge", "パック", 5),
  p("えのき", "えのき", "vegetable", "fridge", "袋", 5),
  p("にんにく", "にんにく", "vegetable", "pantry", "個", 30),
  p("しょうが", "しょうが", "vegetable", "fridge", "個", 14),
  p("バナナ", "ばなな", "fruit", "pantry", "本", 5),
  p("りんご", "りんご", "fruit", "fridge", "個", 30),
  p("鶏むね肉", "とりむねにく", "meat", "fridge", "g", 2),
  p("鶏もも肉", "とりももにく", "meat", "fridge", "g", 2),
  p("豚こま切れ", "ぶたこまぎれ", "meat", "fridge", "g", 3),
  p("豚バラ肉", "ぶたばらにく", "meat", "fridge", "g", 3),
  p("合いびき肉", "あいびきにく", "meat", "fridge", "g", 1),
  p("牛こま切れ", "ぎゅうこまぎれ", "meat", "fridge", "g", 3),
  p("ベーコン", "べーこん", "meat", "fridge", "パック", 7),
  p("ハム", "はむ", "meat", "fridge", "パック", 7),
  p("ウインナー", "ういんなー", "meat", "fridge", "袋", 10),
  p("鮭", "さけ", "fish", "fridge", "枚", 2),
  p("さば", "さば", "fish", "fridge", "枚", 2),
  p("ツナ缶", "つなかん", "fish", "pantry", "個", 365),
  p("卵", "たまご", "egg", "fridge", "個", 14),
  p("牛乳", "ぎゅうにゅう", "dairy", "fridge", "ml", 7),
  p("ヨーグルト", "よーぐると", "dairy", "fridge", "個", 10),
  p("バター", "ばたー", "dairy", "fridge", "g", 60),
  p("チーズ", "ちーず", "dairy", "fridge", "袋", 30),
  p("豆腐", "とうふ", "other", "fridge", "個", 5),
  p("納豆", "なっとう", "other", "fridge", "パック", 7),
  p("油揚げ", "あぶらあげ", "other", "fridge", "枚", 4),
  p("米", "こめ", "grain", "pantry", "合", 60),
  p("食パン", "しょくぱん", "grain", "pantry", "枚", 4),
  p("うどん", "うどん", "grain", "fridge", "玉", 7),
  p("パスタ", "ぱすた", "grain", "pantry", "g", 365),
  p("醤油", "しょうゆ", "seasoning", "pantry", "ml"),
  p("みりん", "みりん", "seasoning", "pantry", "ml"),
  p("料理酒", "りょうりしゅ", "seasoning", "pantry", "ml"),
  p("砂糖", "さとう", "seasoning", "pantry", "g"),
  p("塩", "しお", "seasoning", "pantry", "g"),
  p("味噌", "みそ", "seasoning", "fridge", "g"),
  p("マヨネーズ", "まよねーず", "seasoning", "fridge", "g"),
  p("ケチャップ", "けちゃっぷ", "seasoning", "fridge", "g"),
  p("ごま油", "ごまあぶら", "seasoning", "pantry", "ml"),
  p("オリーブオイル", "おりーぶおいる", "seasoning", "pantry", "ml"),
  p("サラダ油", "さらだあぶら", "seasoning", "pantry", "ml"),
  p("酢", "す", "seasoning", "pantry", "ml"),
  p("顆粒だし", "かりゅうだし", "seasoning", "pantry", "g"),
  p("鶏がらスープの素", "とりがらすーぷのもと", "seasoning", "pantry", "g"),
  p("コンソメ", "こんそめ", "seasoning", "pantry", "個"),
];

/** カタカナをひらがなにそろえ、空白を除いて小文字にする */
export function normalizeKana(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** 名前か読みで候補を探す。前方一致を先に並べる */
export function searchPresets(
  query: string,
  presets: IngredientPreset[] = INGREDIENT_PRESETS,
  limit = 6,
): IngredientPreset[] {
  const q = normalizeKana(query);
  if (!q) return [];
  const scored: { preset: IngredientPreset; rank: number }[] = [];
  for (const preset of presets) {
    const keys = [normalizeKana(preset.name), preset.kana];
    if (keys.some((k) => k.startsWith(q))) scored.push({ preset, rank: 0 });
    else if (keys.some((k) => k.includes(q))) scored.push({ preset, rank: 1 });
  }
  return scored
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((s) => s.preset);
}

/** 名前か読みが完全に一致するプリセット。外部（Muse など）からの登録で既定値を補うのに使う */
export function presetFor(name: string): IngredientPreset | undefined {
  const q = normalizeKana(name);
  return INGREDIENT_PRESETS.find((p) => normalizeKana(p.name) === q || p.kana === q);
}
