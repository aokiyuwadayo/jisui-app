"use node";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { daysUntil, todayInTokyo } from "@jisui/core";
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
