"use client";

import { api } from "@jisui/backend/api";
import type { Doc, Id } from "@jisui/backend/dataModel";
import {
  EQUIPMENT,
  formatIngredientLines,
  inferEquipment,
  parseIngredientLines,
  validateRecipe,
} from "@jisui/core";
import { useAction, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { Field, inputClass } from "@/components/ui/Field";
import { ToggleChips } from "@/components/ui/ToggleChips";

/** 保存前のレシピ。URL 読み込みや AI 提案からも渡される */
export type RecipeSeed = {
  title: string;
  sourceUrl?: string;
  imageUrl?: string;
  servings?: number;
  cookMinutes?: number;
  ingredients: { name: string; amount?: string; optional?: boolean }[];
  steps: string[];
  equipment: string[];
  tags: string[];
};

type Draft = {
  title: string;
  sourceUrl: string;
  imageUrl: string;
  servings: string;
  cookMinutes: string;
  ingredients: string;
  steps: string;
  equipment: string[];
  tags: string;
};

function toDraft(seed?: RecipeSeed): Draft {
  return {
    title: seed?.title ?? "",
    sourceUrl: seed?.sourceUrl ?? "",
    imageUrl: seed?.imageUrl ?? "",
    servings: seed?.servings ? String(seed.servings) : "",
    cookMinutes: seed?.cookMinutes ? String(seed.cookMinutes) : "",
    ingredients: formatIngredientLines(seed?.ingredients ?? []),
    steps: (seed?.steps ?? []).join("\n"),
    equipment: seed?.equipment ?? [],
    tags: (seed?.tags ?? []).join("、"),
  };
}

function errorMessage(e: unknown, fallback: string) {
  return e instanceof ConvexError ? String(e.data) : fallback;
}

export function RecipeForm({
  recipe,
  seed,
  onDone,
}: {
  /** 編集するとき */
  recipe?: Doc<"recipes">;
  /** 新規作成の初期値（AI 提案など） */
  seed?: RecipeSeed;
  onDone: (id: Id<"recipes">) => void;
}) {
  const [draft, setDraft] = useState(() => toDraft(recipe ?? seed));
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const importFromUrl = useAction(api.recipes.importFromUrl);
  const create = useMutation(api.recipes.create);
  const update = useMutation(api.recipes.update);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function runImport() {
    if (!url.trim()) return;
    setImporting(true);
    setErrors([]);
    try {
      setDraft(toDraft(await importFromUrl({ url })));
      setUrl("");
    } catch (e) {
      setErrors([errorMessage(e, "読み込めませんでした")]);
    } finally {
      setImporting(false);
    }
  }

  async function submit() {
    const steps = draft.steps
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      title: draft.title.trim(),
      sourceUrl: draft.sourceUrl.trim() || undefined,
      imageUrl: draft.imageUrl.trim() || undefined,
      servings: draft.servings ? Number(draft.servings) : undefined,
      cookMinutes: draft.cookMinutes ? Number(draft.cookMinutes) : undefined,
      ingredients: parseIngredientLines(draft.ingredients),
      steps,
      equipment: draft.equipment,
      tags: draft.tags
        .split(/[,、\s]+/)
        .map((t) => t.trim())
        .filter(Boolean),
    };
    const problems = validateRecipe(payload);
    setErrors(problems);
    if (problems.length > 0) return;
    setSaving(true);
    try {
      if (recipe) {
        await update({ id: recipe._id, ...payload });
        onDone(recipe._id);
      } else {
        onDone(await create(payload));
      }
    } catch (e) {
      setErrors([errorMessage(e, "保存できませんでした")]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-5"
    >
      {!recipe && (
        <div className="rounded-2xl bg-oat/60 p-4">
          <p className="mb-2 text-xs font-medium text-roast">レシピサイトの URL から読み込む</p>
          <div className="flex gap-2">
            <input
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              aria-label="レシピのURL"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => void runImport()}
              disabled={importing || !url.trim()}
              className="shrink-0 rounded-xl bg-roast px-4 text-sm text-cream disabled:opacity-50"
            >
              {importing ? "読込中…" : "読込"}
            </button>
          </div>
        </div>
      )}

      <Field label="料理名">
        <input
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="例：親子丼"
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="何人分">
          <input
            inputMode="numeric"
            value={draft.servings}
            onChange={(e) => set("servings", e.target.value)}
            className={inputClass}
            aria-label="何人分"
          />
        </Field>
        <Field label="調理時間（分）">
          <input
            inputMode="numeric"
            value={draft.cookMinutes}
            onChange={(e) => set("cookMinutes", e.target.value)}
            className={inputClass}
            aria-label="調理時間（分）"
          />
        </Field>
      </div>

      <Field label="材料" hint="1行に1つ。「（お好みで）」で任意に">
        <textarea
          value={draft.ingredients}
          onChange={(e) => set("ingredients", e.target.value)}
          rows={5}
          placeholder={"鶏もも肉 200g\n卵 2個\n三つ葉 適量 （お好みで）"}
          className={inputClass}
        />
      </Field>

      <Field label="作り方" hint="1行に1手順">
        <textarea
          value={draft.steps}
          onChange={(e) => set("steps", e.target.value)}
          rows={5}
          className={inputClass}
        />
      </Field>

      <Field label="使う器具">
        <ToggleChips
          label="使う器具"
          options={EQUIPMENT}
          value={draft.equipment}
          onChange={(v) => set("equipment", v)}
        />
        <button
          type="button"
          onClick={() => set("equipment", inferEquipment(draft.steps.split("\n")))}
          className="mt-2 text-xs text-mute underline underline-offset-4"
        >
          作り方から推測する
        </button>
      </Field>

      <Field label="タグ" hint="、で区切る">
        <input
          value={draft.tags}
          onChange={(e) => set("tags", e.target.value)}
          placeholder="丼、時短"
          className={inputClass}
        />
      </Field>

      <Field label="元のページ">
        <input
          type="url"
          value={draft.sourceUrl}
          onChange={(e) => set("sourceUrl", e.target.value)}
          placeholder="https://"
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
        {recipe ? "保存する" : "レシピブックに入れる"}
      </button>
    </form>
  );
}
