import { rankRecipes, sameIngredient, todayInTokyo } from "@jisui/core";
import { v } from "convex/values";
import { internalQuery, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUserId } from "./lib";

async function loadContext(ctx: QueryCtx, userId: Id<"users">) {
  const [user, stock, recipes] = await Promise.all([
    ctx.db.get(userId),
    ctx.db
      .query("ingredients")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("recipes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
  ]);
  return { equipment: user?.equipment ?? null, stock, recipes };
}

/** レシピブックから、今の在庫で作りやすい順に並べる */
export const fromBook = query({
  args: {
    /** 必ず使いたい食材（在庫の名前） */
    mustUse: v.optional(v.array(v.string())),
    /** 器具を絞り込む。未指定なら設定の器具、設定もなければ問わない */
    equipment: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { mustUse = [], equipment }) => {
    const userId = await requireUserId(ctx);
    const context = await loadContext(ctx, userId);
    const owned = equipment ?? context.equipment ?? undefined;
    return rankRecipes(context.recipes, context.stock, todayInTokyo(), owned)
      .filter((r) => r.match.missingEquipment.length === 0)
      .filter((r) => mustUse.every((name) => r.ingredients.some((i) => sameIngredient(i.name, name))))
      .slice(0, 30);
  },
});

/** AI 提案用に、在庫と器具をまとめて渡す */
export const contextFor = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const { equipment, stock } = await loadContext(ctx, userId);
    return {
      equipment,
      stock: stock
        .filter((s) => s.quantity > 0)
        .map((s) => ({
          name: s.name,
          quantity: s.quantity,
          unit: s.unit,
          category: s.category,
          expiresOn: s.expiresOn,
        })),
    };
  },
});
