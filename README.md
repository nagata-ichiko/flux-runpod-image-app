# FLUX 画像生成アプリ

RunPod Serverless 上に **FLUX.1-schnell** の画像生成 API を立て、それを叩く **Next.js** Web アプリで画像を生成します。

```
┌─────────────┐     /api/generate      ┌──────────────────┐    POST /run    ┌────────────────────┐
│  ブラウザ    │ ──────────────────────▶│  Next.js (web/)   │ ───────────────▶│  RunPod Serverless  │
│  (UI)       │ ◀────── 画像(base64) ───│  サーバー側プロキシ │ ◀── status/結果 ─│  FLUX.1-schnell     │
└─────────────┘                         └──────────────────┘                 └────────────────────┘
```

RunPod の API キーは **Next.js のサーバー側だけ** で使い、ブラウザには渡しません。

## ⚠️ パブリックリポジトリでの注意

このリポジトリは公開前提です。`.gitignore` で `.env` 系を除外していますが、**APIキーやエンドポイントIDを絶対にコミットしないでください**。秘密情報は `web/.env.local`（git管理外）にのみ置きます。

## ディレクトリ

| パス | 役割 |
|------|------|
| `runpod-worker/` | RunPod にデプロイする Docker ワーカー（モデル本体） |
| `web/` | 画像生成 Web アプリ（Next.js） |

## セットアップ手順

### 1. RunPod 側（API を作る）

`runpod-worker/README.md` の手順でイメージをビルド＆プッシュし、Serverless Endpoint を作成します。完了すると **Endpoint ID** が手に入ります。

### 2. Web アプリ側

```bash
cd web
npm install
cp .env.local.example .env.local   # 中身を自分の値に編集
npm run dev
```

`.env.local`:

```
RUNPOD_API_KEY=...      # RunPod の API キー
RUNPOD_ENDPOINT_ID=...  # 手順1で控えたエンドポイントID
```

ブラウザで http://localhost:3000 を開き、プロンプトを入力して生成。

## コストの目安

- Serverless は **使った秒数だけ課金**。アイドル時は 0。
- 初回リクエストはコールドスタート（モデルロード）で数十秒かかることがあります。`Idle Timeout` を伸ばすとウォーム状態を保てます（その分課金）。
- FLUX.1-schnell は 4 ステップ生成なので、ウォーム時は 1 枚あたり数秒。

## デプロイ（任意）

Web アプリは Vercel 等にデプロイ可能。その場合 `RUNPOD_API_KEY` / `RUNPOD_ENDPOINT_ID` を環境変数として設定してください（コードには絶対に書かない）。
