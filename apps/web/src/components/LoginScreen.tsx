"use client";

import { api } from "@jisui/backend/api";
import { useOauth, useSignInWithGoogle } from "@convex-dev/auth/methods/google/react";
import { useState } from "react";

export function LoginScreen() {
  const { signIn } = useSignInWithGoogle(api.auth);
  const { flowError } = useOauth();
  const [pending, setPending] = useState(false);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-8">
      <p className="text-xs tracking-[0.4em] text-mute">HOME KITCHEN</p>
      <h1 className="mt-3 font-serif text-5xl font-bold tracking-wide">jisui</h1>
      <p className="mt-4 text-center text-sm leading-relaxed text-roast">
        冷蔵庫の中身から、
        <br />
        今日の一皿を。
      </p>

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setPending(true);
          void signIn().catch(() => setPending(false));
        }}
        className="mt-12 w-full max-w-xs rounded-full bg-espresso px-6 py-3.5 text-sm font-medium text-cream transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "移動しています…" : "Google でログイン"}
      </button>

      {flowError && (
        <p role="alert" className="mt-4 max-w-xs text-center text-xs text-alert">
          ログインできませんでした。許可されたアカウントか確認してください。
        </p>
      )}
    </main>
  );
}
