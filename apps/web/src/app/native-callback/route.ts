/**
 * ネイティブアプリの Google ログインの中継。
 * Convex Auth はまだ jisui:// のような戻り先を受け付けないので、ここで受けてアプリに渡す。
 * 渡すのはログイン用の2つの値だけで、行き先はアプリに固定する
 */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const forward = new URLSearchParams();
  for (const key of ["convexAuthCode", "convexAuthError"]) {
    const value = params.get(key);
    if (value) forward.set(key, value);
  }
  return new Response(null, {
    status: 302,
    headers: { Location: `jisui://auth?${forward.toString()}`, "Cache-Control": "no-store" },
  });
}
