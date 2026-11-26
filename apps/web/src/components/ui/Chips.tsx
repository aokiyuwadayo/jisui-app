"use client";

/** 1つだけ選べるチップの並び */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`rounded-full border px-3.5 py-1.5 text-xs transition ${
              active
                ? "border-espresso bg-espresso text-cream"
                : "border-line bg-paper text-roast"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
