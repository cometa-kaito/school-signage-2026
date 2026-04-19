"use client";

import { Suspense } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Loading } from "@/components/ui/Loading";
import { Header } from "@/components/ui/Header";
import { SchoolAdminHub } from "@/components/school-admin/SchoolAdminHub";
import styles from "@/styles/admin.module.css";

export default function SchoolAdminPage() {
  return (
    <AuthGuard requiredRole="school_admin" loginMode="admin">
      <Header title="学校管理者ダッシュボード" />
      <div className={styles.pageContainer}>
        <Suspense fallback={<Loading message="読み込み中..." />}>
          <SchoolAdminHub />
        </Suspense>
      </div>
    </AuthGuard>
  );
}
