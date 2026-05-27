import { NextRequest, NextResponse } from "next/server";

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
    return NextResponse.json({ error: "環境変数が未設定です" }, { status: 500 });
  }

  const { id } = await params;

  const res = await fetch(`https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/status/${id}`, {
    headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `RunPod エラー (${res.status}): ${text}` }, { status: 502 });
  }

  const data = await res.json();

  // RunPod status: IN_QUEUE | IN_PROGRESS | COMPLETED | FAILED
  if (data.status === "COMPLETED") {
    return NextResponse.json({ status: data.status, output: data.output });
  }
  if (data.status === "FAILED") {
    return NextResponse.json({ status: data.status, error: data.error ?? "生成に失敗しました" });
  }
  return NextResponse.json({ status: data.status });
}
