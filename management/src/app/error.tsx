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
        background: "var(--color-surface-muted)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          background: "var(--color-canvas)",
          padding: "28px 32px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-line)",
          boxShadow: "var(--shadow-1)",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            margin: "0 0 12px",
            color: "var(--color-text)",
            fontSize: "var(--fs-lg)",
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          画面をうまく開けませんでした
        </h2>
        <p
          style={{
            margin: "0 0 20px",
            color: "var(--color-text-muted)",
            fontSize: "var(--fs-sm)",
            lineHeight: 1.6,
          }}
        >
          もう一度お試しください。直らないときはページを読み直すと戻ることがあります。
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button
            onClick={() => reset()}
            style={{
              padding: "8px 18px",
              background: "var(--color-accent)",
              color: "var(--color-canvas)",
              border: "1px solid var(--color-accent)",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              fontSize: "var(--fs-sm)",
              fontWeight: 600,
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
              background: "var(--color-canvas)",
              color: "var(--color-text)",
              border: "1px solid var(--color-line-strong)",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              fontSize: "var(--fs-sm)",
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            ページを読み直す
          </button>
        </div>
        {error?.digest && (
          <p
            style={{
              margin: "16px 0 0",
              color: "var(--color-text-subtle)",
              fontSize: "var(--fs-xs)",
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
