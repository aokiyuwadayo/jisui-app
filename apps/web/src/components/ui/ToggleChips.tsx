"use client";

/** 複数選べるチップの並び */
export function ToggleChips({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? value.filter((v) => v !== o) : [...value, o])}
            className={`rounded-full border px-3.5 py-1.5 text-xs transition ${
              active ? "border-sage bg-sage text-paper" : "border-line bg-paper text-roast"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
