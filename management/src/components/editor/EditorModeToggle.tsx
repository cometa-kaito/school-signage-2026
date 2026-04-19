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
        gap: 6,
        padding: "6px 12px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--color-line-strong)",
        color: "var(--color-text)",
        background: "var(--color-canvas)",
        textDecoration: "none",
        fontSize: "var(--fs-sm)",
        fontWeight: 500,
        ...style,
      }}
      title={`${otherLabel}の画面に切り替える`}
    >
      {currentBasePath === "/manage/editor" ? "📱" : "🖥"} {otherLabel}に切り替え
    </a>
  );
}
