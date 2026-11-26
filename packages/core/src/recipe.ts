import { daysUntil, SOON_THRESHOLD_DAYS } from "./expiry";
import { INGREDIENT_PRESETS, normalizeKana } from "./presets";

/** 器具の候補。設定で持っているものを選ぶ */
export const EQUIPMENT = [
  "フライパン",
  "鍋",
  "電子レンジ",
  "トースター",
  "オーブン",
  "炊飯器",
  "魚焼きグリル",
  "ミキサー",
] as const;

/** 手順の文章から器具を推測するための言い回し */
const EQUIPMENT_KEYWORDS: Record<(typeof EQUIPMENT)[number], string[]> = {
  フライパン: ["フライパン"],
  鍋: ["鍋", "ゆで", "茹で", "煮立"],
  電子レンジ: ["レンジ", "レンチン"],
  トースター: ["トースター"],
  オーブン: ["オーブン"],
  炊飯器: ["炊飯器"],
  魚焼きグリル: ["グリル"],
  ミキサー: ["ミキサー", "ブレンダー"],
};

export function inferEquipment(steps: string[]): string[] {
  const text = steps.join("\n");
  return EQUIPMENT.filter((e) => EQUIPMENT_KEYWORDS[e].some((k) => text.includes(k)));
}


/** 表記ゆれを吸収した照合用のキー（ひらがな・空白なし・括弧内を除く） */
export function nameKey(name: string): string {
  return normalizeKana(
    name
      .replace(/[（(][^）)]*[）)]/g, "")
      .replace(/^[・★☆●○◎*＊]+/, "")
      .replace(/\s/g, "")
      .toLowerCase(),
  );
}

/** いつでもある前提のもの（水と基本の調味料）。在庫になくても「足りない」にしない */
const ALWAYS_AVAILABLE = new Set(
  ["水", "お湯", "湯", "氷", "塩", "こしょう", "胡椒", "塩こしょう", "砂糖", "油", "サラダ油"].map(nameKey),
);

const presetKana = new Map(INGREDIENT_PRESETS.map((p) => [nameKey(p.name), nameKey(p.kana)]));

/** 漢字名ならプリセットの読みも足して照合する */
function keysFor(name: string): string[] {
  const key = nameKey(name);
  const kana = presetKana.get(key);
  return kana && kana !== key ? [key, kana] : [key];
}

/** レシピの材料名と在庫名が同じものを指すか。「鶏むね肉」と「鶏むね」のような部分一致も許す */
export function sameIngredient(a: string, b: string): boolean {
  const ka = keysFor(a);
  const kb = keysFor(b);
  return ka.some((x) =>
    kb.some((y) => x === y || (Math.min(x.length, y.length) >= 2 && (x.includes(y) || y.includes(x)))),
  );
}

export type StockItem = { name: string; quantity: number; expiresOn?: string };

export type RecipeLike = {
  title: string;
  ingredients: { name: string; amount?: string; optional?: boolean }[];
  equipment: string[];
  cookMinutes?: number;
};

export type RecipeMatch = {
  /** 在庫にある材料（レシピ側の名前） */
  have: string[];
  /** 足りない材料（任意のものは含めない） */
  missing: string[];
  /** 使える「期限が近い（切れたものを含む）」在庫の名前 */
  urgent: string[];
  /** 持っていない器具 */
  missingEquipment: string[];
  /** 並び順用の点数。高いほど上 */
  score: number;
};

export function matchRecipe(
  recipe: RecipeLike,
  stock: StockItem[],
  today: string,
  ownedEquipment?: string[],
): RecipeMatch {
  const available = stock.filter((s) => s.quantity > 0);
  const have: string[] = [];
  const missing: string[] = [];
  const urgent = new Set<string>();

  for (const ing of recipe.ingredients) {
    if (ALWAYS_AVAILABLE.has(nameKey(ing.name))) {
      have.push(ing.name);
      continue;
    }
    const hits = available.filter((s) => sameIngredient(ing.name, s.name));
    if (hits.length > 0) {
      have.push(ing.name);
      for (const h of hits) {
        // 冷蔵庫画面の「早めに使いたい食材」と同じ基準
        const d = h.expiresOn ? daysUntil(h.expiresOn, today) : null;
        if (d !== null && d <= SOON_THRESHOLD_DAYS) urgent.add(h.name);
      }
    } else if (!ing.optional) {
      missing.push(ing.name);
    }
  }

  const missingEquipment = ownedEquipment
    ? recipe.equipment.filter((e) => !ownedEquipment.includes(e))
    : [];
  const required = recipe.ingredients.filter((i) => !i.optional).length || 1;
  const coverage = (required - missing.length) / required;
  const score =
    coverage * 100 + urgent.size * 15 - missing.length * 10 - missingEquipment.length * 50;

  return { have, missing, urgent: [...urgent], missingEquipment, score };
}

