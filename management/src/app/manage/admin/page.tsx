"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { SchoolListView } from "@/components/admin/SchoolListView";
import { SchoolDetailView } from "@/components/admin/SchoolDetailView";
import { Loading } from "@/components/ui/Loading";
import { Header } from "@/components/ui/Header";
import { useAuthContext } from "@/providers/AuthProvider";
import styles from "@/styles/admin.module.css";
import Link from "next/link";

function AdminContent() {
  const searchParams = useSearchParams();
  const schoolId = searchParams.get("school");
  const { isAdmin } = useAuthContext();

  return (
    <>
      <Header title="学校管理" />
      <div className={styles.pageContainer}>
        {schoolId ? (
          <>
            {isAdmin && (
              <Link href="/manage/admin" className={styles.backLink}>
                &lt; 学校一覧に戻る
              </Link>
            )}
            <SchoolDetailView schoolId={schoolId} isSystemAdmin={isAdmin} />
          </>
        ) : (
          <SchoolListView />
        )}
      </div>
    </>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard requiredRole="admin" loginMode="admin">
      <Suspense fallback={<Loading message="読み込み中..." />}>
        <AdminContent />
      </Suspense>
    </AuthGuard>
  );
}
