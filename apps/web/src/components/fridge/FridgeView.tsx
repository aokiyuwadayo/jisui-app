"use client";

import { api } from "@jisui/backend/api";
import type { Doc, Id } from "@jisui/backend/dataModel";
import { expiryStatus, STORAGE_LABELS, STORAGES, type Storage, todayInTokyo } from "@jisui/core";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { Chips } from "@/components/ui/Chips";
import { Sheet } from "@/components/ui/Sheet";
import { IngredientCard } from "./IngredientCard";
import { IngredientForm } from "./IngredientForm";

type Filter = "all" | Storage | "seasoning";

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "すべて" },
  ...STORAGES.map((s) => ({ value: s, label: STORAGE_LABELS[s] })),
  { value: "seasoning", label: "調味料" },
];

function matches(item: Doc<"ingredients">, filter: Filter) {
  if (filter === "all") return item.category !== "seasoning";
  if (filter === "seasoning") return item.category === "seasoning";
  return item.storage === filter && item.category !== "seasoning";
}

export function FridgeView() {
  const items = useQuery(api.ingredients.list);
  const [filter, setFilter] = useState<Filter>("all");
  // undefined: 閉じている / "new": 追加 / Id: 編集
  const [editing, setEditing] = useState<Id<"ingredients"> | "new" | undefined>();
  const today = todayInTokyo();

  const visible = useMemo(() => (items ?? []).filter((i) => matches(i, filter)), [items, filter]);
  const urgent = useMemo(
    () =>
      (items ?? []).filter((i) => {
        const s = expiryStatus(i.expiresOn, today);
        return s === "expired" || s === "today" || s === "soon";
      }),
    [items, today],
  );
  const editingItem = items?.find((i) => i._id === editing);

  return (
    <section className="pt-2 pb-20">
      <div className="mb-5">
        <p className="text-xs tracking-[0.3em] text-mute">TODAY</p>
        <h2 className="mt-1 font-serif text-2xl font-bold">冷蔵庫</h2>
      </div>

      {urgent.length > 0 && (
        <div className="mb-5 rounded-2xl bg-terracotta/10 px-4 py-3">
          <p className="text-xs font-medium text-terracotta">早めに使いたい食材</p>
          <p className="mt-1 text-sm leading-relaxed">{urgent.map((i) => i.name).join("・")}</p>
        </div>
      )}

      <div className="mb-4">
        <Chips label="絞り込み" options={filters} value={filter} onChange={setFilter} />
      </div>

      {items === undefined ? (
        <p className="py-10 text-center text-sm text-mute">読み込み中…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-sm leading-relaxed text-mute">
          まだ何も入っていません。
          <br />
          右下の「＋」から追加しましょう。
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => (
            <IngredientCard
              key={item._id}
              item={item}
              today={today}
              onOpen={() => setEditing(item._id)}
            />
          ))}
        </ul>
      )}

      <button
        type="button"
        aria-label="食材を追加"
        onClick={() => setEditing("new")}
        className="fixed right-5 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] grid h-14 w-14 place-items-center rounded-full bg-terracotta text-2xl text-paper shadow-lg shadow-terracotta/30 active:scale-95"
      >
        ＋
      </button>

      <Sheet
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing === "new" ? "食材を追加" : "食材を編集"}
      >
        {editing !== undefined && (
          <IngredientForm
            key={editing}
            item={editingItem}
            today={today}
            onDone={() => setEditing(undefined)}
          />
        )}
      </Sheet>
    </section>
  );
}
