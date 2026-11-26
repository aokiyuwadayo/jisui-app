"use node";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  addDays,
  CATEGORIES,
  daysUntil,
  parseDate,
  presetFor,
  STORAGES,
  todayInTokyo,
  UNITS,
} from "@jisui/core";
import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { requireUserId } from "./lib";

const MODEL = "claude-opus-5-5";

function client() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ConvexError("AI の設定（ANTHROPIC_API_KEY）がまだです");
  }
  return new Anthropic();
}

const Idea = z.object({
  title: z.string().describe("料理名"),
  cookMinutes: z.number().describe("調理時間の目安（分）"),
  servings: z.number().describe("何人分か"),
  reason: z.string().describe("この料理を勧める理由を一文で"),
  ingredients: z.array(
    z.object({
      name: z.string(),
      amount: z.string(),
      inStock: z.boolean().describe("在庫にあるものなら true"),
    }),
  ),
  steps: z.array(z.string()),
  equipment: z.array(z.string()).describe("使う器具。持っている器具の中から"),
});

const Ideas = z.object({ ideas: z.array(Idea) });

export type AiIdea = z.infer<typeof Idea>;

const SYSTEM = `あなたは一人暮らしの自炊を手伝う料理人です。
冷蔵庫の在庫からなるべく買い足しなしで作れる家庭料理を提案します。
- 期限が近い食材（残り日数が少ないもの）を優先して使い切れる料理にする
- 調味料は在庫にあるものを中心に。塩・こしょう・油など基本的なものは使ってよい
- 持っている器具だけで作れる手順にする
- 手順は短く具体的に、1手順1文程度
- 料理名・材料・手順はすべて日本語`;

/** 在庫と器具から、AI に料理を考えてもらう（レシピブックで足りないとき用） */
export const suggest = action({
  args: {
    mustUse: v.optional(v.array(v.string())),
    request: v.optional(v.string()),
  },
  handler: async (ctx, { mustUse = [], request }): Promise<AiIdea[]> => {
    const userId = await requireUserId(ctx);
    const { stock, equipment } = await ctx.runQuery(internal.suggestions.contextFor, { userId });
    if (stock.length === 0) throw new ConvexError("在庫が空です。先に食材を登録してください");

    const today = todayInTokyo();
    const stockLines = stock.map((s) => {
      const days = s.expiresOn ? daysUntil(s.expiresOn, today) : null;
      const left = days === null ? "期限なし" : days < 0 ? `期限切れ${-days}日` : `残り${days}日`;
      return `- ${s.name} ${s.quantity}${s.unit}（${left}）`;
    });
    const prompt = [
      `今日は ${today} です。`,
      "## 在庫",
      ...stockLines,
      "## 持っている器具",
      equipment && equipment.length > 0 ? equipment.join("、") : "一般的な家庭の器具",
      mustUse.length > 0 ? `## 必ず使う食材\n${mustUse.join("、")}` : "",
      request ? `## 希望\n${request.slice(0, 200)}` : "",
      "",
      "この条件で作れる料理を3つ提案してください。",
    ]
      .filter((line) => line !== "")
      .join("\n");

    const response = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(Ideas) },
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    if (response.stop_reason === "refusal") throw new ConvexError("提案を作れませんでした");
    if (!response.parsed_output) throw new ConvexError("提案の読み取りに失敗しました");
    return response.parsed_output.ideas;
  },
});

const ReceiptItem = z.object({
  name: z.string().describe("食材名。商品名から一般的な名前にする（例：「国産若鶏むね肉」→「鶏むね肉」）"),
  quantity: z.number().describe("量。パック数や個数。重さが書いてあれば g"),
  unit: z.enum(UNITS),
  category: z.enum(CATEGORIES),
  storage: z.enum(STORAGES).describe("ふつうの保存場所。冷凍食品は freezer"),
  shelfLifeDays: z.number().nullable().describe("買った日からの日持ちの目安（日）。調味料・乾物は null"),
});

const Receipt = z.object({
  purchasedOn: z.string().nullable().describe("レシートの日付（YYYY-MM-DD）。読めなければ null"),
  items: z.array(ReceiptItem),
});

const RECEIPT_SYSTEM = `あなたはスーパーのレシートから食材を読み取る係です。
- 食べ物と調味料だけを拾う。袋・ポイント・割引・小計・税などの行は無視する
- 同じ商品が複数行あればまとめる
- 名前は家庭で呼ぶ一般的な名前にする（ブランド名・産地・「特売」などを外す）`;

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
/** 画像は端末で縮小してから送る前提。base64 で約 5MB まで */
const MAX_IMAGE_BASE64 = 7_000_000;

export type ReceiptDraft = {
  name: string;
  quantity: number;
  unit: string;
  category: (typeof CATEGORIES)[number];
  storage: (typeof STORAGES)[number];
  expiresOn?: string;
  purchasedOn: string;
};

/** レシートの写真から、在庫に追加する候補を作る（保存はしない） */
export const readReceipt = action({
  args: {
    imageBase64: v.string(),
    mediaType: v.union(...MEDIA_TYPES.map((m) => v.literal(m))),
  },
  handler: async (ctx, { imageBase64, mediaType }): Promise<ReceiptDraft[]> => {
    await requireUserId(ctx);
    if (imageBase64.length > MAX_IMAGE_BASE64) throw new ConvexError("画像が大きすぎます");

    const response = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(Receipt) },
      system: RECEIPT_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            { type: "text", text: "このレシートの食材を読み取ってください。" },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") throw new ConvexError("レシートを読み取れませんでした");
    const receipt = response.parsed_output;
    if (!receipt) throw new ConvexError("レシートを読み取れませんでした");

    const today = todayInTokyo();
    const purchasedOn =
      receipt.purchasedOn && parseDate(receipt.purchasedOn) !== null && receipt.purchasedOn <= today
        ? receipt.purchasedOn
        : today;
    return receipt.items.map((item) => {
      // よく買う食材は日持ちの目安をアプリの値にそろえる
      const preset = presetFor(item.name);
      const days = preset?.shelfLifeDays ?? item.shelfLifeDays;
      return {
        name: item.name.trim().slice(0, 40),
        quantity: item.quantity,
        unit: item.unit,
        category: preset?.category ?? item.category,
        storage: preset?.storage ?? item.storage,
        expiresOn: days ? (addDays(purchasedOn, days) ?? undefined) : undefined,
        purchasedOn,
      };
    });
  },
});
