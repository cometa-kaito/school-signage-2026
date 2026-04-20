// hooks/useSchoolContext.ts - 学校/学年/クラスコンテキスト管理hook

"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { DEFAULT_SCHOOL_ID } from "@/lib/firebase";

export interface SchoolContextState {
  schoolId: string | null;
  gradeId: string | null;
  classId: string | null;
  hasFullContext: boolean;
  setContext: (
    schoolId: string,
    gradeId: string | null,
    classId: string | null
  ) => void;
  clearContext: () => void;
}

export function useSchoolContext(): SchoolContextState {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [gradeId, setGradeId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);

  // 初期化: URLパラメータ → localStorage → デフォルト
  useEffect(() => {
    const urlSchool = searchParams.get("school");
    const urlGrade = searchParams.get("grade");
    const urlClass = searchParams.get("class");

    const resolvedSchool =
      urlSchool ||
      localStorage.getItem("selectedSchoolId") ||
      DEFAULT_SCHOOL_ID;
    const resolvedGrade =
      urlGrade || localStorage.getItem("selectedGradeId") || null;
    const resolvedClass =
      urlClass || localStorage.getItem("selectedClassId") || null;

    // URL / localStorage からの初期化は SSR 後にのみ可能（localStorage は client-only）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSchoolId(resolvedSchool);
    setGradeId(resolvedGrade);
    setClassId(resolvedClass);
  }, [searchParams]);

  const setContext = useCallback(
    (
      newSchoolId: string,
      newGradeId: string | null,
      newClassId: string | null
    ) => {
      setSchoolId(newSchoolId);
      setGradeId(newGradeId);
      setClassId(newClassId);

      // localStorage に保存
      localStorage.setItem("selectedSchoolId", newSchoolId);
      if (newGradeId) {
        localStorage.setItem("selectedGradeId", newGradeId);
      } else {
        localStorage.removeItem("selectedGradeId");
      }
      if (newClassId) {
        localStorage.setItem("selectedClassId", newClassId);
      } else {
        localStorage.removeItem("selectedClassId");
      }

      // URLパラメータを更新
      const params = new URLSearchParams();
      params.set("school", newSchoolId);
      if (newGradeId) params.set("grade", newGradeId);
      if (newClassId) params.set("class", newClassId);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname]
  );

  const clearContext = useCallback(() => {
    setSchoolId(null);
    setGradeId(null);
    setClassId(null);
    localStorage.removeItem("selectedSchoolId");
    localStorage.removeItem("selectedGradeId");
    localStorage.removeItem("selectedClassId");
    router.replace(pathname);
  }, [router, pathname]);

  return {
    schoolId,
    gradeId,
    classId,
    hasFullContext: !!(schoolId && gradeId && classId),
    setContext,
    clearContext,
  };
}
