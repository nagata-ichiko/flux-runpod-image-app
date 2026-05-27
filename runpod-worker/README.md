# RunPod Serverless Worker — FLUX.1-schnell

テキストから画像を生成する RunPod Serverless ワーカーです。FLUX.1-schnell（Apache-2.0 / ゲートなし）を使います。

- **モデル方式**: ネットワークボリューム + 遅延ダウンロード（初回起動時に `/runpod-volume` へDLしてキャッシュ。イメージは ~5GB と軽量）
- **デプロイ方式**: GitHub 連携（RunPod がリポジトリから自動ビルド。ローカル Docker 不要）

> ⚠️ ビルドコンテキストは**リポジトリのルート**です。Dockerfile 内の `COPY` はルート基準（`runpod-worker/...`）になっています。

---

## 方法A（推奨）: GitHub から RunPod に自動ビルドさせる

ローカルでの `docker build` / `docker push` も Docker Hub も不要です。

### 1. GitHub を RunPod に接続
RunPod Console → **Settings** → **Connections** の **GitHub** カードで **Connect** → 認可（リポジトリは "All" か対象リポジトリを選択）→ **Save**

### 2. ネットワークボリュームを作成
RunPod Console → **Storage** → **New Network Volume**
- **サイズ**: 50GB 以上（モデルは ~33GB）
- **リージョン**: ここで選んだリージョンの GPU しか後で使えません。GPU 在庫が豊富なリージョンを推奨

### 3. Endpoint を作成（GitHubから）
RunPod Console → **Serverless** → **New Endpoint** → **Import Git Repository**
- リポジトリ: `nagata-ichiko/flux-runpod-image-app`
- **Branch**: `main`
- **Dockerfile Path**: `runpod-worker/Dockerfile`  ← これだけ指定（コンテキストはルート固定）
- **Next** → 設定:
  - **Endpoint Name**: 任意
  - **Endpoint Type**: `Queue`
  - **GPU**: 24GB 以上（RTX 4090 / L4 / A5000 など、ボリュームと同リージョン）
  - **Network Volume**: 手順2のボリュームを選択（自動で `/runpod-volume` にマウント）
  - 16GB GPU で動かす場合は環境変数 `ENABLE_CPU_OFFLOAD=1` を追加（遅くなる）
- **Deploy Endpoint** → RunPod がビルド＆デプロイ

完了後に表示される **Endpoint ID** を控える → Web アプリの `.env.local` に設定。
以降、`main` に push するたび自動で再ビルドされます。

> GitHub ビルドの制約: イメージ 80GB 以下 / ビルド 160分以内 / ビルド時に GPU 不可。今回の構成はすべて満たしています（モデルDLは実行時なのでビルドにGPU不要）。

---

## 方法B（代替）: ローカルでビルドして push

Docker Hub 等を使う場合。**リポジトリのルートから**実行します（`runpod-worker/` の中ではない）。

```bash
# repo ルートで実行
docker build --platform linux/amd64 -f runpod-worker/Dockerfile -t <your-dockerhub-user>/flux-schnell-worker:latest .
docker push <your-dockerhub-user>/flux-schnell-worker:latest
```
あとは方法Aの手順2〜3と同様に、Container Image を指定して Endpoint を作成します。
`--platform linux/amd64` は必須（arm64 でビルドすると GPU で動きません）。

---

## 入力フォーマット

```json
{
  "input": {
    "prompt": "a red fox in a snowy forest",
    "width": 1024,
    "height": 1024,
    "num_inference_steps": 4,
    "seed": 42
  }
}
```

- `prompt`（必須）: 英語推奨
- `width` / `height`: 256〜1536（16の倍数に丸められます）
- `num_inference_steps`: 1〜8（schnell は 4 が標準）
- `seed`: 任意。固定すると再現可能

## 出力フォーマット

```json
{
  "image": "<base64 PNG>",
  "format": "png",
  "width": 1024,
  "height": 1024,
  "steps": 4,
  "seed": 42
}
```

## デプロイ後の動作確認 (curl)

```bash
curl -s -X POST https://api.runpod.ai/v2/<ENDPOINT_ID>/runsync \
  -H "Authorization: Bearer <RUNPOD_API_KEY>" \
  -H "Content-Type: application/json" \
  -d @runpod-worker/test_input.json | python3 -c "import sys,json,base64; d=json.load(sys.stdin); open('out.png','wb').write(base64.b64decode(d['output']['image'])); print('saved out.png')"
```

## 補足: イメージ焼き込み方式にしたい場合

ボリュームを使わず全部イメージに含めるなら、Dockerfile の `COPY runpod-worker/handler.py .` の前に以下を足します（イメージは ~33GB に）。

```dockerfile
COPY runpod-worker/builder/download_model.py builder/download_model.py
RUN python3 builder/download_model.py
```
