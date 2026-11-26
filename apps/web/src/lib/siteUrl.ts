/** Convex の HTTP エンドポイント（.convex.site）。ローカルではポートが1つ隣 */
export function convexSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
  if (url.includes(".convex.cloud")) return url.replace(".convex.cloud", ".convex.site").replace(/\/$/, "");
  const local = /^(https?:\/\/[^/:]+):(\d+)/.exec(url);
  if (local?.[1] && local[2]) return `${local[1]}:${Number(local[2]) + 1}`;
  return url;
}
