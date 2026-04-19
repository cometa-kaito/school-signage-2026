"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuthContext } from "@/providers/AuthProvider";
import { Loading } from "@/components/ui/Loading";

export default function ManageRoot() {
  const pathname = usePathname();
  const { loading, user, isAdmin, isSchoolAdmin } = useAuthContext();

  useEffect(() => {
    if (pathname !== "/manage" && pathname !== "/manage/") return;
    if (loading) return;
    if (!user) {
      window.location.replace("/manage/editor");
      return;
    }
    if (isAdmin) {
      window.location.replace("/manage/admin");
    } else if (isSchoolAdmin) {
      window.location.replace("/manage/school-admin");
    } else {
      window.location.replace("/manage/editor");
    }
  }, [pathname, loading, user, isAdmin, isSchoolAdmin]);

  return <Loading message="リダイレクト中..." />;
}
