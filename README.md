# jisui-app

自炊専念アプリ。食材と消費期限を管理し、手持ちの食材からおすすめの料理を提案する。

## 構成

| パス | 内容 |
|---|---|
| `apps/web` | Next.js（スマホ優先の Web / PWA） |
| `packages/backend` | Convex（DB・認証・API） |
| `packages/core` | Web / Mobile 共通の純粋ロジック（期限判定など） |

## 開発

```bash
pnpm install
pnpm --filter @jisui/backend dev   # Convex（初回はログインとプロジェクト作成）
pnpm --filter @jisui/web dev       # http://localhost:3000
```

`apps/web/.env.local` に `NEXT_PUBLIC_CONVEX_URL` を書く（`.env.example` 参照）。

## 認証のセットアップ（Google ログイン）

1. Google Cloud で OAuth クライアント（ウェブアプリケーション）を作る
   - 承認済みリダイレクト URI: `<CONVEX_SITE_URL>/oauth/google/callback`
2. Convex に環境変数を設定する

```bash
cd packages/backend
npx convex env set AUTH_GOOGLE_CLIENT_ID <クライアントID>
npx convex env set AUTH_GOOGLE_CLIENT_SECRET <クライアントシークレット>
npx convex env set ALLOWED_EMAILS <ログインを許可するメール（カンマ区切り）>
npx convex env set ALLOWED_REDIRECT_ORIGINS http://localhost:3000,<本番URL>
```

`ALLOWED_EMAILS` にないアカウントはログインできない。

## チェック

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
