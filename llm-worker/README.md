# LLM Serverless Worker — Qwen3-8B (abliterated)

画像生成プロンプトの拡張・整形に使う LLM を、RunPod Serverless 上に立てる構成です。**コードを書く必要はなく、RunPod 公式の vLLM プリビルドイメージを Console で設定するだけ**で立ち上がります。

- **モデル**: [`huihui-ai/Huihui-Qwen3-8B-abliterated-v2`](https://huggingface.co/huihui-ai/Huihui-Qwen3-8B-abliterated-v2)
  - Qwen3-8B-Instruct の **abliterated 版**（拒否ベクトルを除去した検閲フリー版）
  - 日本語入力に強く、画像生成プロンプトの英訳・拡張に向く
- **イメージ**: [`runpod/worker-v1-vllm`](https://github.com/runpod-workers/worker-vllm)（公式・プリビルド）
- **API**: OpenAI 互換（`/openai/v1/chat/completions`）

---

## デプロイ手順

### 1. RunPod Console で新規 Serverless Endpoint を作成

RunPod Console → **Serverless** → **New Endpoint** → **Quick Deploy** から **"vLLM"** テンプレートを選択（または **Custom** で下記イメージを指定）。

### 2. イメージ & モデル設定

| 項目 | 値 |
|---|---|
| **Container Image** | `runpod/worker-v1-vllm:latest`（または最新の固定タグ） |
| **GPU** | **L4 24GB** または **RTX 4090 24GB** で十分 |
| **Min Workers** | 0（アイドル課金回避） |
| **Max Workers** | 1〜3（同時リクエスト想定で） |
| **Idle Timeout** | 5〜10秒（短いほど安いが、コールドスタート頻発） |

### 3. 環境変数

| 変数 | 値 |
|---|---|
| `MODEL_NAME` | `huihui-ai/Huihui-Qwen3-8B-abliterated-v2` |
| `MAX_MODEL_LEN` | `8192` （プロンプト拡張なら十分。32k 等に上げると VRAM を食う） |
| `GPU_MEMORY_UTILIZATION` | `0.9` |
| `HF_TOKEN` | （任意）HF レート制限対策 |
| `TRUST_REMOTE_CODE` | `true` （Qwen 系は推奨） |

Network Volume は **無くてもよい**（モデルが ~16GB でコンテナ内 DL で済むため）。ただし頻繁にコールドスタートさせるならアタッチして `HF_HOME=/runpod-volume/hf-cache` を設定すれば DL の繰り返しを回避できます。

### 4. デプロイ → Endpoint ID を控える

完了後に表示される Endpoint ID を控えて、後で Web 側の `.env.local` に追加します。

---

## API の使い方

OpenAI 互換なので **OpenAI SDK** がそのまま使えます。

### baseURL とエンドポイント

```
https://api.runpod.ai/v2/<ENDPOINT_ID>/openai/v1
```

### TypeScript (OpenAI SDK)

```ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.RUNPOD_API_KEY!,
  baseURL: `https://api.runpod.ai/v2/${process.env.RUNPOD_LLM_ENDPOINT_ID}/openai/v1`,
});

const completion = await client.chat.completions.create({
  model: "huihui-ai/Huihui-Qwen3-8B-abliterated-v2",
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userInput },
  ],
  temperature: 0.8,
  max_tokens: 512,
});

const expandedPrompt = completion.choices[0].message.content;
```

### curl

```bash
curl -s -X POST "https://api.runpod.ai/v2/${RUNPOD_LLM_ENDPOINT_ID}/openai/v1/chat/completions" \
  -H "Authorization: Bearer ${RUNPOD_API_KEY}" \
  -H "Content-Type: application/json" \
  -d @llm-worker/test_input.json
```

サンプル入力: [`test_input.json`](./test_input.json)
画像プロンプト拡張用のシステムプロンプト雛形: [`system_prompt.md`](./system_prompt.md)

---

## コスト感

| GPU | 秒単価 (Serverless) | 1リクエスト (~1.5秒想定) | 月1000リクエスト |
|---|---|---|---|
| L4 24GB | $0.00044 | ~$0.0007 | ~$0.7 |
| RTX 4090 24GB | $0.00076 | ~$0.0011 | ~$1.1 |

OpenAI gpt-4o-mini と比べて **同等〜やや安い** 程度ですが、**検閲がないのが本質的な価値**です。

## 統合パイプライン

```
[Web UI] ユーザー入力 (日本語OK)
   ↓
[Web の API ルート] OpenAI SDK → RunPod LLM Endpoint (このリポジトリ)
   ↓ 拡張済み英語プロンプト
[Web の API ルート] Comfy ワークフロー JSON の CLIPTextEncode (6) に注入
   ↓
[RunPod Comfy Endpoint] FLUX で画像生成 (../runpod-worker/)
   ↓
[Web UI] 画像表示
```
