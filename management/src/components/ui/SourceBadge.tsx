"use client";

interface SourceBadgeProps {
  source?: string;
  /** compact=小型表示（アイコン＋略称）。デフォルトはラベル付き */
  compact?: boolean;
}

const SOURCE_STYLES: Record<
  string,
  { label: string; short: string; color: string; bg: string }
> = {
  school: { label: "学校マスター", short: "学校", color: "#fff", bg: "#007bff" },
  department: {
    label: "学科マスター",
    short: "学科",
    color: "#fff",
    bg: "#9b59b6",
  },
  grade: { label: "学年マスター", short: "学年", color: "#fff", bg: "#28a745" },
};

export function SourceBadge({ source, compact = false }: SourceBadgeProps) {
  if (!source) return null;
  const style = SOURCE_STYLES[source];
  if (!style) return null;
  return (
    <span
      style={{
        display: "inline-block",
        background: style.bg,
        color: style.color,
        padding: compact ? "1px 6px" : "2px 8px",
        borderRadius: 4,
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

export const SOURCE_COLOR_MAP = {
  school: "#007bff",
  department: "#9b59b6",
  grade: "#28a745",
} as const;
