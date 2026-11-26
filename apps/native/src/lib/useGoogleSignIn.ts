import { api } from "@jisui/backend/api";
import { useSignInWithGoogle } from "@convex-dev/auth/methods/google/react";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { APP_URL, AUTH_RETURN_URL } from "./config";

type Status = "idle" | "pending" | "error";

/**
 * アプリ内ブラウザで Google にログインする。
 * 戻り先は Web 版の /native-callback で、そこから jisui://auth にコードを渡してもらい、
 * そのコードでログインを完了する
 */
export function useGoogleSignIn() {
  const { signIn } = useSignInWithGoogle(api.auth);
  const [status, setStatus] = useState<Status>("idle");

  async function start() {
    setStatus("pending");
    try {
      const started = await signIn({ redirectTo: `${APP_URL}/native-callback` });
      if (started.status !== "redirect") throw new Error("ログインを始められませんでした");
      const result = await WebBrowser.openAuthSessionAsync(started.redirect.toString(), AUTH_RETURN_URL);
      if (result.type !== "success") {
        setStatus("idle");
        return;
      }
      const { queryParams } = Linking.parse(result.url);
      const code = queryParams?.convexAuthCode;
      if (typeof code !== "string") throw new Error("ログインできませんでした");
      const completed = await signIn({ code });
      if (completed.status === "error") throw new Error("ログインできませんでした");
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return { start, status };
}
