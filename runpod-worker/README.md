# RunPod Serverless Worker — FLUX.1-schnell (ComfyUI ベース)

RunPod Serverless 上で **ComfyUI** を動かす FLUX.1-schnell ワーカーです。任意の ComfyUI ワークフロー (API 形式 JSON) をリクエストで投げて画像を生成できます。

- **ベースイメージ**: [`runpod/worker-comfyui:5.3.0-base-cuda12.8.1`](https://hub.docker.com/r/runpod/worker-comfyui)（ComfyUI + RunPod ハンドラ同梱）
- **モデル方式**: ネットワークボリューム + 遅延ダウンロード（初回起動時に `/runpod-volume/models/` へDL）
- **デプロイ方式**: GitHub 連携（RunPod がリポジトリから自動ビルド）
- **Pods/Serverless 両対応**: 同じイメージ・同じ Network Volume を共有可能

> ⚠️ ビルドコンテキストは**リポジトリのルート**です。Dockerfile 内の `COPY` はルート基準（`runpod-worker/...`）です。

---

## アーキテクチャ

```
リクエスト ──► RunPod Serverless ──► /runpod_start.sh ──► download_models.py
                                                       └─► /start.sh (公式)
                                                              ├─► ComfyUI server (background)
                                                              └─► /handler.py (RunPod handler)
```

1. コンテナ起動時に `runpod_start.sh` が走り、`/runpod-volume/models/` に必要な FLUX のウェイトが揃っているか確認（無ければ DL）。
2. その後、公式 `/start.sh` に処理を委譲して ComfyUI と RunPod ハンドラが起動。
3. ハンドラは `input.workflow` で受け取った Comfy API 形式 JSON を実行して、生成画像を base64 で返す。

---

## デプロイ手順（GitHub 連携）

### 1. GitHub を RunPod に接続
RunPod Console → **Settings** → **Connections** の **GitHub** カードで **Connect**。

### 2. ネットワークボリュームを作成
RunPod Console → **Storage** → **New Network Volume**
- **サイズ**: 100GB 以上推奨（FLUX 本体 ~24GB + VAE/CLIP/T5 + LoRA 等の余地）
- **リージョン**: 後で使う GPU と同じリージョン

### 3. Serverless Endpoint を作成
RunPod Console → **Serverless** → **New Endpoint** → **Import Git Repository**
- リポジトリ: 本リポジトリ
- **Branch**: `main`
- **Dockerfile Path**: `runpod-worker/Dockerfile`
- **GPU**: 24GB 以上（RTX 4090 / L4 / A5000 など、Volume と同リージョン）
- **Network Volume**: 手順2のボリューム（`/runpod-volume` にマウント）
- **環境変数**:
  - `HF_TOKEN` … 必須ではないが、Hugging Face のレート制限対策に推奨
- **Deploy Endpoint**

初回ジョブでモデル ~24GB を DL するため、最初の1回だけコールドスタートが長い（5〜10分）。2回目以降は Volume にキャッシュされているのですぐ動きます。

---

## 同じ構成を Pods でも動かす（ワークフロー開発用）

ComfyUI の GUI でノードを組み立てたいときは、**同じ Network Volume を Pods にもアタッチ**すると、Serverless と本物のモデル共有ができます。

1. RunPod Console → **Pods** → **Deploy**
2. **Custom Container Image** に同じイメージ（CI で push しているタグ）を指定するか、公式の `runpod/worker-comfyui:5.3.0-base-cuda12.8.1` を直接使用
3. **Container Start Command** を ComfyUI 直叩きに上書き:
   ```
   bash -c "python3 -u /download_models.py && python3 /comfyui/main.py --listen 0.0.0.0 --port 8188"
   ```
4. **HTTP Ports** に `8188` を追加
5. **Network Volume**: Serverless と同じものをマウント
6. デプロイ後、Pod の **Connect → HTTP Service [8188]** からブラウザで GUI へ

Pod の GUI でワークフローを作成 → **Save (API Format)** → `runpod-worker/workflows/` に置いて push、で Serverless 側でも同じワークフローが動きます。

---

## 入力フォーマット

ComfyUI API 形式の workflow JSON を `input.workflow` に渡します:

```json
{
  "input": {
    "workflow": { ... API 形式の Comfy ワークフロー ... }
  }
}
```

サンプル: [`test_input.json`](./test_input.json) / [`workflows/flux_schnell.json`](./workflows/flux_schnell.json)

ワークフローの作り方:
- ComfyUI の GUI で組み立て → **Save (API Format)** で JSON エクスポート（**通常の Save とは別物**なので注意）
- そのまま `input.workflow` に貼って投げる

## 出力フォーマット

公式 worker-comfyui の仕様に準拠:

```json
{
  "output": {
    "images": [
      {
        "filename": "flux_schnell_00001_.png",
        "type": "base64",
        "data": "<base64 PNG>"
      }
    ]
  }
}
```

S3 を設定すれば URL 返却にも変更可能（環境変数 `BUCKET_ENDPOINT_URL` などで設定 — 公式ドキュメント参照）。

## 動作確認 (curl)

```bash
curl -s -X POST https://api.runpod.ai/v2/<ENDPOINT_ID>/runsync \
  -H "Authorization: Bearer <RUNPOD_API_KEY>" \
  -H "Content-Type: application/json" \
  -d @runpod-worker/test_input.json
```

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| `Dockerfile` | 公式 `worker-comfyui:5.3.0-base-cuda12.8.1` をベースに、モデル DL ブートストラップを上乗せ |
| `runpod_start.sh` | `/start.sh`（公式）の前にモデル DL を走らせる shim |
| `download_models.py` | `/runpod-volume/models/` に FLUX のウェイトを DL（既存ファイルはスキップ） |
| `extra_model_paths.yaml` | ComfyUI に `/runpod-volume/models/*` を認識させる設定（公式版を上書き） |
| `workflows/flux_schnell.json` | サンプル ワークフロー（API 形式） |
| `test_input.json` | `curl` 用のサンプル入力 |

## カスタマイズ

- **モデル追加**: Pod 等で `/runpod-volume/models/<種別>/` に safetensors を置けば即使用可能
- **LoRA**: `/runpod-volume/models/loras/` に置いて、ワークフローに `LoraLoader` ノードを足す
- **ControlNet**: `/runpod-volume/models/controlnet/` に置く
- **カスタムノード**: Dockerfile に `RUN comfy-node-install <repo-url>` を追加するか、Pod 上の Comfy Manager から入れて Volume 経由で共有
