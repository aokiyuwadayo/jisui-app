import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, type Infer } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import type { eventType } from "./schema";

/** ログイン必須の関数で使う。未ログインなら例外。アクションからも呼べる */
export async function requireUserId(ctx: QueryCtx | ActionCtx) {
  // アクションの runQuery は型上の引数が少し違うだけで、実行時は同じように使える
  const userId = await getAuthUserId(ctx as QueryCtx);
  if (userId === null) throw new ConvexError("ログインが必要です");
  return userId;
}

/** BigQuery 連携用の操作ログを残す */
export async function logEvent(
  ctx: MutationCtx,
  userId: Id<"users">,
  type: Infer<typeof eventType>,
  subjectId: string | undefined,
  payload: unknown,
) {
  await ctx.db.insert("events", { userId, type, subjectId, payload, at: Date.now() });
}
