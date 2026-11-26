import { expiryLabel, expiryStatus } from "@jisui/core";

const styles = {
  expired: "bg-alert text-paper",
  today: "bg-terracotta text-paper",
  soon: "bg-terracotta/15 text-terracotta",
  ok: "bg-sage/15 text-sage",
  none: "bg-oat text-mute",
} as const;

export function ExpiryBadge({ expiresOn, today }: { expiresOn?: string; today: string }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${styles[expiryStatus(expiresOn, today)]}`}
    >
      {expiryLabel(expiresOn, today)}
    </span>
  );
}
