/** カンマ区切りの許可リスト（環境変数）にメールアドレスが含まれるか */
export function isAllowedEmail(
  email: string | undefined | null,
  allowList: string | undefined,
): boolean {
  if (!email || !allowList) return false;
  const normalized = email.trim().toLowerCase();
  return allowList
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}
