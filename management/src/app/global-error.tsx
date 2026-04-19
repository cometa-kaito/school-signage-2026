"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error boundary]", error);
  }, [error]);

  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8f9fa",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            background: "#fff",
            padding: "28px 32px",
            borderRadius: 12,
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            textAlign: "center",
          }}
        >
          <h2 style={{ margin: "0 0 12px", color: "#2c3e50", fontSize: "1.2rem" }}>
            予期しないエラーが発生しました
          </h2>
          <p style={{ margin: "0 0 20px", color: "#666", fontSize: "0.9rem" }}>
            ページを再読み込みしてください。
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "8px 18px",
              background: "#667eea",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: 600,
              marginRight: 8,
            }}
          >
            再試行
          </button>
          <button
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            style={{
              padding: "8px 18px",
              background: "#fff",
              color: "#667eea",
              border: "1px solid #667eea",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: 600,
            }}
          >
            再読み込み
          </button>
        </div>
      </body>
    </html>
  );
}
