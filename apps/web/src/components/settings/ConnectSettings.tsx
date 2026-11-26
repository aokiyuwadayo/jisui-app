"use client";

import { api } from "@jisui/backend/api";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { Field, inputClass } from "@/components/ui/Field";
import { convexSiteUrl } from "@/lib/siteUrl";

const dateFormat = new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", timeZone: "Asia/Tokyo" });

/** Muse・Claude・ChatGPT などから在庫とレシピを扱うための設定 */
export function ConnectSettings() {
  const tokens = useQuery(api.tokens.list);
  const createToken = useAction(api.tokens.create);
  const revoke = useMutation(api.tokens.revoke);
  const [name, setName] = useState("Muse");
  const [issued, setIssued] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const site = convexSiteUrl();

  async function issue() {
    setBusy(true);
    setError("");
    try {
      setIssued(await createToken({ name }));
    } catch (e) {
      setError(e instanceof ConvexError ? String(e.data) : "発行できませんでした");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 rounded-2xl bg-paper p-4">
      <div>
        <h3 className="font-serif text-lg font-bold">外部連携</h3>
        <p className="mt-1 text-xs leading-relaxed text-mute">
          Muse や Claude・ChatGPT から在庫の確認・追加、レシピの保存ができます。
          トークンを発行して、連携先に下の URL と一緒に登録してください。
        </p>
      </div>

      <Field label="接続先">
        <dl className="space-y-2 text-xs">
          <UrlRow label="MCP" url={`${site}/mcp`} />
          <UrlRow label="REST API" url={`${site}/api/v1/tools`} />
          <UrlRow label="OpenAPI" url={`${site}/api/v1/openapi.json`} />
        </dl>
      </Field>

      <Field label="トークンを発行">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="連携先の名前"
            placeholder="連携先の名前"
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => void issue()}
            disabled={busy}
            className="shrink-0 rounded-xl bg-roast px-4 text-sm text-cream disabled:opacity-50"
          >
            発行
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-xs text-alert">
            {error}
          </p>
        )}
        {issued && (
          <div className="mt-3 rounded-xl border border-terracotta/40 bg-terracotta/5 p-3">
            <p className="text-xs font-medium text-terracotta">この画面を閉じると二度と表示されません</p>
            <code className="mt-2 block break-all text-[11px]" data-testid="issued-token">
              {issued}
            </code>
            <CopyButton text={issued} />
          </div>
        )}
      </Field>

      {tokens && tokens.length > 0 && (
        <Field label="発行済み">
          <ul className="divide-y divide-line rounded-xl border border-line">
            {tokens.map((t) => (
              <li key={t._id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{t.name}</span>
                  <span className="text-[11px] text-mute">
                    …{t.hint}・{dateFormat.format(t.createdAt)}発行
                    {t.lastUsedAt ? `・${dateFormat.format(t.lastUsedAt)}に使用` : "・未使用"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void revoke({ id: t._id })}
                  className="shrink-0 text-xs text-alert"
                  aria-label={`${t.name}のトークンを削除`}
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        </Field>
      )}
    </div>
  );
}

function UrlRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="w-16 shrink-0 text-mute">{label}</dt>
      <dd className="min-w-0 flex-1 truncate font-mono text-[11px]">{url}</dd>
      <CopyButton text={url} small />
    </div>
  );
}

function CopyButton({ text, small }: { text: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
      className={small ? "shrink-0 text-[11px] text-roast" : "mt-2 text-xs text-roast underline underline-offset-4"}
    >
      {copied ? "コピーしました" : "コピー"}
    </button>
  );
}
