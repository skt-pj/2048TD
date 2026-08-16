# 2048TD Ranking API

2048TD Android アプリ向けのオンラインランキング API です。Cloudflare Workers + D1 と TypeScript だけで構成し、Cloudflare の無料枠を前提にしています。

MVP では Android が申告した最終 SCORE を保存します。サーバー側でゲーム操作や SCORE を完全には再計算しないため、改変 APK などによる偽 SCORE を完全には検証できません。

## 現在の本番環境

- Workers URL: `https://2048td-ranking.yukigbr3100.workers.dev`
- D1 database名: `2048td-ranking`
- D1 binding名: `DB`

## 必要環境

- Node.js 22 以上
- npm 10 以上
- Cloudflare アカウント
- Wrangler で Cloudflare にログインできること

## セットアップ

```bash
cd 2048TD-ranking
npm install
```

## binding 一覧

| binding | 種類 | 用途 |
| --- | --- | --- |
| `DB` | D1 Database | run とプレイヤーごとの自己ベスト |
| `START_RATE_LIMITER` | Rate Limiting | `run/start` を playerId ごとに10回/60秒 |
| `FINISH_RATE_LIMITER` | Rate Limiting | `run/finish` を playerId ごとに10回/60秒 |
| `LEADERBOARD_RATE_LIMITER` | Rate Limiting | leaderboard を120回/60秒 |

秘密値を含む環境変数はありません。binding は `wrangler.jsonc` で管理します。Android アプリを理由とした `Access-Control-Allow-Origin: *` は設定していません。

## D1 の作成と binding 設定

初回のみ Cloudflare にログインし、D1 を作成します。

```bash
npx wrangler login
npx wrangler d1 create 2048td-ranking
```

出力された `database_id` を `wrangler.jsonc` の `d1_databases[0].database_id` に設定します。binding 名は仕様どおり `DB` のまま変更しません。

## migration

DB変更は `migrations/*.sql` だけで管理します。

ローカル D1:

```bash
npx wrangler d1 migrations apply DB --local
```

本番 D1:

```bash
npx wrangler d1 migrations apply DB --remote
```

適用状況:

```bash
npx wrangler d1 migrations list DB --local
npx wrangler d1 migrations list DB --remote
```

## テストと typecheck

自動テストは Workers ランタイムと実 D1 binding のローカル実装上で動作します。

```bash
npm test
npm run typecheck
```

テスト対象には正常 start/finish、二重 finish、存在しない run、player/ruleset 不一致、全入力境界、自己ベスト更新条件、ruleset 分離、4段階の順位条件、limit、SQL injection、rate limit、内部エラー秘匿を含みます。

## ローカル起動

先にローカル migration を適用し、Wrangler を起動します。

```bash
npx wrangler d1 migrations apply DB --local
npx wrangler dev
```

既定では `http://localhost:8787` で待ち受けます。

## deploy

本番 D1 の migration を先に適用してから Worker を deploy します。

```bash
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
```

deploy 後、Wrangler が表示した `https://...workers.dev` に対して health を確認します。

```bash
curl https://YOUR-WORKER.workers.dev/v1/health
```

## API 使用例

以下ではローカル URL を使います。本番では `BASE_URL` を公開 Workers URL に置き換えてください。

```bash
BASE_URL=http://localhost:8787
PLAYER_ID=39bf127f-ec68-4c82-94e3-5f09b32242ba
```

### Health

```bash
curl "$BASE_URL/v1/health"
```

### run 開始

```bash
curl -X POST "$BASE_URL/v1/runs/start" \
  -H 'Content-Type: application/json' \
  -d '{
    "playerId": "39bf127f-ec68-4c82-94e3-5f09b32242ba",
    "displayName": "PLAYER",
    "appVersion": "0.1.5",
    "versionCode": 6,
    "rulesetVersion": 1
  }'
```

レスポンスの `runId` はゲーム終了まで保持します。

### run 終了

```bash
RUN_ID=be04ad51-bbca-45cb-8ba3-6b101671ac75

curl -X POST "$BASE_URL/v1/runs/finish" \
  -H 'Content-Type: application/json' \
  -d "{
    \"runId\": \"$RUN_ID\",
    \"playerId\": \"$PLAYER_ID\",
    \"score\": 18432,
    \"wave\": 17,
    \"maxTile\": 512,
    \"elapsedMs\": 463221,
    \"gameOverReason\": \"HP_ZERO\",
    \"appVersion\": \"0.1.5\",
    \"versionCode\": 6,
    \"rulesetVersion\": 1
  }"
```

`HP_ZERO` または `BOARD_STUCK` のゲームオーバーだけを送信します。手動終了とリトライは送信しません。同じ `runId` の再送は、まだ `STARTED` なら受理され、完了済みなら `409 RUN_ALREADY_FINISHED` になります。

### TOP 100

```bash
curl "$BASE_URL/v1/leaderboard?rulesetVersion=1&limit=100"
```

`rulesetVersion` は必須、`limit` は既定100、最小1、最大100です。

### 自分の順位

```bash
curl "$BASE_URL/v1/players/$PLAYER_ID/rank?rulesetVersion=1"
```

## D1 データ確認

ローカル:

```bash
npx wrangler d1 execute DB --local \
  --command "SELECT run_id, player_id, status, score FROM runs; SELECT ruleset_version, player_id, best_score FROM leaderboard;"
```

本番:

```bash
npx wrangler d1 execute DB --remote \
  --command "SELECT status, COUNT(*) AS count FROM runs GROUP BY status; SELECT ruleset_version, COUNT(*) AS players FROM leaderboard GROUP BY ruleset_version;"
```
