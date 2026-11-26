import { EQUIPMENT } from "@jisui/core";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib";

/** 持っている器具。未設定なら null */
export const equipment = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    return user?.equipment ?? null;
  },
});

export const setEquipment = mutation({
  args: { equipment: v.array(v.string()) },
  handler: async (ctx, { equipment }) => {
    const userId = await requireUserId(ctx);
    const known = new Set<string>(EQUIPMENT);
    if (equipment.some((e) => !known.has(e))) throw new ConvexError("知らない器具が含まれています");
    // 並びを候補の順にそろえ、重複を除く
    await ctx.db.patch(userId, { equipment: EQUIPMENT.filter((e) => equipment.includes(e)) });
  },
});
