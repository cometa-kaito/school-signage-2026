"use client";

import { useEffect } from "react";

const RELOAD_FLAG_KEY = "kimiterasu_auto_reloaded_at";
const RELOAD_COOLDOWN_MS = 30_000;

function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { name?: string; message?: string };
  const name = e.name || "";
  const msg = e.message || "";
  return (
    name === "ChunkLoadError" ||
    /Loading chunk [\w-]+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg)
  );
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error boundary]", error);

    if (isChunkLoadError(error) && typeof window !== "undefined") {
      const last = Number(sessionStorage.getItem(RELOAD_FLAG_KEY) || 0);
      const now = Date.now();
      if (now - last > RELOAD_COOLDOWN_MS) {
        sessionStorage.setItem(RELOAD_FLAG_KEY, String(now));
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
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
          画面の表示中にエラーが発生しました
        </h2>
        <p style={{ margin: "0 0 20px", color: "#666", fontSize: "0.9rem" }}>
          ページを再読み込みすると復旧する場合があります。
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
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
            ページを再読み込み
          </button>
        </div>
        {error?.digest && (
          <p
            style={{
              margin: "16px 0 0",
              color: "#999",
              fontSize: "0.75rem",
              fontFamily: "monospace",
            }}
          >
            ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
