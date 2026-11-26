/** Convex の URL（.convex.cloud） */
export const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL ?? "";

/**
 * Web 版の URL。Google ログインの戻り先を中継してもらう
 * （Convex Auth はまだ jisui:// のようなアプリ独自の戻り先を受け付けないため）
 */
export const APP_URL = (process.env.EXPO_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

export const AUTH_RETURN_URL = "jisui://auth";
