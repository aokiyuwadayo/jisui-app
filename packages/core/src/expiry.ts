export type ExpiryStatus = "expired" | "today" | "soon" | "ok" | "none";

/** 「もうすぐ」とみなす残り日数 */
export const SOON_THRESHOLD_DAYS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD を UTC 0時の時刻に変換する。不正な値は null */
export function parseDate(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d] = m.map(Number) as [number, number, number, number];
  const time = Date.UTC(y, mo - 1, d);
  const check = new Date(time);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return time;
}

/** today から expiresOn までの日数。過ぎていれば負 */
export function daysUntil(expiresOn: string, today: string): number | null {
  const a = parseDate(today);
  const b = parseDate(expiresOn);
  if (a === null || b === null) return null;
  return Math.round((b - a) / DAY_MS);
}

export function expiryStatus(
  expiresOn: string | undefined,
  today: string,
): ExpiryStatus {
  if (!expiresOn) return "none";
  const days = daysUntil(expiresOn, today);
  if (days === null) return "none";
  if (days < 0) return "expired";
  if (days === 0) return "today";
  if (days <= SOON_THRESHOLD_DAYS) return "soon";
  return "ok";
}

/** 日本時間での今日を YYYY-MM-DD で返す */
export function todayInTokyo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);
}

export function addDays(date: string, days: number): string | null {
  const time = parseDate(date);
  if (time === null) return null;
  return new Date(time + days * DAY_MS).toISOString().slice(0, 10);
}

/** 一覧に出す期限の短い表示 */
export function expiryLabel(expiresOn: string | undefined, today: string): string {
  if (!expiresOn) return "期限なし";
  const days = daysUntil(expiresOn, today);
  if (days === null) return "期限なし";
  if (days < 0) return `${-days}日過ぎ`;
  if (days === 0) return "今日まで";
  if (days <= 6) return `あと${days}日`;
  const [, m, d] = expiresOn.split("-");
  return `${Number(m)}/${Number(d)}まで`;
}
