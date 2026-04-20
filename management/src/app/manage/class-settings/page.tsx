"use client";

import { useState, useEffect, useCallback } from "react";
import { getDoc } from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Header } from "@/components/ui/Header";
import { ContextSelector } from "@/components/context/ContextSelector";
import { AdManager } from "@/components/class-settings/AdManager";
import { AdDisplayOrderManager } from "@/components/class-settings/AdDisplayOrderManager";
import { QuietHoursConfig } from "@/components/class-settings/QuietHoursConfig";
import { Loading } from "@/components/ui/Loading";
import { useSchoolContextValue } from "@/providers/SchoolContextProvider";
import { classDocRef, schoolDocRef, gradeDocRef } from "@/lib/paths";
import styles from "@/styles/class-settings.module.css";
import { useRouter } from "next/navigation";

interface AdItem {
  id: string;
  type: "image" | "video";
  url: string;
  link_url?: string;
  duration_sec?: number;
}

interface QuietHourItem {
  start: string;
  end: string;
}

function ClassSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const departmentId = searchParams.get("department");
  const { schoolId, gradeId, classId, hasFullContext, setContext } =
    useSchoolContextValue();

  const [loading, setLoading] = useState(true);
  const [classTitle, setClassTitle] = useState("クラス設定");
  const [classSubtitle, setClassSubtitle] = useState("");
  const [ads, setAds] = useState<AdItem[]>([]);
  const [quietHours, setQuietHours] = useState<QuietHourItem[]>([]);

  const loadClassData = useCallback(async () => {
    if (!schoolId || !gradeId || !classId) return;
    setLoading(true);
    try {
      const [schoolSnap, gradeSnap, classSnap] = await Promise.all([
        getDoc(schoolDocRef(schoolId)),
        getDoc(gradeDocRef(schoolId, gradeId, departmentId)),
        getDoc(classDocRef(schoolId, gradeId, classId, departmentId)),
      ]);

      const schoolName = schoolSnap.exists()
        ? schoolSnap.data().name || schoolId
        : schoolId;
      const gradeName = gradeSnap.exists()
        ? gradeSnap.data().name || gradeId
        : gradeId;
      const className = classSnap.exists()
        ? classSnap.data().name || classId
        : classId;

      setClassTitle(`${className} の設定`);
      setClassSubtitle(`${schoolName} / ${gradeName} / ${className}`);

      if (classSnap.exists()) {
        const settings = classSnap.data().displaySettings || {};
        setAds(settings.ads || []);
        setQuietHours(settings.quiet_hours || []);
      } else {
        setAds([]);
        setQuietHours([]);
      }
    } catch {
      setClassTitle("クラス設定");
    }
    setLoading(false);
  }, [schoolId, gradeId, classId, departmentId]);

  useEffect(() => {
    if (hasFullContext) {
      // loadClassData は async、setState は await 後で実行される
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadClassData();
    } else {
      setLoading(false);
    }
  }, [hasFullContext, loadClassData]);

  const handleContextSelected = (
    newSchoolId: string,
    newGradeId: string,
    newClassId: string
  ) => {
    setContext(newSchoolId, newGradeId, newClassId);
  };

  if (!hasFullContext) {
    return <ContextSelector onSelected={handleContextSelected} />;
  }

  if (loading) {
    return <Loading message="クラス情報を読み込み中..." />;
  }

  return (
    <div className={styles.pageContainer}>
      <a
        href={`/manage/editor?school=${schoolId}`}
        className={styles.backLink}
      >
        ← エディターに戻る
      </a>

      <div className={styles.classInfo}>
        <h2 className={styles.classTitle}>{classTitle}</h2>
        {classSubtitle && (
          <p className={styles.classSubtitle}>{classSubtitle}</p>
        )}
      </div>

      <AdManager
        docRef={classDocRef(schoolId!, gradeId!, classId!, departmentId)}
        ads={ads}
        onAdsChange={setAds}
      />

      <AdDisplayOrderManager
        schoolId={schoolId!}
        gradeId={gradeId!}
        classId={classId!}
        departmentId={departmentId}
      />

      <QuietHoursConfig
        schoolId={schoolId!}
        gradeId={gradeId!}
        classId={classId!}
        departmentId={departmentId}
        quietHours={quietHours}
        onQuietHoursChange={setQuietHours}
      />
    </div>
  );
}

export default function ClassSettingsPage() {
  // 広告・静寂時間は学校管理者（school_admin）以上のみ編集可能。
  // 一般の教員（editor）からはアクセスさせない。入口は /manage/admin?school=X に限定。
  return (
    <AuthGuard requiredRole="school_admin" loginMode="admin">
      <Header title="クラス設定" />
      <ClassSettingsContent />
    </AuthGuard>
  );
}
