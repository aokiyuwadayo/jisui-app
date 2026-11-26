"use client";

import { api } from "@jisui/backend/api";
import { CATEGORY_LABELS, STORAGE_LABELS, UNITS } from "@jisui/core";
import { useAction, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useRef, useState } from "react";

type Item = FunctionReturnType<typeof api.ai.readReceipt>[number] & { checked: boolean };

const MAX_SIDE = 1600;

/** 端末で縮小して JPEG の base64 にする（通信量と読み取り時間を抑える） */
async function toJpegBase64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1] ?? "";
}

const cellClass = "rounded-lg border border-line bg-cream px-2 py-1.5 text-[16px] outline-none focus:border-roast";

export function ReceiptImport({ onDone }: { onDone: () => void }) {
  const readReceipt = useAction(api.ai.readReceipt);
  const createMany = useMutation(api.ingredients.createMany);
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>();
  const [status, setStatus] = useState<"idle" | "reading" | "saving">("idle");
  const [error, setError] = useState("");

  async function read(file: File) {
    setStatus("reading");
    setError("");
    try {
      const imageBase64 = await toJpegBase64(file);
      const result = await readReceipt({ imageBase64, mediaType: "image/jpeg" });
      setItems(result.map((i) => ({ ...i, checked: true })));
      if (result.length === 0) setError("食材が見つかりませんでした");
    } catch (e) {
      setError(e instanceof ConvexError ? String(e.data) : "読み取れませんでした");
    } finally {
      setStatus("idle");
    }
  }

  function update(index: number, patch: Partial<Item>) {
    setItems((list) => list?.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function save() {
    const chosen = (items ?? []).filter((i) => i.checked && i.name.trim());
    if (chosen.length === 0) return;
    setStatus("saving");
    try {
      await createMany({
        items: chosen.map((i) => ({
          name: i.name.trim(),
          quantity: i.quantity,
          unit: i.unit,
          category: i.category,
          storage: i.storage,
          expiresOn: i.expiresOn,
          purchasedOn: i.purchasedOn,
        })),
      });
      onDone();
    } catch (e) {
      setError(e instanceof ConvexError ? String(e.data) : "保存できませんでした");
      setStatus("idle");
    }
  }

  const count = items?.filter((i) => i.checked).length ?? 0;

  return (
    <div className="space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="レシートの写真"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void read(file);
        }}
      />

      {!items && (
        <>
          <p className="text-sm leading-relaxed text-roast">
            レシートを撮るか写真を選ぶと、食材と期限の目安を読み取ります。保存前に確認・修正できます。
          </p>
          <button
            type="button"
            disabled={status === "reading"}
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-full bg-espresso py-3.5 text-sm font-medium text-cream disabled:opacity-60"
          >
            {status === "reading" ? "読み取り中…（10秒ほど）" : "写真を選ぶ・撮る"}
          </button>
        </>
      )}

      {error && (
        <p role="alert" className="text-xs text-alert">
          {error}
        </p>
      )}

      {items && items.length > 0 && (
        <>
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li
                key={`${i}-${item.name}`}
                className={`rounded-xl border border-line p-3 ${item.checked ? "bg-paper" : "bg-oat/50 opacity-60"}`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => update(i, { checked: e.target.checked })}
                    aria-label={`${item.name}を追加する`}
                    className="h-5 w-5 accent-terracotta"
                  />
                  <input
                    value={item.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    aria-label="名前"
                    className={`${cellClass} min-w-0 flex-1`}
                  />
                </div>
                <div className="mt-2 flex items-center gap-2 pl-7">
                  <input
                    inputMode="decimal"
                    value={item.quantity}
                    onChange={(e) => update(i, { quantity: Number(e.target.value) || 0 })}
                    aria-label="量"
                    className={`${cellClass} w-16 text-center`}
                  />
                  <select
                    value={item.unit}
                    onChange={(e) => update(i, { unit: e.target.value })}
                    aria-label="単位"
                    className={cellClass}
                  >
                    {UNITS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={item.expiresOn ?? ""}
                    onChange={(e) => update(i, { expiresOn: e.target.value || undefined })}
                    aria-label="期限"
                    className={`${cellClass} min-w-0 flex-1 text-sm`}
                  />
                </div>
                <p className="mt-1 pl-7 text-[11px] text-mute">
                  {STORAGE_LABELS[item.storage]}・{CATEGORY_LABELS[item.category]}
                </p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={status === "saving" || count === 0}
            onClick={() => void save()}
            className="w-full rounded-full bg-espresso py-3.5 text-sm font-medium text-cream disabled:opacity-60"
          >
            {count}件を冷蔵庫に入れる
          </button>
        </>
      )}
    </div>
  );
}
