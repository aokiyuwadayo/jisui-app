/// <reference types="vite/client" />
import authTest from "@convex-dev/auth/test";
import googleTest from "@convex-dev/auth/components/google/test";
import { convexTest } from "convex-test";
import { components } from "./_generated/api";
import schema from "./schema";

export const modules = import.meta.glob("./**/*.*s");

export const ALLOWED = "me@example.com";

/** テスト用の Convex。ALLOWED のユーザーでログイン済みの呼び出し口も返す */
export async function setup() {
  process.env.ALLOWED_EMAILS = ALLOWED;
  process.env.CONVEX_CLOUD_URL = "https://test.convex.cloud";
  const t = convexTest(schema, modules);
  authTest.registerCore(t);
  googleTest.registerGoogleOauth(t);
  return t;
}

/** ユーザーを作り、本物のセッションを発行してその人として呼べるようにする */
export async function signedIn(t: Awaited<ReturnType<typeof setup>>, email = ALLOWED) {
  const tokens = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email });
    return ctx.runMutation(components.auth.public._internal_dangerous_signIn, {
      claims: { method: "google", profile: {} },
      componentPath: "authGoogle",
      userId,
      accessTokenTtlSeconds: 60,
      refreshInactivityTimeoutSeconds: 3600,
      sessionMaxLifetimeSeconds: 3600,
    });
  });
  return t.withIdentity(authTest.sessionIdentity(tokens));
}
