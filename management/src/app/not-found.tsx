import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-surface-muted)",
        fontFamily: "var(--font-sans)",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "var(--color-canvas)",
          borderRadius: "var(--radius-lg)",
          padding: 40,
          maxWidth: 440,
          width: "90%",
          textAlign: "center",
          border: "1px solid var(--color-line)",
          boxShadow: "var(--shadow-1)",
        }}
      >
        <h1
          style={{
            fontSize: "3.5rem",
            fontWeight: 600,
            color: "var(--color-text)",
            letterSpacing: "-0.02em",
            margin: "0 0 8px",
          }}
        >
          404
        </h1>
        <h2
          style={{
            fontSize: "var(--fs-lg)",
            color: "var(--color-text)",
            fontWeight: 600,
            margin: "0 0 12px",
          }}
        >
          ページが見つかりませんでした
        </h2>
        <p
          style={{
            color: "var(--color-text-muted)",
            fontSize: "var(--fs-sm)",
            marginBottom: 24,
            lineHeight: 1.6,
          }}
        >
          お探しのページは移動したか、見つけられませんでした。
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "10px 24px",
            background: "var(--color-accent)",
            color: "var(--color-canvas)",
            borderRadius: "var(--radius-md)",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "var(--fs-md)",
          }}
        >
          トップに戻る
        </Link>
      </div>
    </div>
  );
}
