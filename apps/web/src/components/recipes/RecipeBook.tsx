"use client";

import { api } from "@jisui/backend/api";
import type { Id } from "@jisui/backend/dataModel";
import {
  filterRecipes,
  RECIPE_SORT_LABELS,
  RECIPE_SORTS,
  type RecipeSort,
  sortRecipes,
} from "@jisui/core";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { Chips } from "@/components/ui/Chips";
import { Fab } from "@/components/ui/Fab";
import { inputClass } from "@/components/ui/Field";
import { PageTitle } from "@/components/ui/PageTitle";
import { Sheet } from "@/components/ui/Sheet";
import { RecipeDetail } from "./RecipeDetail";
import { RecipeForm } from "./RecipeForm";

type Quick = "all" | "favorite" | "15" | "30";

const quickFilters: { value: Quick; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "favorite", label: "★ お気に入り" },
  { value: "15", label: "15分以内" },
  { value: "30", label: "30分以内" },
];

/** シートの状態。閉じている / 新規 / 詳細 / 編集 */
type Panel = { kind: "new" } | { kind: "view" | "edit"; id: Id<"recipes"> } | undefined;

export function RecipeBook() {
  const recipes = useQuery(api.recipes.list);
  const [query, setQuery] = useState("");
  const [quick, setQuick] = useState<Quick>("all");
  const [tag, setTag] = useState<string>("");
  const [sort, setSort] = useState<RecipeSort>("recent");
  const [panel, setPanel] = useState<Panel>();

  const tags = useMemo(
    () => [...new Set((recipes ?? []).flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b, "ja")),
    [recipes],
  );

  const visible = useMemo(() => {
    const filtered = filterRecipes(recipes ?? [], {
      query: query.trim() || undefined,
      favoriteOnly: quick === "favorite",
      maxMinutes: quick === "15" || quick === "30" ? Number(quick) : undefined,
      tag: tag || undefined,
    });
    return sortRecipes(filtered, sort);
  }, [recipes, query, quick, tag, sort]);

  const current = panel && panel.kind !== "new" ? recipes?.find((r) => r._id === panel.id) : undefined;

  return (
    <section className="pt-2 pb-20">
      <PageTitle eyebrow="RECIPES" title="レシピブック" />

      <div className="mb-3 flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="料理名・材料で探す"
          aria-label="レシピを検索"
          className={inputClass}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as RecipeSort)}
          aria-label="並び替え"
          className="shrink-0 rounded-xl border border-line bg-cream px-2 text-sm"
        >
          {RECIPE_SORTS.map((s) => (
            <option key={s} value={s}>
              {RECIPE_SORT_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <Chips label="絞り込み" options={quickFilters} value={quick} onChange={setQuick} />
      </div>
      {tags.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tag === t}
              onClick={() => setTag(tag === t ? "" : t)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                tag === t ? "bg-terracotta text-paper" : "bg-oat text-roast"
              }`}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {recipes === undefined ? (
        <p className="py-10 text-center text-sm text-mute">読み込み中…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-sm leading-relaxed text-mute">
          {recipes.length === 0 ? (
            <>
              まだレシピがありません。
              <br />
              右下の「＋」から URL を読み込んで保存できます。
            </>
          ) : (
            "条件に合うレシピがありません。"
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => (
            <li key={r._id}>
              <button
                type="button"
                onClick={() => setPanel({ kind: "view", id: r._id })}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-paper p-3 text-left"
              >
                {r.imageUrl ? (
                  // 外部サイトの画像なので next/image の最適化は使わない
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-oat font-serif text-lg text-roast">
                    {r.title.slice(0, 1)}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    {r.favorite && <span className="text-terracotta">★</span>}
                    <span className="truncate font-medium">{r.title}</span>
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-mute">
                    {[
                      r.cookMinutes && `${r.cookMinutes}分`,
                      r.cookedCount > 0 && `${r.cookedCount}回`,
                      r.tags.map((t) => `#${t}`).join(" "),
                    ]
                      .filter(Boolean)
                      .join("・")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Fab label="レシピを追加" onClick={() => setPanel({ kind: "new" })} />

      <Sheet
        open={panel !== undefined}
        onClose={() => setPanel(undefined)}
        title={panel?.kind === "new" ? "レシピを追加" : (current?.title ?? "")}
      >
        {panel?.kind === "new" && (
          <RecipeForm key="new" onDone={(id) => setPanel({ kind: "view", id })} />
        )}
        {panel?.kind === "view" && current && (
          <RecipeDetail
            key={current._id}
            recipe={current}
            onEdit={() => setPanel({ kind: "edit", id: current._id })}
            onDeleted={() => setPanel(undefined)}
          />
        )}
        {panel?.kind === "edit" && current && (
          <RecipeForm
            key={`edit-${current._id}`}
            recipe={current}
            onDone={(id) => setPanel({ kind: "view", id })}
          />
        )}
      </Sheet>
    </section>
  );
}
