"use client";

import { api } from "@jisui/backend/api";
import type { Id } from "@jisui/backend/dataModel";
import { compareByExpiry, EQUIPMENT } from "@jisui/core";
import { useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useMemo, useState } from "react";
import { RecipeDetail } from "@/components/recipes/RecipeDetail";
import { RecipeForm, type RecipeSeed } from "@/components/recipes/RecipeForm";
import { Field, inputClass } from "@/components/ui/Field";
import { PageTitle } from "@/components/ui/PageTitle";
import { Sheet } from "@/components/ui/Sheet";
import { ToggleChips } from "@/components/ui/ToggleChips";

type AiIdea = FunctionReturnType<typeof api.ai.suggest>[number];

type Panel =
  | { kind: "view" | "edit"; id: Id<"recipes"> }
  | { kind: "save"; seed: RecipeSeed }
  | undefined;

export function SuggestView() {
  const stock = useQuery(api.ingredients.list);
  const savedEquipment = useQuery(api.settings.equipment);
  // null: 設定に従う
  const [equipment, setEquipment] = useState<string[] | null>(null);
  const [mustUse, setMustUse] = useState<string[]>([]);
  const effectiveEquipment = equipment ?? savedEquipment ?? undefined;
  const suggestions = useQuery(api.suggestions.fromBook, {
    mustUse,
    equipment: effectiveEquipment,
  });
  const [panel, setPanel] = useState<Panel>();

  const stockNames = useMemo(
    () => [...new Set([...(stock ?? [])].filter((s) => s.category !== "seasoning").sort(compareByExpiry).map((s) => s.name))],
    [stock],
  );
  const recipes = useQuery(api.recipes.list);
  const current = panel && panel.kind !== "save" ? recipes?.find((r) => r._id === panel.id) : undefined;

  return (
    <section className="pt-2 pb-8">
      <PageTitle eyebrow="SUGGEST" title="今日なにつくる？" />

      <div className="mb-6 space-y-4 rounded-2xl bg-paper p-4">
        <Field label="使いたい食材" hint="期限が近い順">
          {stockNames.length > 0 ? (
            <ToggleChips label="使いたい食材" options={stockNames} value={mustUse} onChange={setMustUse} />
          ) : (
            <p className="text-xs text-mute">冷蔵庫に食材を登録すると選べます</p>
          )}
        </Field>
        <Field label="使える器具" hint={equipment === null ? "設定どおり" : undefined}>
          <ToggleChips
            label="使える器具"
            options={EQUIPMENT}
            value={effectiveEquipment ?? [...EQUIPMENT]}
            onChange={setEquipment}
          />
        </Field>
      </div>

      <h3 className="mb-2 font-serif text-lg font-bold">レシピブックから</h3>
      {suggestions === undefined ? (
        <p className="py-6 text-center text-sm text-mute">探しています…</p>
      ) : suggestions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-5 py-6 text-center text-sm text-mute">
          条件に合うレシピがありません。下の AI 提案を試してください。
        </p>
      ) : (
        <ul className="space-y-2">
          {suggestions.map((r) => (
            <li key={r._id}>
              <button
                type="button"
                onClick={() => setPanel({ kind: "view", id: r._id })}
                className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-left"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{r.title}</span>
                  {r.cookMinutes && <span className="shrink-0 text-[11px] text-mute">{r.cookMinutes}分</span>}
                </span>
                {r.match.urgent.length > 0 && (
                  <span className="mt-1 block text-[11px] text-terracotta">
                    早めに使いたい {r.match.urgent.join("・")} を使えます
                  </span>
                )}
                <span className="mt-1 block text-[11px] text-mute">
                  {r.match.missing.length === 0
                    ? "今ある材料で作れます"
                    : `足りないもの：${r.match.missing.join("・")}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <AiSuggest
        mustUse={mustUse}
        onSave={(idea) =>
          setPanel({
            kind: "save",
            seed: {
              title: idea.title,
              servings: idea.servings,
              cookMinutes: idea.cookMinutes,
              ingredients: idea.ingredients.map((i) => ({ name: i.name, amount: i.amount })),
              steps: idea.steps,
              equipment: idea.equipment.filter((e) => (EQUIPMENT as readonly string[]).includes(e)),
              tags: ["AI提案"],
            },
          })
        }
      />

      <Sheet
        open={panel !== undefined}
        onClose={() => setPanel(undefined)}
        title={panel?.kind === "save" ? "レシピブックに保存" : (current?.title ?? "")}
      >
        {panel?.kind === "view" && current && (
          <RecipeDetail
            recipe={current}
            onEdit={() => setPanel({ kind: "edit", id: current._id })}
            onDeleted={() => setPanel(undefined)}
          />
        )}
        {panel?.kind === "edit" && current && (
          <RecipeForm recipe={current} onDone={(id) => setPanel({ kind: "view", id })} />
        )}
        {panel?.kind === "save" && (
          <RecipeForm seed={panel.seed} onDone={(id) => setPanel({ kind: "view", id })} />
        )}
      </Sheet>
    </section>
  );
}

function AiSuggest({ mustUse, onSave }: { mustUse: string[]; onSave: (idea: AiIdea) => void }) {
  const suggest = useAction(api.ai.suggest);
  const [request, setRequest] = useState("");
  const [ideas, setIdeas] = useState<AiIdea[]>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setLoading(true);
    setError("");
    try {
      setIdeas(await suggest({ mustUse, request: request.trim() || undefined }));
    } catch (e) {
      setError(e instanceof ConvexError ? String(e.data) : "提案を作れませんでした");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 rounded-2xl border border-line bg-paper p-4">
      <h3 className="font-serif text-lg font-bold">AI に考えてもらう</h3>
      <p className="mt-1 text-xs leading-relaxed text-mute">
        在庫と器具から、期限が近い食材を優先した料理を3つ提案します。
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="希望（例：さっぱり、10分で）"
          aria-label="AI への希望"
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          className="shrink-0 rounded-xl bg-terracotta px-4 text-sm text-paper disabled:opacity-60"
        >
          {loading ? "考え中…" : "提案"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-alert">
          {error}
        </p>
      )}
      {ideas && (
        <ul className="mt-4 space-y-3">
          {ideas.map((idea) => (
            <li key={idea.title} className="rounded-xl bg-cream p-3">
              <p className="flex items-center justify-between gap-2">
                <span className="font-medium">{idea.title}</span>
                <span className="text-[11px] text-mute">{idea.cookMinutes}分</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-roast">{idea.reason}</p>
              <p className="mt-1 text-[11px] text-mute">
                {idea.ingredients.map((i) => (i.inStock ? i.name : `${i.name}（要購入）`)).join("・")}
              </p>
              <button
                type="button"
                onClick={() => onSave(idea)}
                className="mt-2 text-xs text-terracotta underline underline-offset-4"
              >
                レシピブックに保存
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