/** 作れる順（器具が揃う → 足りない材料が少ない → 期限が近い食材を多く使う）に並べる */
export function rankRecipes<R extends RecipeLike>(
  recipes: R[],
  stock: StockItem[],
  today: string,
  ownedEquipment?: string[],
): (R & { match: RecipeMatch })[] {
  return recipes
    .map((r) => ({ ...r, match: matchRecipe(r, stock, today, ownedEquipment) }))
    .filter((r) => r.match.have.length > 0)
    .sort((a, b) => b.match.score - a.match.score || a.title.localeCompare(b.title, "ja"));
}

export const RECIPE_SORTS = ["recent", "cooked", "quick", "title"] as const;
export type RecipeSort = (typeof RECIPE_SORTS)[number];
export const RECIPE_SORT_LABELS: Record<RecipeSort, string> = {
  recent: "新しい順",
  cooked: "よく作る順",
  quick: "時短順",
  title: "名前順",
};

type Sortable = { title: string; updatedAt: number; cookedCount: number; cookMinutes?: number };

export function sortRecipes<R extends Sortable>(recipes: R[], sort: RecipeSort): R[] {
  const byTitle = (a: R, b: R) => a.title.localeCompare(b.title, "ja");
  const list = [...recipes];
  switch (sort) {
    case "recent":
      return list.sort((a, b) => b.updatedAt - a.updatedAt);
    case "cooked":
      return list.sort((a, b) => b.cookedCount - a.cookedCount || byTitle(a, b));
    case "quick":
      return list.sort(
        (a, b) =>
          (a.cookMinutes ?? Number.POSITIVE_INFINITY) - (b.cookMinutes ?? Number.POSITIVE_INFINITY) ||
          byTitle(a, b),
      );
    case "title":
      return list.sort(byTitle);
  }
}

export type RecipeFilter = {
  query?: string;
  favoriteOnly?: boolean;
  maxMinutes?: number;
  tag?: string;
  equipment?: string[];
};

type Filterable = RecipeLike & { favorite: boolean; tags: string[] };

/** 検索語はタイトル・材料・タグに部分一致。器具は「指定した器具だけで作れる」もの */
export function filterRecipes<R extends Filterable>(recipes: R[], f: RecipeFilter): R[] {
  const q = f.query ? nameKey(f.query) : "";
  return recipes.filter((r) => {
    if (f.favoriteOnly && !r.favorite) return false;
    if (f.maxMinutes !== undefined && (r.cookMinutes === undefined || r.cookMinutes > f.maxMinutes))
      return false;
    if (f.tag && !r.tags.includes(f.tag)) return false;
    if (f.equipment && !r.equipment.every((e) => f.equipment?.includes(e))) return false;
    if (q) {
      const haystack = [r.title, ...r.tags, ...r.ingredients.map((i) => i.name)].map(nameKey);
      if (!haystack.some((h) => h.includes(q))) return false;
    }
    return true;
  });
}

export const TITLE_MAX_LENGTH = 80;

export function validateRecipe(input: {
  title: string;
  sourceUrl?: string;
  ingredients: { name: string }[];
  servings?: number;
  cookMinutes?: number;
}): string[] {
  const errors: string[] = [];
  const title = input.title.trim();
  if (!title) errors.push("料理名を入力してください");
  if (title.length > TITLE_MAX_LENGTH) errors.push(`料理名は${TITLE_MAX_LENGTH}文字以内にしてください`);
  if (input.ingredients.some((i) => !i.name.trim())) errors.push("材料名が空の行があります");
  if (input.sourceUrl && !/^https?:\/\//.test(input.sourceUrl))
    errors.push("URLは http(s):// で始めてください");
  for (const [key, label] of [
    ["servings", "人数"],
    ["cookMinutes", "調理時間"],
  ] as const) {
    const n = input[key];
    if (n !== undefined && (!Number.isFinite(n) || n <= 0)) errors.push(`${label}は正の数にしてください`);
  }
  return errors;
}

/** 「鶏もも肉 300g」→ { name: 鶏もも肉, amount: 300g }。最後の空白で区切る */
export function splitIngredientLine(line: string): { name: string; amount?: string } {
  const cleaned = line.replace(/^[・★☆●○◎*＊\s]+/, "").trim();
  const m = cleaned.match(/^(.+?)[\s　]+([^\s　]+)$/);
  if (m?.[1] && m[2]) return { name: m[1].trim(), amount: m[2] };
  return { name: cleaned };
}

const OPTIONAL_MARK = /[（(]お好みで[）)]/;

/** 1行1材料のテキストを材料の配列にする。「（お好みで）」を付けた行は任意扱い */
export function parseIngredientLines(text: string): { name: string; amount?: string; optional?: boolean }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const optional = OPTIONAL_MARK.test(line);
      const item = splitIngredientLine(line.replace(OPTIONAL_MARK, "").trim());
      return optional ? { ...item, optional } : item;
    });
}

export function formatIngredientLines(
  items: { name: string; amount?: string; optional?: boolean }[],
): string {
  return items
    .map((i) => [i.name, i.amount, i.optional ? "（お好みで）" : ""].filter(Boolean).join(" "))
    .join("\n");
}
