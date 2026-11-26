import { inferEquipment, splitIngredientLine } from "./recipe";

/** URL から読み込んだレシピの下書き。保存前に画面で確認・修正する */
export type RecipeDraft = {
  title: string;
  sourceUrl: string;
  imageUrl?: string;
  servings?: number;
  cookMinutes?: number;
  ingredients: { name: string; amount?: string }[];
  steps: string[];
  equipment: string[];
  tags: string[];
};

type Json = unknown;

function asArray(v: Json): Json[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function isObject(v: Json): v is Record<string, Json> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hasType(v: Record<string, Json>, type: string) {
  return asArray(v["@type"]).includes(type);
}

/** JSON-LD のかたまり（@graph や配列を含む）から Recipe を探す */
function findRecipe(node: Json): Record<string, Json> | undefined {
  for (const item of asArray(node)) {
    if (!isObject(item)) continue;
    if (hasType(item, "Recipe")) return item;
    const nested = findRecipe(item["@graph"]);
    if (nested) return nested;
  }
  return undefined;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|\w+);/gi, (all, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[code.toLowerCase()] ?? all;
  });
}

function clean(text: Json): string {
  if (typeof text !== "string") return "";
  return decodeEntities(text.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** recipeInstructions は文字列・配列・HowToStep・HowToSection のどれでも来る */
function collectSteps(node: Json): string[] {
  const steps: string[] = [];
  for (const item of asArray(node)) {
    if (typeof item === "string") {
      steps.push(...item.split(/\n+/).map(clean));
    } else if (isObject(item)) {
      if (hasType(item, "HowToSection")) steps.push(...collectSteps(item.itemListElement));
      else steps.push(clean(item.text ?? item.name));
    }
  }
  return steps.filter(Boolean);
}

/** ISO 8601 の期間（PT1H30M など）を分にする */
export function parseDurationMinutes(value: Json): number | undefined {
  if (typeof value !== "string") return undefined;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(value.trim());
  if (!m) return undefined;
  const [, d, h, min] = m;
  const total = Number(d ?? 0) * 1440 + Number(h ?? 0) * 60 + Number(min ?? 0);
  return total > 0 ? total : undefined;
}

function parseServings(value: Json): number | undefined {
  for (const v of asArray(value)) {
    const n = typeof v === "number" ? v : Number(String(v).match(/\d+/)?.[0]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function parseImage(value: Json): string | undefined {
  for (const v of asArray(value)) {
    if (typeof v === "string" && /^https?:\/\//.test(v)) return v;
    if (isObject(v) && typeof v.url === "string") return v.url;
  }
  return undefined;
}

function parseTags(recipe: Record<string, Json>): string[] {
  const raw = [
    ...asArray(recipe.recipeCategory),
    ...asArray(recipe.recipeCuisine),
    ...asArray(recipe.keywords).flatMap((k) => (typeof k === "string" ? k.split(/[,、]/) : [])),
  ];
  const tags = raw.map(clean).filter((t) => t && t.length <= 20);
  return [...new Set(tags)].slice(0, 8);
}

/** HTML 内の schema.org Recipe（JSON-LD）を読み取る。見つからなければ null */
export function parseRecipeFromHtml(html: string, sourceUrl: string): RecipeDraft | null {
  const blocks = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const [, body] of blocks) {
    let data: Json;
    try {
      data = JSON.parse(body ?? "");
    } catch {
      continue;
    }
    const recipe = findRecipe(data);
    if (!recipe) continue;

    const steps = collectSteps(recipe.recipeInstructions);
    const cookMinutes =
      parseDurationMinutes(recipe.totalTime) ??
      (() => {
        const sum =
          (parseDurationMinutes(recipe.prepTime) ?? 0) + (parseDurationMinutes(recipe.cookTime) ?? 0);
        return sum > 0 ? sum : undefined;
      })();

    return {
      title: clean(recipe.name) || "無題のレシピ",
      sourceUrl,
      imageUrl: parseImage(recipe.image),
      servings: parseServings(recipe.recipeYield),
      cookMinutes,
      ingredients: asArray(recipe.recipeIngredient)
        .map(clean)
        .filter(Boolean)
        .map(splitIngredientLine),
      steps,
      equipment: inferEquipment(steps),
      tags: parseTags(recipe),
    };
  }
  return null;
}
