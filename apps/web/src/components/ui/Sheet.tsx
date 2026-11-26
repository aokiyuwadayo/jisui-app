"use client";

import { type ReactNode, useEffect, useRef } from "react";

/** 画面下から出るシート。dialog 要素で Esc・背景タップで閉じる */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-paper p-0 text-espresso backdrop:bg-espresso/40 sm:mx-auto sm:max-w-xl"
    >
      <div className="px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <h2 className="mb-5 font-serif text-xl font-bold">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
