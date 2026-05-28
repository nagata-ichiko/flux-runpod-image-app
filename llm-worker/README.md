# LLM Serverless Worker — Qwen3-8B (abliterated, Ollama版)

画像生成プロンプトの拡張・整形に使う LLM を、RunPod Serverless 上に立てる構成です。**コードを書く必要はなく、RunPod の Ollama テンプレートに環境変数を1つ渡すだけ**で立ち上がります。

- **モデル**: [`huihui_ai/qwen3-abliterated:8b`](https://ollama.com/huihui_ai/qwen3-abliterated)
  - Qwen3-8B-Instruct の **abliterated 版**（拒否ベクトルを除去した検閲フリー版）
  - Ollama レジストリ配布版（~5GB、40k context）
  - 日本語入力に強く、画像生成プロンプトの英訳・拡張に向く
- **テンプレート**: RunPod の **"Runpod Worker Ollama"** Quick Deploy テンプレート
- **API**: OpenAI 互換（`/openai/v1/chat/completions`）

> 別の選択肢として、フル精度 safetensors を使いたい場合は **vLLM テンプレート** + `MODEL_NAME=huihui-ai/Huihui-Qwen3-8B-abliterated-v2` で立てる手もあります。Ollama 版は GGUF 量子化込みで一番楽。

---

## デプロイ手順

### 1. Quick Deploy で Ollama テンプレートを選択

RunPod Console → **Serverless** → **New Endpoint** → **Quick Deploy** → **"Runpod Worker Ollama"**。

### 2. 設定

| 項目 | 値 |
|---|---|
| **GPU** | **L4 24GB** または **RTX 4090 24GB** で十分（8B GGUF は 16GB でも可） |
| **Min Workers** | 0（アイドル課金回避） |
| **Max Workers** | 1〜3 |
| **Idle Timeout** | 5〜10秒 |

### 3. 環境変数

| 変数 | 値 |
|---|---|
| `OLLAMA_MODEL_NAME` | `huihui_ai/qwen3-abliterated:8b` |

それ以外はテンプレートのデフォルトで OK（テンプレートが用意してる `phi3` などのデフォルト値があれば上書き）。

### 4. デプロイ → Endpoint ID を控える

完了後の Endpoint ID を `.env.local` に追加:

```bash
# web/.env.local
RUNPOD_LLM_ENDPOINT_ID=<エンドポイントID>
```

---

## API の使い方

OpenAI 互換なので **OpenAI SDK** がそのまま使えます。

### baseURL

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
  model: "huihui_ai/qwen3-abliterated:8b",
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userInput },
  ],
  temperature: 0.8,
  max_tokens: 512,
});

const expandedPrompt = completion.choices[0].message.content;
```

**注意**: リクエストの `model` フィールドは `OLLAMA_MODEL_NAME` と完全一致する必要があります。`huihui_ai/qwen3-abliterated:8b` を両方で使ってください。

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
