# RunPod Serverless Worker — FLUX.1-schnell

テキストから画像を生成する RunPod Serverless ワーカーです。FLUX.1-schnell（Apache-2.0 / ゲートなし）を使います。

**方式: ネットワークボリューム + 遅延ダウンロード。** モデルはイメージに焼き込まず、初回起動時にボリューム (`/runpod-volume`) へダウンロードして永続キャッシュします。イメージは ~5GB と軽量で、33GB を自分でアップロードする必要がありません。

## 1. イメージのビルドとプッシュ（軽量）

`<your-dockerhub-user>` を自分の Docker Hub ユーザー名に置き換えてください。

```bash
cd runpod-worker

docker build --platform linux/amd64 -t <your-dockerhub-user>/flux-schnell-worker:latest .
docker push <your-dockerhub-user>/flux-schnell-worker:latest
```

> `--platform linux/amd64` は重要です。Apple Silicon (arm64) でビルドすると RunPod の GPU で動きません。

## 2. ネットワークボリュームを作成

RunPod Console → **Storage** → **New Network Volume**

- **サイズ**: 50GB 以上（モデルは ~33GB）
- **リージョン（データセンター）**: ここで選んだリージョンの GPU しか後で使えません。GPU 在庫が豊富なリージョンを選ぶのが無難。

## 3. Serverless Endpoint を作成

RunPod Console → **Serverless** → **New Endpoint**

1. **Container Image**: `<your-dockerhub-user>/flux-schnell-worker:latest`
2. **Network Volume**: 手順2で作ったボリュームを選択（マウント先は自動で `/runpod-volume`）
3. **GPU**: 24GB 以上（RTX 4090 / L4 / A5000 など）。ボリュームと同リージョンの GPU のみ選択可
   - 16GB GPU で動かす場合は環境変数 `ENABLE_CPU_OFFLOAD=1` を追加（遅くなります）
4. **Container Disk**: 10GB もあれば十分（モデルはボリューム側）
5. 作成後に表示される **Endpoint ID** を控える → Web アプリの `.env.local` に設定

> **初回リクエストのみ**モデルDLでコールドスタートが長くなります（RunPod の高速回線で取得）。2回目以降はボリュームのキャッシュを使うので速いです。
> 事前に温めておきたい場合は `builder/download_model.py` を参照（任意）。

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
  -d @test_input.json | python3 -c "import sys,json,base64; d=json.load(sys.stdin); open('out.png','wb').write(base64.b64decode(d['output']['image'])); print('saved out.png')"
```

## 代替: イメージ焼き込み方式

ボリュームを使わず全部イメージに含めたい場合は、Dockerfile の最後に以下を足し、`CMD` の前で実行します（イメージは ~33GB になります）。

```dockerfile
COPY builder/download_model.py builder/download_model.py
RUN python3 builder/download_model.py
```
