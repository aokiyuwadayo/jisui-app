import { parseDate } from "./expiry";

export const CATEGORIES = [
  "vegetable",
  "fruit",
  "meat",
  "fish",
  "dairy",
  "egg",
  "grain",
  "seasoning",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  vegetable: "野菜",
  fruit: "果物",
  meat: "肉",
  fish: "魚介",
  dairy: "乳製品",
  egg: "卵",
  grain: "主食",
  seasoning: "調味料",
  other: "その他",
};

export const STORAGES = ["fridge", "freezer", "pantry"] as const;
export type Storage = (typeof STORAGES)[number];

export const STORAGE_LABELS: Record<Storage, string> = {
  fridge: "冷蔵",
  freezer: "冷凍",
  pantry: "常温",
};

export const UNITS = ["個", "本", "枚", "玉", "袋", "パック", "g", "ml", "合", "適量"] as const;

export const NAME_MAX_LENGTH = 40;

/** ＋/− ボタン1回で増減する量 */
export function stepFor(unit: string): number {
  if (unit === "g" || unit === "ml") return 50;
  return 1;
}

/** 量を増減する。0 未満にはしない。小数の誤差は 0.01 単位で丸める */
export function adjustQuantity(quantity: number, delta: number): number {
  return Math.max(0, Math.round((quantity + delta) * 100) / 100);
}

export type IngredientInput = {
  name: string;
  quantity: number;
  expiresOn?: string;
  purchasedOn?: string;
};

/** 入力の問題をすべて返す。空配列なら OK */
export function validateIngredient(input: IngredientInput): string[] {
  const errors: string[] = [];
  const name = input.name.trim();
  if (!name) errors.push("名前を入力してください");
  if (name.length > NAME_MAX_LENGTH) errors.push(`名前は${NAME_MAX_LENGTH}文字以内にしてください`);
  if (!Number.isFinite(input.quantity) || input.quantity < 0) errors.push("量は0以上の数にしてください");
  if (input.expiresOn && parseDate(input.expiresOn) === null) errors.push("期限の日付が正しくありません");
  if (input.purchasedOn && parseDate(input.purchasedOn) === null) errors.push("購入日の日付が正しくありません");
  return errors;
}

/** 期限の近い順。期限なしは最後、同じ期限は名前順 */
export function compareByExpiry(
  a: { expiresOn?: string; name: string },
  b: { expiresOn?: string; name: string },
): number {
  if (a.expiresOn !== b.expiresOn) {
    if (!a.expiresOn) return 1;
    if (!b.expiresOn) return -1;
    return a.expiresOn < b.expiresOn ? -1 : 1;
  }
  return a.name.localeCompare(b.name, "ja");
}
