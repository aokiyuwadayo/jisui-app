// トークン・認可コード用の小さな暗号ヘルパー（Web Crypto のみ）

export function toHex(bytes: ArrayBuffer | Uint8Array) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function base64url(bytes: ArrayBuffer | Uint8Array) {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(text: string) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
}

/** 保存用のハッシュ（16進） */
export async function hashToken(token: string) {
  return toHex(await sha256(token));
}

/** PKCE（S256）の code_challenge を計算する */
export async function pkceChallenge(verifier: string) {
  return base64url(await sha256(verifier));
}

/**
 * 推測できないランダムな文字列。
 * クエリ・ミューテーションの乱数は再現性のため固定されるので、アクションか HTTP アクションで呼ぶ
 */
export function randomToken(prefix: string) {
  return prefix + toHex(crypto.getRandomValues(new Uint8Array(32)));
}
