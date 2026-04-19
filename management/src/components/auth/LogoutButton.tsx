"use client";

import { logout } from "@/lib/auth";
import { useAuthContext } from "@/providers/AuthProvider";

export function LogoutButton() {
  const { user, roleLabel } = useAuthContext();

  if (!user) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: "var(--fs-sm)", color: "var(--color-text-muted)" }}>
        {user.displayName || user.email}
        {roleLabel && (
          <span
            style={{
              marginLeft: 8,
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: "var(--fs-xs)",
              fontWeight: 600,
              background: "var(--color-accent-weak)",
              color: "var(--color-accent)",
              border: "1px solid var(--color-accent-line)",
            }}
          >
            {roleLabel}
          </span>
        )}
      </span>
      <button
        onClick={() => logout()}
        style={{
          padding: "6px 14px",
          border: "1px solid var(--color-line-strong)",
          borderRadius: "var(--radius-sm)",
          background: "var(--color-canvas)",
          color: "var(--color-text)",
          cursor: "pointer",
          fontSize: "var(--fs-sm)",
          fontFamily: "inherit",
        }}
      >
        ログアウト
      </button>
    </div>
  );
}
