"use client";

interface EditIconButtonProps {
  onClick: () => void;
  /** アクセシビリティ用ラベル（title/aria-label） */
  label?: string;
  size?: "sm" | "md";
}

export function EditIconButton({
  onClick,
  label = "名前を変更",
  size = "sm",
}: EditIconButtonProps) {
  const dim = size === "sm" ? 22 : 28;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={label}
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: dim,
        height: dim,
        marginLeft: 6,
        padding: 0,
        border: "1px solid #ddd",
        background: "#fff",
        borderRadius: 6,
        cursor: "pointer",
        verticalAlign: "middle",
        color: "#666",
        lineHeight: 1,
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size === "sm" ? 13 : 16}
        height={size === "sm" ? 13 : 16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    </button>
  );
}
