"use client";

import { type ReactNode } from "react";
import { useAuthContext } from "@/providers/AuthProvider";
import { Loading } from "@/components/ui/Loading";
import { LoginPage } from "./LoginPage";

interface AuthGuardProps {
  children: ReactNode;
  requiredRole?: "editor" | "admin" | "system_admin";
  loginMode?: "admin" | "editor";
}

export function AuthGuard({
  children,
  requiredRole = "editor",
  loginMode = "editor",
}: AuthGuardProps) {
  const { user, loading, isAdmin, isTeacher } = useAuthContext();

  if (loading) {
    return <Loading overlay message="認証を確認中..." />;
  }

  if (!user) {
    return <LoginPage mode={loginMode} />;
  }

  // ロールチェック
  if (requiredRole === "system_admin" && !isAdmin) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h2>アクセス権限がありません</h2>
        <p>この機能にはシステム管理者権限が必要です。</p>
      </div>
    );
  }

  if (requiredRole === "admin" && !isAdmin) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h2>アクセス権限がありません</h2>
        <p>この機能には管理者権限が必要です。</p>
      </div>
    );
  }

  if (requiredRole === "editor" && !isTeacher) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h2>アクセス権限がありません</h2>
        <p>この機能にはエディター以上の権限が必要です。</p>
      </div>
    );
  }

  return <>{children}</>;
}
