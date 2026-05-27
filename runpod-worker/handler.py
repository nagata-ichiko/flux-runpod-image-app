"""RunPod Serverless handler for FLUX.1-schnell text-to-image generation."""

import os

# Cache weights on the attached network volume (mounted at /runpod-volume) so
# the model downloads only once and persists across cold starts. Falls back to
# ephemeral container disk if no volume is attached. Must be set before any
# huggingface_hub / diffusers import.
_VOLUME = "/runpod-volume"
os.environ.setdefault(
    "HF_HOME",
    os.path.join(_VOLUME, "hf-cache") if os.path.isdir(_VOLUME) else "/app/hf-cache",
)

import base64
import io
import traceback

import runpod
import torch

MODEL_ID = os.environ.get("MODEL_ID", "black-forest-labs/FLUX.1-schnell")

MAX_STEPS = 8
MAX_SIZE = 1536

# Load the pipeline LAZILY on the first request, NOT at import time. Loading the
# ~33GB model at module import made the worker exceed RunPod's startup timeout
# and get killed before runpod.serverless.start() could run (crash loop, jobs
# stuck IN_QUEUE). Deferring it lets the worker become ready immediately; the
# heavy load happens inside the (long-timeout) job instead, and any load error
# is returned as the job result.
_pipe = None


def _get_pipe():
    global _pipe
    if _pipe is None:
        from diffusers import FluxPipeline

        print(f"Loading pipeline: {MODEL_ID} (cache: {os.environ['HF_HOME']})")
        pipe = FluxPipeline.from_pretrained(MODEL_ID, torch_dtype=torch.bfloat16)
        if os.environ.get("ENABLE_CPU_OFFLOAD") == "1":
            pipe.enable_model_cpu_offload()
        else:
            pipe.to("cuda")
        _pipe = pipe
        print("Pipeline ready.")
    return _pipe


def _clamp(value, lo, hi, default):
    try:
        value = int(value)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, value))


def handler(job):
    job_input = job.get("input", {})

    prompt = (job_input.get("prompt") or "").strip()
    if not prompt:
        return {"error": "prompt is required"}

    try:
        pipe = _get_pipe()
    except Exception as e:
        return {"error": f"model load failed: {e!r}", "traceback": traceback.format_exc()}

    width = _clamp(job_input.get("width", 1024), 256, MAX_SIZE, 1024)
    height = _clamp(job_input.get("height", 1024), 256, MAX_SIZE, 1024)
    # round to multiples of 16 (required by the VAE)
    width -= width % 16
    height -= height % 16
    steps = _clamp(job_input.get("num_inference_steps", 4), 1, MAX_STEPS, 4)

    seed = job_input.get("seed")
    generator = None
    if seed is not None:
        try:
            seed = int(seed)
            generator = torch.Generator("cpu").manual_seed(seed)
        except (TypeError, ValueError):
            seed = None

    try:
        image = pipe(
            prompt=prompt,
            width=width,
            height=height,
            num_inference_steps=steps,
            guidance_scale=0.0,  # schnell is guidance-distilled
            max_sequence_length=256,
            generator=generator,
        ).images[0]
    except Exception as e:
        return {"error": f"inference failed: {e!r}", "traceback": traceback.format_exc()}

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    image_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return {
        "image": image_b64,
        "format": "png",
        "width": width,
        "height": height,
        "steps": steps,
        "seed": seed,
    }


runpod.serverless.start({"handler": handler})
