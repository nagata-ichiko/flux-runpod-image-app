"use client";

import { useRef, useState } from "react";

type Phase = "idle" | "queued" | "running" | "done" | "error";

const STATUS_LABEL: Record<string, string> = {
  IN_QUEUE: "順番待ち…",
  IN_PROGRESS: "生成中…",
};

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [steps, setSteps] = useState(4);
  const [size, setSize] = useState(1024);
  const [seed, setSeed] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusText, setStatusText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ seed?: number; steps?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const busy = phase === "queued" || phase === "running";

  async function poll(id: string) {
    try {
      const res = await fetch(`/api/status/${id}`);
      const data = await res.json();

      if (data.status === "COMPLETED") {
        const b64: string | undefined = data.output?.image;
        if (!b64) {
          setPhase("error");
          setError("画像が返ってきませんでした");
          return;
        }
        setImage(`data:image/png;base64,${b64}`);
        setMeta({ seed: data.output?.seed, steps: data.output?.steps });
        setPhase("done");
        return;
      }
      if (data.status === "FAILED" || data.error) {
        setPhase("error");
        setError(typeof data.error === "string" ? data.error : "生成に失敗しました");
        return;
      }
      setPhase(data.status === "IN_PROGRESS" ? "running" : "queued");
      setStatusText(STATUS_LABEL[data.status] ?? "処理中…");
      timer.current = setTimeout(() => poll(id), 1500);
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "通信エラー");
    }
  }

  async function generate() {
    if (!prompt.trim() || busy) return;
    if (timer.current) clearTimeout(timer.current);
    setError(null);
    setImage(null);
    setMeta(null);
    setPhase("queued");
    setStatusText("リクエスト送信中…");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          num_inference_steps: steps,
          width: size,
          height: size,
          seed: seed === "" ? undefined : seed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhase("error");
        setError(data.error ?? "生成リクエストに失敗しました");
        return;
      }
      poll(data.id);
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "通信エラー");
    }
  }

  return (
    <main className="wrap">
      <h1>FLUX 画像生成</h1>
      <p className="sub">RunPod Serverless + FLUX.1-schnell</p>

      <div className="controls">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="生成したい画像を英語で記述（例: a red fox sitting in a snowy forest, soft morning light）"
          rows={4}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") generate();
          }}
        />

        <div className="row">
          <label>
            ステップ数
            <select value={steps} onChange={(e) => setSteps(Number(e.target.value))}>
              {[1, 2, 4, 6, 8].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            サイズ
            <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
              {[512, 768, 1024, 1280].map((n) => (
                <option key={n} value={n}>
                  {n}×{n}
                </option>
              ))}
            </select>
          </label>
          <label>
            シード（任意）
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="ランダム"
            />
          </label>
        </div>

        <button onClick={generate} disabled={busy || !prompt.trim()}>
          {busy ? statusText || "生成中…" : "画像を生成 (⌘/Ctrl+Enter)"}
        </button>
      </div>

      {error && <div className="error">⚠️ {error}</div>}

      <div className="stage">
        {busy && <div className="spinner" aria-label="loading" />}
        {image && (
          <figure>
            <img src={image} alt={prompt} />
            <figcaption>
              <a href={image} download="flux.png">
                ⬇ ダウンロード
              </a>
              {meta?.seed != null && <span>seed: {meta.seed}</span>}
              {meta?.steps != null && <span>steps: {meta.steps}</span>}
            </figcaption>
          </figure>
        )}
        {!busy && !image && <div className="placeholder">ここに生成画像が表示されます</div>}
      </div>
    </main>
  );
}
