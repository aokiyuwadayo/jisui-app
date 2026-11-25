import { getAuthUserId } from "@convex-dev/auth/server";
import { vGoogleProfile } from "@convex-dev/auth/methods/google/server";
import { isAllowedEmail } from "@jisui/core";
import { ConvexError, v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

const vGoogleMethod = v.object({
  name: v.literal("google"),
  profile: vGoogleProfile,
});

/** 許可リスト（ALLOWED_EMAILS）にある、確認済みメールの Google アカウントだけ通す */
function assertAllowed(profile: { email?: string; emailVerified: boolean }) {
  if (!profile.emailVerified || !isAllowedEmail(profile.email, process.env.ALLOWED_EMAILS)) {
    throw new ConvexError("このアカウントではログインできません");
  }
}

export const createUserGoogle = internalMutation({
  args: { method: vGoogleMethod },
  returns: v.id("users"),
  handler: async (ctx, { method }) => {
    assertAllowed(method.profile);
    return ctx.db.insert("users", {
      email: method.profile.email!,
      name: method.profile.name,
      image: method.profile.picture,
    });
  },
});

// 許可リストから外したアカウントは次回ログインから弾く
export const onSignInGoogle = internalMutation({
  args: { userId: v.id("users"), method: vGoogleMethod },
  returns: v.null(),
  handler: async (_ctx, { method }) => {
    assertAllowed(method.profile);
    return null;
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return ctx.db.get(userId);
  },
});
