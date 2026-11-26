import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-xl border border-line bg-cream px-3.5 py-2.5 text-[16px] outline-none focus:border-roast";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wider text-mute">
        {label}
        {hint && <span className="ml-2 font-normal tracking-normal">{hint}</span>}
      </p>
      {children}
    </div>
  );
}
