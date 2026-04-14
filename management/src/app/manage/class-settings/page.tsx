"use client";

import { useState, useEffect, useCallback } from "react";
import { getDoc } from "firebase/firestore";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Header } from "@/components/ui/Header";
import { ContextSelector } from "@/components/context/ContextSelector";
import { AdManager } from "@/components/class-settings/AdManager";
import { QuietHoursConfig } from "@/components/class-settings/QuietHoursConfig";
import { Loading } from "@/components/ui/Loading";
import { useSchoolContextValue } from "@/providers/SchoolContextProvider";
import { classDocRef, schoolDocRef } from "@/lib/paths";
import { doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import styles from "@/styles/class-settings.module.css";
import Link from "next/link";

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
        getDoc(doc(db, "schools", schoolId, "grades", gradeId)),
        getDoc(classDocRef(schoolId, gradeId, classId)),
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
  }, [schoolId, gradeId, classId]);

  useEffect(() => {
    if (hasFullContext) {
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
      <Link
        href={`/manage/admin?school=${schoolId}`}
        className={styles.backLink}
      >
        &lt; 学校管理に戻る
      </Link>

      <div className={styles.classInfo}>
        <h2 className={styles.classTitle}>{classTitle}</h2>
        {classSubtitle && (
          <p className={styles.classSubtitle}>{classSubtitle}</p>
        )}
      </div>

      <AdManager
        schoolId={schoolId!}
        gradeId={gradeId!}
        classId={classId!}
        ads={ads}
        onAdsChange={setAds}
      />

      <QuietHoursConfig
        schoolId={schoolId!}
        gradeId={gradeId!}
        classId={classId!}
        quietHours={quietHours}
        onQuietHoursChange={setQuietHours}
      />
    </div>
  );
}

export default function ClassSettingsPage() {
  return (
    <AuthGuard requiredRole="editor" loginMode="admin">
      <Header title="クラス設定" />
      <ClassSettingsContent />
    </AuthGuard>
  );
}
