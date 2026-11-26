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

## AI 提案

「提案」画面の AI 提案は Claude API を使う。個人の Anthropic アカウントで API キーを作り、Convex に設定する。
未設定でもレシピブックからの提案は使える。

```bash
npx convex env set ANTHROPIC_API_KEY <APIキー>
```

## 外部連携（Muse・Claude・ChatGPT）

アプリの「設定 → 外部連携」でトークンを発行し、表示される URL と一緒に連携先へ登録する。
トークンは発行時に一度だけ表示される。漏れたら同じ画面で削除する。

| 連携先 | 登録するもの |
| --- | --- |
| OAuth 対応の MCP クライアント（claude.ai のカスタムコネクタ・ChatGPT のコネクタなど） | MCP の URL だけ。ブラウザで jisui の同意画面が開くので「許可する」 |
| ヘッダーを設定できる MCP クライアント（Claude Code など） | MCP の URL と `Authorization: Bearer <トークン>` ヘッダー |
| ChatGPT の GPT Actions | OpenAPI の URL を読み込み、認証は「API キー / Bearer」でトークン |
| HTTP で呼べるもの（Muse の自作ツールなど） | `POST <REST API の URL>/<ツール名>` に JSON。一覧は `GET /api/v1/tools` |

```bash
# 例: Claude Code
claude mcp add --transport http jisui https://<deployment>.convex.site/mcp \
  --header "Authorization: Bearer <トークン>"
```

OAuth の同意画面はアプリ側にあるので、Convex に アプリの URL を設定しておく（未設定なら `ALLOWED_REDIRECT_ORIGINS` の先頭）。

```bash
npx convex env set APP_URL https://<アプリのURL>
```

使えるツール: 在庫を見る・追加・量や期限を変える・外す、レシピを見る・URL から保存・保存、今日の料理の提案。

## チェック

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
