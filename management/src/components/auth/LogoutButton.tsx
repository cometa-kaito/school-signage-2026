"use client";

import { logout } from "@/lib/auth";
import { useAuthContext } from "@/providers/AuthProvider";

export function LogoutButton() {
  const { user, roleLabel } = useAuthContext();

  if (!user) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <span style={{ fontSize: "0.85rem", color: "#666" }}>
        {user.displayName || user.email}
        {roleLabel && (
          <span
            style={{
              marginLeft: "8px",
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "0.75rem",
              fontWeight: 600,
              background: "#667eea20",
              color: "#667eea",
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
          border: "1px solid #ddd",
          borderRadius: "6px",
          background: "white",
          cursor: "pointer",
          fontSize: "0.8rem",
        }}
      >
        ログアウト
      </button>
    </div>
  );
}
