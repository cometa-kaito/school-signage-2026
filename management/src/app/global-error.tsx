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
          background: "#f7f8fa",
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans JP', sans-serif",
          color: "#111827",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            background: "#ffffff",
            padding: "28px 32px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 2px rgba(17,24,39,0.05)",
            textAlign: "center",
          }}
        >
          <h2 style={{ margin: "0 0 12px", color: "#111827", fontSize: 16, fontWeight: 600 }}>
            予期しないエラーが起きました
          </h2>
          <p style={{ margin: "0 0 20px", color: "#6b7280", fontSize: 13, lineHeight: 1.6 }}>
            もう一度お試しください。続くときはページを読み直してみてください。
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "8px 18px",
              background: "#2c5282",
              color: "#ffffff",
              border: "1px solid #2c5282",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              marginRight: 8,
              fontFamily: "inherit",
            }}
          >
            もう一度
          </button>
          <button
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            style={{
              padding: "8px 18px",
              background: "#ffffff",
              color: "#111827",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            ページを読み直す
          </button>
        </div>
      </body>
    </html>
  );
}
