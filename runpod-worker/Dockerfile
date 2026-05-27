# FLUX.1-schnell serverless worker for RunPod (network-volume / lazy-download)
# The model is NOT baked in — it is downloaded on first cold start to the
# attached network volume (/runpod-volume) and cached there. Keeps this image small.
FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HUB_ENABLE_HF_TRANSFER=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# NOTE: paths below are relative to the REPOSITORY ROOT, because RunPod's
# GitHub build (and `docker build -f runpod-worker/Dockerfile .`) uses the repo
# root as the build context. Build locally from the repo root, not from here.

# Install PyTorch with CUDA 12.8 wheels — these include Blackwell (sm_120)
# kernels required by RunPod's newer GPUs (e.g. RTX PRO 6000 Blackwell). The
# cu121 wheels only went up to sm_90 and crashed on Blackwell with
# "no kernel image is available for execution on the device". cu128 also runs
# on older Ampere/Ada/Hopper GPUs, so it works regardless of what RunPod assigns.
RUN pip3 install --no-cache-dir \
        torch==2.7.0 \
        --index-url https://download.pytorch.org/whl/cu128

COPY runpod-worker/requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY runpod-worker/handler.py .

CMD ["python3", "-u", "handler.py"]
