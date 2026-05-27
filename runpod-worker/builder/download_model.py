"""Optional: pre-warm the network volume with the FLUX.1-schnell weights.

With the network-volume setup the model downloads automatically on the first
cold start, so this script is OPTIONAL. Run it only if you want to populate the
volume ahead of time (e.g. from a temporary RunPod Pod that has the volume
mounted) so the very first serverless request isn't slow:

    HF_HOME=/runpod-volume/hf-cache python3 download_model.py

FLUX.1-schnell is Apache-2.0 and ungated, so no HF token is needed.
"""

import os

from huggingface_hub import snapshot_download

MODEL_ID = os.environ.get("MODEL_ID", "black-forest-labs/FLUX.1-schnell")

print(f"Downloading {MODEL_ID} into {os.environ.get('HF_HOME', '~/.cache/huggingface')} ...")
snapshot_download(
    repo_id=MODEL_ID,
    ignore_patterns=["*.gguf", "*.onnx", "*.pt", "*.ckpt", "*.md", "*.gitattributes"],
)
print("Done.")
