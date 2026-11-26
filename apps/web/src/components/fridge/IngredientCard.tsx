"use client";

import { api } from "@jisui/backend/api";
import type { Doc } from "@jisui/backend/dataModel";
import { adjustQuantity, CATEGORY_LABELS, STORAGE_LABELS, stepFor } from "@jisui/core";
import { useMutation } from "convex/react";
import { ExpiryBadge } from "./ExpiryBadge";

export function IngredientCard({
  item,
  today,
  onOpen,
}: {
  item: Doc<"ingredients">;
  today: string;
  onOpen: () => void;
}) {
  const adjust = useMutation(api.ingredients.adjust).withOptimisticUpdate((store, { id, delta }) => {
    const list = store.getQuery(api.ingredients.list, {});
    if (!list) return;
    store.setQuery(
      api.ingredients.list,
      {},
      list.map((i) =>
        i._id === id ? { ...i, quantity: adjustQuantity(i.quantity, delta) } : i,
      ),
    );
  });
  const step = stepFor(item.unit);
  const countable = item.unit !== "適量";

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{item.name}</span>
          <ExpiryBadge expiresOn={item.expiresOn} today={today} />
        </div>
        <p className="mt-1 text-[11px] text-mute">
          {STORAGE_LABELS[item.storage]}・{CATEGORY_LABELS[item.category]}
        </p>
      </button>

      {countable ? (
        <div className="flex shrink-0 items-center rounded-full border border-line">
          <StepButton
            label={`${item.name}を減らす`}
            onClick={() => void adjust({ id: item._id, delta: -step })}
          >
            −
          </StepButton>
          <span className="min-w-14 text-center text-sm tabular-nums">
            {item.quantity}
            <span className="ml-0.5 text-[11px] text-mute">{item.unit}</span>
          </span>
          <StepButton
            label={`${item.name}を増やす`}
            onClick={() => void adjust({ id: item._id, delta: step })}
          >
            ＋
          </StepButton>
        </div>
      ) : (
        <span className="text-xs text-mute">適量</span>
      )}
    </li>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center text-roast active:scale-90"
    >
      {children}
    </button>
  );
}
