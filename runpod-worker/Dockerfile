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

# Install PyTorch (CUDA 12.1 wheels) first, then the rest.
RUN pip3 install --no-cache-dir \
        torch==2.4.1 \
        --index-url https://download.pytorch.org/whl/cu121

COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY handler.py .

CMD ["python3", "-u", "handler.py"]
