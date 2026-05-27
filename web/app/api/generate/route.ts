import { NextRequest, NextResponse } from "next/server";

// Secrets stay server-side only — never exposed to the browser.
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;

export async function POST(req: NextRequest) {
  if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
    return NextResponse.json(
      { error: "RUNPOD_API_KEY / RUNPOD_ENDPOINT_ID が未設定です (.env.local を確認してください)" },
      { status: 500 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const prompt = String(body.prompt ?? "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt は必須です" }, { status: 400 });
  }

  const input = {
    prompt,
    width: Number(body.width) || 1024,
    height: Number(body.height) || 1024,
    num_inference_steps: Number(body.num_inference_steps) || 4,
    ...(body.seed != null && body.seed !== "" ? { seed: Number(body.seed) } : {}),
  };

  const res = await fetch(`https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNPOD_API_KEY}`,
    },
    body: JSON.stringify({ input }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `RunPod エラー (${res.status}): ${text}` }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json({ id: data.id, status: data.status });
}
