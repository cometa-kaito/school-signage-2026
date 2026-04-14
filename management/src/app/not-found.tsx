import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0f2f5",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "40px",
          maxWidth: "440px",
          width: "90%",
          textAlign: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        }}
      >
        <h1
          style={{
            fontSize: "4rem",
            fontWeight: 700,
            color: "#667eea",
            margin: "0 0 8px",
          }}
        >
          404
        </h1>
        <h2
          style={{
            fontSize: "1.2rem",
            color: "#333",
            margin: "0 0 12px",
          }}
        >
          ページが見つかりません
        </h2>
        <p style={{ color: "#888", fontSize: "0.9rem", marginBottom: "24px" }}>
          お探しのページは移動または削除された可能性があります。
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "10px 28px",
            background: "#667eea",
            color: "white",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          トップページへ
        </Link>
      </div>
    </div>
  );
}
