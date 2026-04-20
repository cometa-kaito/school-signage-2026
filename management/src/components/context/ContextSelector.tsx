"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthContext } from "@/providers/AuthProvider";
import {
  listSchoolsFn,
  listGradesFn,
  listClassesFn,
  getMyMembershipsFn,
} from "@/lib/firebase-functions";
import { Loading } from "@/components/ui/Loading";
import type { School, Grade, Class } from "@/types/school";
import styles from "@/styles/context-selector.module.css";

const HISTORY_KEY = "contextHistory";
const MAX_HISTORY = 10;

interface HistoryEntry {
  schoolId: string;
  gradeId: string;
  classId: string;
  schoolName: string;
  gradeName: string;
  className: string;
  timestamp: number;
}

interface ContextSelectorProps {
  onSelected: (schoolId: string, gradeId: string, classId: string) => void;
}

function getHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveToHistory(entry: Omit<HistoryEntry, "timestamp">) {
  let history = getHistory();
  history = history.filter(
    (h) =>
      !(
        h.schoolId === entry.schoolId &&
        h.gradeId === entry.gradeId &&
        h.classId === entry.classId
      )
  );
  history.unshift({ ...entry, timestamp: Date.now() });
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function ContextSelector({ onSelected }: ContextSelectorProps) {
  const { user, isAdmin } = useAuthContext();

  const [schools, setSchools] = useState<School[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // 学校一覧を取得
  useEffect(() => {
    async function loadSchools() {
      setLoading(true);
      try {
        let allowedSchoolIds: string[] | null = null;

        if (!isAdmin && user) {
          let memberships: { schoolId: string }[] = [];
          try {
            const r = await getMyMembershipsFn();
            memberships = r.data.memberships || [];
          } catch {
            memberships = [];
          }

          if (
            memberships.length === 0 &&
            (user.uid.startsWith("teacher_") ||
              user.uid.startsWith("editor_"))
          ) {
            const token = await user.getIdTokenResult();
            const schoolId = token.claims.schoolId as string | undefined;
            if (schoolId) {
              memberships = [{ schoolId }];
            }
          }

          allowedSchoolIds = memberships.map((m) => m.schoolId);
        }

        const r = await listSchoolsFn();
        let allSchools = r.data.schools || [];
        if (allowedSchoolIds) {
          allSchools = allSchools.filter((s) =>
            allowedSchoolIds!.includes(s.id)
          );
        }
        setSchools(allSchools);

        // 学校が1つだけなら自動選択
        if (allSchools.length === 1) {
          setSelectedSchool(allSchools[0].id);
        }
      } catch {
        setSchools([]);
      }
      setHistory(getHistory());
      setLoading(false);
    }

    if (user) {
      loadSchools();
    }
  }, [user, isAdmin]);

  // 学校選択時に学年を取得
  useEffect(() => {
    if (!selectedSchool) {
      // 親コンテキスト解除時に従属ドロップダウンをクリア
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGrades([]);
      setClasses([]);
      return;
    }

    async function loadGrades() {
      try {
        const r = await listGradesFn({ schoolId: selectedSchool });
        setGrades(r.data.grades || []);
      } catch {
        setGrades([]);
      }
      setSelectedGrade("");
      setClasses([]);
    }

    loadGrades();
  }, [selectedSchool]);

  // 学年選択時にクラスを取得
  useEffect(() => {
    if (!selectedSchool || !selectedGrade) {
      // 親コンテキスト解除時に従属ドロップダウンをクリア
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClasses([]);
      return;
    }

    async function loadClasses() {
      try {
        const r = await listClassesFn({
          schoolId: selectedSchool,
          gradeId: selectedGrade,
        });
        setClasses(r.data.classes || []);
      } catch {
        setClasses([]);
      }
    }

    loadClasses();
  }, [selectedSchool, selectedGrade]);

  const handleClassSelect = useCallback(
    (classItem: Class) => {
      const school = schools.find((s) => s.id === selectedSchool);
      const grade = grades.find((g) => g.id === selectedGrade);
      saveToHistory({
        schoolId: selectedSchool,
        gradeId: selectedGrade,
        classId: classItem.id,
        schoolName: school?.name || selectedSchool,
        gradeName: grade?.name || selectedGrade,
        className: classItem.name,
      });
      onSelected(selectedSchool, selectedGrade, classItem.id);
    },
    [selectedSchool, selectedGrade, schools, grades, onSelected]
  );

  const handleHistorySelect = useCallback(
    (entry: HistoryEntry) => {
      onSelected(entry.schoolId, entry.gradeId, entry.classId);
    },
    [onSelected]
  );

  if (loading) {
    return <Loading message="学校情報を読み込み中..." />;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>クラスを選択してください</h2>

      {history.length > 0 && (
        <div className={styles.historySection}>
          <h3 className={styles.sectionTitle}>最近の選択</h3>
          <div className={styles.historyGrid}>
            {history.map((h, i) => (
              <button
                key={i}
                className={styles.historyCard}
                onClick={() => handleHistorySelect(h)}
              >
                <span className={styles.historyText}>
                  {h.schoolName} / {h.gradeName} / {h.className}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.formGroup}>
        <label>学校</label>
        <select
          value={selectedSchool}
          onChange={(e) => setSelectedSchool(e.target.value)}
        >
          <option value="">-- 学校を選択 --</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name || s.id}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formGroup}>
        <label>学年</label>
        <select
          value={selectedGrade}
          onChange={(e) => setSelectedGrade(e.target.value)}
          disabled={!selectedSchool}
        >
          <option value="">-- 学年を選択 --</option>
          {grades.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      {selectedGrade && classes.length > 0 && (
        <div>
          <label className={styles.classLabel}>クラス</label>
          <div className={styles.classGrid}>
            {classes.map((c) => (
              <button
                key={c.id}
                className={styles.classCard}
                onClick={() => handleClassSelect(c)}
              >
                <span className={styles.className}>{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedGrade && classes.length === 0 && (
        <p className={styles.emptyText}>クラスがありません</p>
      )}
    </div>
  );
}
