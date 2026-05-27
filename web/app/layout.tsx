import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FLUX 画像生成",
  description: "RunPod Serverless + FLUX.1-schnell で動く画像生成アプリ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
