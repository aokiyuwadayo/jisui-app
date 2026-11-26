"use client";

import { api } from "@jisui/backend/api";
import type { Doc } from "@jisui/backend/dataModel";
import { matchRecipe, todayInTokyo } from "@jisui/core";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

export function RecipeDetail({
  recipe,
  onEdit,
  onDeleted,
}: {
  recipe: Doc<"recipes">;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const stock = useQuery(api.ingredients.list);
  const markCooked = useMutation(api.recipes.markCooked);
  const toggleFavorite = useMutation(api.recipes.toggleFavorite);
  const remove = useMutation(api.recipes.remove);
  const [cooked, setCooked] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const match = stock ? matchRecipe(recipe, stock, todayInTokyo()) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute">
        {recipe.cookMinutes && <span>{recipe.cookMinutes}分</span>}
        {recipe.servings && <span>{recipe.servings}人分</span>}
        {recipe.equipment.length > 0 && <span>{recipe.equipment.join("・")}</span>}
        {recipe.cookedCount > 0 && <span>{recipe.cookedCount}回作った</span>}
      </div>

      <section>
        <h3 className="mb-2 text-xs font-medium tracking-wider text-mute">材料</h3>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-cream/50">
          {recipe.ingredients.map((i) => {
            const have = match?.have.includes(i.name);
            return (
              <li key={i.name} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                <span
                  aria-label={have ? "在庫あり" : "在庫なし"}
                  className={`h-2 w-2 shrink-0 rounded-full ${have ? "bg-sage" : "border border-mute/50"}`}
                />
                <span className="flex-1">
                  {i.name}
                  {i.optional && <span className="ml-1 text-[11px] text-mute">お好みで</span>}
                </span>
                {i.amount && <span className="text-xs text-mute">{i.amount}</span>}
              </li>
            );
          })}
        </ul>
        {match && match.missing.length > 0 && (
          <p className="mt-2 text-xs text-terracotta">足りないもの：{match.missing.join("・")}</p>
        )}
      </section>

      {recipe.steps.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-medium tracking-wider text-mute">作り方</h3>
          <ol className="space-y-3">
            {recipe.steps.map((step, n) => (
              <li key={`${n}-${step}`} className="flex gap-3 text-sm leading-relaxed">
                <span className="font-serif text-terracotta">{n + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {recipe.sourceUrl && (
        <a
          href={recipe.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-xs text-roast underline underline-offset-4"
        >
          元のページを開く
        </a>
      )}

      <div className="space-y-2">
        <button
          type="button"
          disabled={cooked}
          onClick={() => void markCooked({ id: recipe._id }).then(() => setCooked(true))}
          className="w-full rounded-full bg-espresso py-3.5 text-sm font-medium text-cream disabled:opacity-60"
        >
          {cooked ? "記録しました" : "今日これを作った"}
        </button>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            aria-pressed={recipe.favorite}
            onClick={() => void toggleFavorite({ id: recipe._id })}
            className="rounded-full border border-line py-3 text-sm text-roast"
          >
            {recipe.favorite ? "★ お気に入り" : "☆ お気に入り"}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full border border-line py-3 text-sm text-roast"
          >
            編集
          </button>
          <button
            type="button"
            onClick={() =>
              confirmDelete
                ? void remove({ id: recipe._id }).then(onDeleted)
                : setConfirmDelete(true)
            }
            className="rounded-full border border-alert/60 py-3 text-sm text-alert"
          >
            {confirmDelete ? "本当に削除" : "削除"}
          </button>
        </div>
      </div>
    </div>
  );
}
