"use client";

import { api } from "@jisui/backend/api";
import type { Doc } from "@jisui/backend/dataModel";
import {
  addDays,
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
  type IngredientPreset,
  searchPresets,
  STORAGES,
  STORAGE_LABELS,
  type Storage,
  stepFor,
  UNITS,
  validateIngredient,
} from "@jisui/core";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useMemo, useState } from "react";
import { Chips } from "@/components/ui/Chips";

type Draft = {
  name: string;
  category: Category;
  storage: Storage;
  quantity: string;
  unit: string;
  expiresOn: string;
  purchasedOn: string;
  note: string;
};

function toDraft(item: Doc<"ingredients"> | undefined, today: string): Draft {
  if (!item) {
    return {
      name: "",
      category: "vegetable",
      storage: "fridge",
      quantity: "1",
      unit: "個",
      expiresOn: "",
      purchasedOn: today,
      note: "",
    };
  }
  return {
    name: item.name,
    category: item.category,
    storage: item.storage,
    quantity: String(item.quantity),
    unit: item.unit,
    expiresOn: item.expiresOn ?? "",
    purchasedOn: item.purchasedOn ?? "",
    note: item.note ?? "",
  };
}

const inputClass =
  "w-full rounded-xl border border-line bg-cream px-3.5 py-2.5 text-[16px] outline-none focus:border-roast";

export function IngredientForm({
  item,
  today,
  onDone,
}: {
  item?: Doc<"ingredients">;
  today: string;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(() => toDraft(item, today));
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const history = useQuery(api.ingredients.history);
  const create = useMutation(api.ingredients.create);
  const update = useMutation(api.ingredients.update);
  const remove = useMutation(api.ingredients.remove);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // 過去に登録したものを先に、続けてプリセット
  const suggestions = useMemo(() => {
    if (!showSuggest || !draft.name.trim()) return [];
    const fromHistory = searchPresets(
      draft.name,
      (history ?? []).map((h) => ({ ...h, kana: h.name }) as IngredientPreset),
      3,
    );
    const names = new Set(fromHistory.map((h) => h.name));
    const fromPresets = searchPresets(draft.name).filter((p) => !names.has(p.name));
    return [...fromHistory, ...fromPresets].slice(0, 6);
  }, [draft.name, history, showSuggest]);

  function applyPreset(preset: IngredientPreset) {
    setDraft((d) => ({
      ...d,
      name: preset.name,
      category: preset.category,
      storage: preset.storage,
      unit: preset.unit,
      quantity: preset.unit === "g" || preset.unit === "ml" ? "200" : "1",
      expiresOn: preset.shelfLifeDays
        ? (addDays(d.purchasedOn || today, preset.shelfLifeDays) ?? d.expiresOn)
        : d.expiresOn,
    }));
    setShowSuggest(false);
  }

  async function submit() {
    const payload = {
      name: draft.name.trim(),
      category: draft.category,
      storage: draft.storage,
      quantity: Number(draft.quantity),
      unit: draft.unit,
      expiresOn: draft.expiresOn || undefined,
      purchasedOn: draft.purchasedOn || undefined,
      note: draft.note.trim() || undefined,
    };
    const problems = validateIngredient(payload);
    setErrors(problems);
    if (problems.length > 0) return;
    setSaving(true);
    try {
      if (item) await update({ id: item._id, ...payload });
      else await create(payload);
      onDone();
    } catch (e) {
      setErrors([e instanceof ConvexError ? String(e.data) : "保存できませんでした"]);
    } finally {
      setSaving(false);
    }
  }

  async function removeAs(reason: "consumed" | "discarded") {
    if (!item) return;
    setSaving(true);
    try {
      await remove({ id: item._id, reason });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  const step = stepFor(draft.unit);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-5"
    >
      <Field label="名前">
        <div className="relative">
          <input
            value={draft.name}
            onChange={(e) => {
              set("name", e.target.value);
              setShowSuggest(true);
            }}
            placeholder="例：鶏むね肉、とりむね"
            className={inputClass}
            autoComplete="off"
          />
          {suggestions.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-line bg-paper shadow-lg">
              {suggestions.map((s) => (
                <li key={s.name}>
                  <button
                    type="button"
                    onClick={() => applyPreset(s)}
                    className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm hover:bg-oat"
                  >
                    <span>{s.name}</span>
                    <span className="text-[11px] text-mute">
                      {STORAGE_LABELS[s.storage]}
                      {s.shelfLifeDays ? `・目安${s.shelfLifeDays}日` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>

      <Field label="種類">
        <Chips
          label="種類"
          options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
          value={draft.category}
          onChange={(v) => set("category", v)}
        />
      </Field>

      <Field label="保存場所">
        <Chips
          label="保存場所"
          options={STORAGES.map((s) => ({ value: s, label: STORAGE_LABELS[s] }))}
          value={draft.storage}
          onChange={(v) => set("storage", v)}
        />
      </Field>

      <Field label="量">
        <div className="flex gap-2">
          <div className="flex flex-1 items-center rounded-xl border border-line bg-cream">
            <button
              type="button"
              aria-label="減らす"
              onClick={() => set("quantity", String(Math.max(0, Number(draft.quantity || 0) - step)))}
              className="h-11 w-11 text-roast"
            >
              −
            </button>
            <input
              inputMode="decimal"
              value={draft.quantity}
              onChange={(e) => set("quantity", e.target.value)}
              className="w-full bg-transparent text-center text-[16px] tabular-nums outline-none"
              aria-label="量"
            />
            <button
              type="button"
              aria-label="増やす"
              onClick={() => set("quantity", String(Number(draft.quantity || 0) + step))}
              className="h-11 w-11 text-roast"
            >
              ＋
            </button>
          </div>
          <select
            value={draft.unit}
            onChange={(e) => set("unit", e.target.value)}
            className="rounded-xl border border-line bg-cream px-3 text-[16px]"
            aria-label="単位"
          >
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
      </Field>

      <Field label="消費期限">
        <input
          type="date"
          value={draft.expiresOn}
          onChange={(e) => set("expiresOn", e.target.value)}
          className={inputClass}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {[1, 3, 7, 14].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => set("expiresOn", addDays(today, days) ?? "")}
              className="rounded-full bg-oat px-3 py-1 text-xs text-roast"
            >
              {days}日後
            </button>
          ))}
          <button
            type="button"
            onClick={() => set("expiresOn", "")}
            className="rounded-full px-3 py-1 text-xs text-mute"
          >
            なし
          </button>
        </div>
      </Field>

      <Field label="メモ">
        <input
          value={draft.note}
          onChange={(e) => set("note", e.target.value)}
          placeholder="半分使用済み など"
          className={inputClass}
        />
      </Field>

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 text-xs text-alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-full bg-espresso py-3.5 text-sm font-medium text-cream disabled:opacity-60"
      >
        {item ? "保存する" : "冷蔵庫に入れる"}
      </button>

      {item && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void removeAs("consumed")}
            className="rounded-full border border-sage py-3 text-sm text-sage"
          >
            使い切った
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void removeAs("discarded")}
            className="rounded-full border border-alert/60 py-3 text-sm text-alert"
          >
            捨てた
          </button>
        </div>
      )}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wider text-mute">{label}</p>
      {children}
    </div>
  );
}
