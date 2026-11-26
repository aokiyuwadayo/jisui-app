"use client";

import { api } from "@jisui/backend/api";
import { useAction, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { PageTitle } from "@/components/ui/PageTitle";

/** MCP の OAuth 同意画面。連携先（Claude など）から飛んでくる */
export function AuthorizeView() {
  const params = useSearchParams();
  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const codeChallenge = params.get("code_challenge") ?? "";
  const state = params.get("state");
  const validRequest =
    params.get("response_type") === "code" &&
    params.get("code_challenge_method") === "S256" &&
    clientId !== "" &&
    redirectUri !== "" &&
    codeChallenge !== "";

  const client = useQuery(api.oauth.clientInfo, validRequest ? { clientId, redirectUri } : "skip");
  const approve = useAction(api.oauth.approve);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /** 登録済みのリダイレクト先にだけ戻す */
  function returnWith(values: Record<string, string>) {
    const url = new URL(redirectUri);
    for (const [k, v] of Object.entries(values)) url.searchParams.set(k, v);
    if (state) url.searchParams.set("state", state);
    window.location.assign(url.toString());
  }

  async function allow() {
    setBusy(true);
    try {
      returnWith({ code: await approve({ clientId, redirectUri, codeChallenge }) });
    } catch {
      setError("許可できませんでした。連携先でもう一度やり直してください");
      setBusy(false);
    }
  }

  if (!validRequest || client === null) {
    return (
      <section className="pt-2">
        <PageTitle eyebrow="CONNECT" title="連携の確認" />
        <p role="alert" className="rounded-2xl border border-dashed border-line px-5 py-6 text-sm text-mute">
          連携のリクエストが正しくありません。連携先でもう一度やり直してください。
        </p>
      </section>
    );
  }

  return (
    <section className="pt-2">
      <PageTitle eyebrow="CONNECT" title="連携の確認" />
      <div className="space-y-4 rounded-2xl bg-paper p-5">
        {client === undefined ? (
          <p className="text-sm text-mute">確認中…</p>
        ) : (
          <>
            <p className="text-sm leading-relaxed">
              <span className="font-bold">{client.name}</span>
              （{client.redirectHost}）が、jisui の在庫とレシピの読み書きを求めています。
            </p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-roast">
              <li>在庫の確認・追加・量の変更・削除</li>
              <li>レシピの確認・保存、料理の提案</li>
            </ul>
            <p className="text-xs text-mute">あとから「設定 → 外部連携」でいつでも解除できます。</p>
            {error && (
              <p role="alert" className="text-xs text-alert">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => returnWith({ error: "access_denied" })}
                className="rounded-full border border-line py-3 text-sm text-roast"
              >
                拒否
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void allow()}
                className="rounded-full bg-espresso py-3 text-sm font-medium text-cream disabled:opacity-60"
              >
                許可する
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
