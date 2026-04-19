"use client";

import { useSearchParams } from "next/navigation";

interface EditorModeToggleProps {
  /** 現在のページのベースパス */
  currentBasePath: "/manage/editor" | "/manage/editor-mobile";
  style?: React.CSSProperties;
}

/**
 * PC版エディター (/manage/editor) とスマホ版エディター (/manage/editor-mobile)
 * の間を切り替えるトグルリンク。クエリパラメータをそのまま引き継ぐ。
 */
export function EditorModeToggle({
  currentBasePath,
  style,
}: EditorModeToggleProps) {
  const searchParams = useSearchParams();
  const otherPath =
    currentBasePath === "/manage/editor"
      ? "/manage/editor-mobile"
      : "/manage/editor";
  const otherLabel = currentBasePath === "/manage/editor" ? "スマホ版" : "PC版";
  const qs = searchParams.toString();
  const href = qs ? `${otherPath}?${qs}` : otherPath;

  return (
    <a
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: 6,
        border: "1px solid #667eea",
        color: "#667eea",
        background: "#fff",
        textDecoration: "none",
        fontSize: "0.85rem",
        fontWeight: 600,
        ...style,
      }}
      title={`${otherLabel}エディターに切替`}
    >
      {currentBasePath === "/manage/editor" ? "📱" : "🖥️"} {otherLabel}に切替
    </a>
  );
}
