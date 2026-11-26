"use client";

/** 右下の追加ボタン */
export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="fixed right-5 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] grid h-14 w-14 place-items-center rounded-full bg-terracotta text-2xl text-paper shadow-lg shadow-terracotta/30 active:scale-95"
    >
      ＋
    </button>
  );
}
