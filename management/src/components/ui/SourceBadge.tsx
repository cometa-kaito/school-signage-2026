"use client";

interface SourceBadgeProps {
  source?: string;
  /** compact=小型表示（アイコン＋略称）。デフォルトはラベル付き */
  compact?: boolean;
}

// バッジはラベル文字列で種別を識別する（色のみに依存しない）。
// 3種とも同じ中立スタイルを使い、違いはテキストで伝える。
const SOURCE_STYLES: Record<string, { label: string; short: string }> = {
  school: { label: "学校で共通", short: "学校" },
  department: { label: "学科で共通", short: "学科" },
  grade: { label: "学年で共通", short: "学年" },
};

export function SourceBadge({ source, compact = false }: SourceBadgeProps) {
  if (!source) return null;
  const style = SOURCE_STYLES[source];
  if (!style) return null;
  return (
    <span
      style={{
        display: "inline-block",
        background: "var(--color-surface-muted)",
        color: "var(--color-text)",
        border: "1px solid var(--color-line)",
        padding: compact ? "1px 6px" : "2px 8px",
        borderRadius: 999,
        fontSize: compact ? "0.65rem" : "0.7rem",
        fontWeight: 600,
        marginRight: 6,
        verticalAlign: "middle",
        whiteSpace: "nowrap",
      }}
    >
      {compact ? style.short : style.label}
    </span>
  );
}

// 既存コードが参照している色マップは、トークン値の文字列に統一する。
export const SOURCE_COLOR_MAP = {
  school: "var(--color-accent)",
  department: "var(--color-accent)",
  grade: "var(--color-accent)",
} as const;
