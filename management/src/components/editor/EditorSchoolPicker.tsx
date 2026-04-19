"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listSchoolsPublicFn } from "@/lib/firebase-functions";
import { Loading } from "@/components/ui/Loading";
import styles from "@/styles/admin.module.css";

interface SchoolOption {
  id: string;
  name: string;
}

interface EditorSchoolPickerProps {
  /** 遷移先のベースパス（例: "/manage/editor" または "/manage/editor-mobile"） */
  basePath: string;
}

export function EditorSchoolPicker({ basePath }: EditorSchoolPickerProps) {
  const router = useRouter();
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listSchoolsPublicFn();
        if (cancelled) return;
        setSchools(res.data.schools || []);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePick = (schoolId: string) => {
    router.push(`${basePath}?school=${encodeURIComponent(schoolId)}`);
  };

  if (loading) return <Loading message="学校一覧を読み込み中..." />;

  return (
    <div className={styles.pageContainer} style={{ maxWidth: 720 }}>
      <h2 style={{ marginBottom: 8 }}>編集する学校を選択</h2>
      <p style={{ color: "#666", marginBottom: 20 }}>
        学校を選ぶと、ログイン画面に進みます。
      </p>
      {error && (
        <p style={{ color: "#dc3545" }}>読み込みエラー: {error}</p>
      )}
      {schools.length === 0 && !error ? (
        <p className="empty-text">学校がありません</p>
      ) : (
        <div className={styles.cardList}>
          {schools.map((s) => (
            <div key={s.id} className={styles.card}>
              <div className={styles.cardBody}>
                <h3>{s.name}</h3>
                <p className={styles.cardSubtext}>ID: {s.id}</p>
              </div>
              <div className={styles.cardActions}>
                <button
                  className="btn btn-primary"
                  onClick={() => handlePick(s.id)}
                >
                  選択
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
