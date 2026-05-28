"""Download FLUX.1-schnell weights to the RunPod network volume on first boot.

Skips any file that already exists, so subsequent cold starts cost nothing.
Run as part of the container startup (see start.sh).

File layout (matches ComfyUI's expected directory structure, see
extra_model_paths.yaml):

  /runpod-volume/models/unet/flux1-schnell.safetensors
  /runpod-volume/models/vae/ae.safetensors
  /runpod-volume/models/clip/clip_l.safetensors
  /runpod-volume/models/clip/t5xxl_fp8_e4m3fn.safetensors
"""

import os
import sys

from huggingface_hub import hf_hub_download

VOLUME = "/runpod-volume"
MODELS_ROOT = os.path.join(VOLUME, "models")

# (repo_id, filename_in_repo, target_subdir_under_models)
FILES = [
    ("black-forest-labs/FLUX.1-schnell", "flux1-schnell.safetensors", "unet"),
    ("black-forest-labs/FLUX.1-schnell", "ae.safetensors", "vae"),
    ("comfyanonymous/flux_text_encoders", "clip_l.safetensors", "clip"),
    ("comfyanonymous/flux_text_encoders", "t5xxl_fp8_e4m3fn.safetensors", "clip"),
]


def _hf_token():
    return os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")


def main():
    if not os.path.isdir(VOLUME):
        print(f"[download_models] {VOLUME} not mounted — skipping (image-only mode).")
        return

    token = _hf_token()
    print(f"[download_models] hf_token={'set' if token else 'MISSING'}")

    for repo_id, filename, subdir in FILES:
        target_dir = os.path.join(MODELS_ROOT, subdir)
        target_path = os.path.join(target_dir, filename)
        if os.path.exists(target_path):
            print(f"[download_models] skip (exists): {target_path}")
            continue
        os.makedirs(target_dir, exist_ok=True)
        print(f"[download_models] downloading {repo_id}/{filename} -> {target_path}")
        # Download straight into the target dir (no symlinks into a separate
        # hub cache) so the file lives where ComfyUI expects it.
        hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            local_dir=target_dir,
            token=token,
        )

    print("[download_models] done.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # Don't kill the container — let ComfyUI start anyway so the user can
        # inspect logs. Inference will surface a clearer error if a file is missing.
        print(f"[download_models] ERROR: {e!r}", file=sys.stderr)
