"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/providers/AuthProvider";
import { LoginPage } from "@/components/auth/LoginPage";
import { Loading } from "@/components/ui/Loading";

export default function LoginRoute() {
  const { user, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/manage/editor");
    }
  }, [user, loading, router]);

  if (loading) {
    return <Loading overlay message="認証を確認中..." />;
  }

  if (user) {
    return <Loading message="リダイレクト中..." />;
  }

  return <LoginPage mode="editor" />;
}
