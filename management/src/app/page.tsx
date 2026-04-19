"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/ui/Loading";

function SignagePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [SignagePage, setSignagePage] = useState<React.ComponentType<{
    schoolId: string;
    gradeId: string;
    classId: string;
    departmentId?: string | null;
    forceStatic?: boolean;
  }> | null>(null);

  const schoolId = searchParams.get("school");
  const gradeId = searchParams.get("grade");
  const classId = searchParams.get("class");
  const departmentId = searchParams.get("department");
  const forceStatic = searchParams.get("static") === "1";

  useEffect(() => {
    // 教室を特定するパラメータが無いときは、誰でも開ける「つかい方とフィードバック」
    // ページに誘導する。管理画面へはそこからログインして進んでもらう。
    if (!schoolId || !gradeId || !classId) {
      router.replace("/manage/guide");
      return;
    }

    // サイネージコンポーネントを動的にインポート
    import("@/components/signage/SignagePage").then((mod) => {
      setSignagePage(() => mod.SignagePage);
    });
  }, [schoolId, gradeId, classId, router]);

  if (!schoolId || !gradeId || !classId) {
    return <Loading message="ガイド画面へ移動しています…" />;
  }

  if (!SignagePage) {
    return <Loading message="読み込み中..." />;
  }

  return (
    <SignagePage
      schoolId={schoolId}
      gradeId={gradeId}
      classId={classId}
      departmentId={departmentId}
      forceStatic={forceStatic}
    />
  );
}

export default function RootPage() {
  return (
    <Suspense fallback={<Loading message="読み込み中..." />}>
      <SignagePageContent />
    </Suspense>
  );
}
