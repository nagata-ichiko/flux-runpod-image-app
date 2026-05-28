#!/usr/bin/env bash
# Shim that runs before the official worker-comfyui /start.sh.
# Ensures FLUX.1-schnell weights are present on the network volume, then
# hands control off to the upstream entrypoint (ComfyUI + RunPod handler).
set -e

echo "[runpod-shim] Ensuring FLUX.1-schnell weights are on the network volume..."
# Don't fail the container if DL has trouble — let ComfyUI come up so logs
# and error messages are visible via the RunPod console.
python3 -u /download_models.py || echo "[runpod-shim] WARNING: model download step reported errors; continuing anyway."

echo "[runpod-shim] Handing off to /start.sh"
exec /start.sh
