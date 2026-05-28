# FLUX.1-schnell serverless worker for RunPod, built on the official
# worker-comfyui base image. ComfyUI + the RunPod handler are already baked in;
# we only overlay model-path config and a model-download bootstrap.
#
# Build context is the REPOSITORY ROOT (paths below are relative to it):
#   docker build -f runpod-worker/Dockerfile -t flux-comfy-worker .
# RunPod's GitHub integration does the same thing automatically.
FROM runpod/worker-comfyui:5.3.0-base-cuda12.8.1

ENV HF_HUB_ENABLE_HF_TRANSFER=1

# hf_transfer + a recent huggingface_hub for fast multipart downloads onto the
# network volume. (huggingface_hub is already in the base image; this just pins
# a known-good version range.)
RUN pip install --no-cache-dir "huggingface_hub>=0.24.0" "hf_transfer>=0.1.6"

# Point ComfyUI at /runpod-volume/models/* (overrides the file shipped by the
# base image — ours adds `diffusion_models`).
COPY runpod-worker/extra_model_paths.yaml /comfyui/extra_model_paths.yaml

# Bootstrap that downloads FLUX weights into the network volume on first start.
COPY runpod-worker/download_models.py /download_models.py
COPY runpod-worker/runpod_start.sh /runpod_start.sh
RUN chmod +x /runpod_start.sh

# Override the base image's CMD so we run model bootstrap before the official
# /start.sh (which then runs ComfyUI + the RunPod handler).
CMD ["/runpod_start.sh"]
