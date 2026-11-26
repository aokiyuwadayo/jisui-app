import { CATEGORIES, STORAGES } from "@jisui/core";
import { z } from "zod";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { fetchRecipeDraft } from "./recipes";

// REST API と MCP の両方で公開する道具（ツール）。説明文は AI エージェントが読む

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD（日本時間）");
const ingredientRef = z.string().describe("食材の id か名前（例：卵）。同名が複数あれば期限が近いもの");

type Tool<S extends z.ZodObject> = {
  name: string;
  title: string;
  description: string;
  input: S;
  readOnly: boolean;
  run: (ctx: ActionCtx, userId: Id<"users">, args: z.infer<S>) => Promise<unknown>;
};

/** 共通の形。run の引数は各ツールの input で検証済みのもの */
export type AgentTool = Omit<Tool<z.ZodObject>, "run"> & {
  run: (ctx: ActionCtx, userId: Id<"users">, args: never) => Promise<unknown>;
};

function tool<S extends z.ZodObject>(t: Tool<S>): AgentTool {
  return t as unknown as AgentTool;
}

export const TOOLS: AgentTool[] = [
  tool({
    name: "list_ingredients",
    title: "在庫を見る",
    description:
      "冷蔵庫・冷凍庫・常温の在庫（食材と調味料）を期限が近い順に返す。daysLeft は期限までの残り日数（負なら期限切れ）。",
    readOnly: true,
    input: z.object({
      storage: z.enum(STORAGES).optional().describe("fridge=冷蔵 freezer=冷凍 pantry=常温"),
      category: z.enum(CATEGORIES).optional(),
      expiringWithinDays: z.number().int().optional().describe("残り日数がこの値以下のものだけ"),
    }),
    run: (ctx, userId, args): Promise<unknown> => ctx.runQuery(internal.agent.listIngredients, { userId, ...args }),
  }),
  tool({
    name: "add_ingredient",
    title: "在庫に追加",
    description:
      "買ってきた食材や調味料を在庫に追加する。よく買う食材なら種類・保存場所・単位・期限の目安は自動で補う。",
    readOnly: false,
    input: z.object({
      name: z.string().min(1).describe("食材名（例：鶏むね肉）"),
      quantity: z.number().min(0).optional().describe("量。省略時は1"),
      unit: z.string().optional().describe("個・本・枚・玉・袋・パック・g・ml・合・適量"),
      category: z.enum(CATEGORIES).optional(),
      storage: z.enum(STORAGES).optional(),
      expiresOn: date.optional().describe("消費・賞味期限。分からなければ省略"),
      purchasedOn: date.optional().describe("購入日。省略時は今日"),
      note: z.string().optional(),
    }),
    run: (ctx, userId, args): Promise<unknown> => ctx.runMutation(internal.agent.addIngredient, { userId, ...args }),
  }),
  tool({
    name: "update_ingredient",
    title: "量・期限を変える",
    description:
      "在庫の量を変える（quantity で上書き、delta で増減。例：卵を2個使った→delta=-2）か、期限を変える（null で期限なし）。",
    readOnly: false,
    input: z.object({
      ingredient: ingredientRef,
      quantity: z.number().min(0).optional(),
      delta: z.number().optional(),
      expiresOn: date.nullable().optional(),
    }),
    run: (ctx, userId, args): Promise<unknown> => ctx.runMutation(internal.agent.updateIngredient, { userId, ...args }),
  }),
  tool({
    name: "remove_ingredient",
    title: "在庫から外す",
    description: "使い切った（consumed）か捨てた（discarded）食材を在庫から外す。",
    readOnly: false,
    input: z.object({
      ingredient: ingredientRef,
      reason: z.enum(["consumed", "discarded"]),
    }),
    run: (ctx, userId, args): Promise<unknown> =>
      ctx.runMutation(internal.agent.removeIngredientByRef, { userId, ...args }),
  }),
  tool({
    name: "list_recipes",
    title: "レシピブックを見る",
    description: "保存しているレシピを材料・手順つきで返す。料理名・材料・タグで検索できる。",
    readOnly: true,
    input: z.object({
      query: z.string().optional(),
      favoriteOnly: z.boolean().optional(),
      maxMinutes: z.number().optional().describe("調理時間がこの分以内のもの"),
    }),
    run: (ctx, userId, args): Promise<unknown> => ctx.runQuery(internal.agent.listRecipes, { userId, ...args }),
  }),
  tool({
    name: "save_recipe_from_url",
    title: "URLからレシピを保存",
    description:
      "レシピサイトの URL を読み込んでレシピブックに保存する。ページにレシピ情報（schema.org）がない場合は save_recipe を使う。",
    readOnly: false,
    input: z.object({
      url: z.string().url(),
      tags: z.array(z.string()).optional().describe("追加で付けるタグ"),
    }),
    run: async (ctx, userId, { url, tags = [] }): Promise<unknown> => {
      const draft = await fetchRecipeDraft(url);
      return ctx.runMutation(internal.agent.saveRecipe, {
        userId,
        ...draft,
        tags: [...draft.tags, ...tags],
      });
    },
  }),
  tool({
    name: "save_recipe",
    title: "レシピを保存",
    description: "材料と手順を指定してレシピブックに保存する。",
    readOnly: false,
    input: z.object({
      title: z.string().min(1),
      ingredients: z.array(
        z.object({
          name: z.string(),
          amount: z.string().optional(),
          optional: z.boolean().optional().describe("なくても作れるなら true"),
        }),
      ),
      steps: z.array(z.string()),
      cookMinutes: z.number().optional(),
      servings: z.number().optional(),
      equipment: z.array(z.string()).optional().describe("フライパン・鍋・電子レンジ など"),
      tags: z.array(z.string()).optional(),
      sourceUrl: z.string().url().optional(),
    }),
    run: (ctx, userId, args): Promise<unknown> =>
      ctx.runMutation(internal.agent.saveRecipe, {
        userId,
        ...args,
        equipment: args.equipment ?? [],
        tags: args.tags ?? [],
      }),
  }),
  tool({
    name: "suggest_recipes",
    title: "今日の料理を提案",
    description:
      "レシピブックの中から、今の在庫と持っている器具で作りやすい順に返す。期限が近い食材を使う料理が上に来る。",
    readOnly: true,
    input: z.object({
      mustUse: z.array(z.string()).optional().describe("必ず使いたい食材名"),
    }),
    run: (ctx, userId, args): Promise<unknown> => ctx.runQuery(internal.agent.suggestRecipes, { userId, ...args }),
  }),
];

export function findTool(name: string): AgentTool | undefined {
  return TOOLS.find((t) => t.name === name);
}

/** 入力の JSON Schema（MCP の inputSchema・OpenAPI で使う） */
export function inputSchema(t: AgentTool) {
  const { $schema: _, ...schema } = z.toJSONSchema(t.input, { io: "input" }) as Record<string, unknown>;
  return schema;
}

/** 入力を検証して実行する。検証エラーは分かりやすい文にして投げる */
export async function runTool(ctx: ActionCtx, userId: Id<"users">, t: AgentTool, raw: unknown) {
  const parsed = t.input.safeParse(raw ?? {});
  if (!parsed.success) {
    throw new ToolInputError(
      parsed.error.issues.map((i) => `${i.path.join(".") || "入力"}: ${i.message}`).join("\n"),
    );
  }
  // 各ツールの run は自分の input に合う型を受け取る
  return (t.run as (c: ActionCtx, u: Id<"users">, a: unknown) => Promise<unknown>)(
    ctx,
    userId,
    parsed.data,
  );
}

export class ToolInputError extends Error {}
