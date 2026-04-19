"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getDoc,
  onSnapshot,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import {
  classDocRef,
  schoolDocRef,
  gradeDocRef,
  departmentDocRef,
} from "@/lib/paths";
import { useToast } from "@/components/ui/Toast";
import styles from "@/styles/class-settings.module.css";

interface AdItem {
  id: string;
  type: "image" | "video";
  url: string;
  link_url?: string;
  duration_sec?: number;
}

type AdSource = "school" | "department" | "grade" | "class";

interface AdWithSource extends AdItem {
  source: AdSource;
}

interface AdDisplayOrderManagerProps {
  schoolId: string;
  gradeId: string;
  classId: string;
  departmentId?: string | null;
}

const SOURCE_LABEL: Record<AdSource, string> = {
  school: "学校",
  department: "学科",
  grade: "学年",
  class: "クラス",
};

const SOURCE_COLOR: Record<AdSource, string> = {
  school: "#1565c0",
  department: "#5a2ea6",
  grade: "#2e7d32",
  class: "#ef6c00",
};

/**
 * クラスサイネージ上での広告表示順をクラス側から自由に並び替える。
 * 継承元（学校/学科/学年）の ads 配列は変更せず、classDoc.displaySettings.adDisplayOrder
 * に表示順の adId 配列を保存する。
 */
export function AdDisplayOrderManager({
  schoolId,
  gradeId,
  classId,
  departmentId,
}: AdDisplayOrderManagerProps) {
  const { showToast } = useToast();
  const [schoolAds, setSchoolAds] = useState<AdItem[]>([]);
  const [deptAds, setDeptAds] = useState<AdItem[]>([]);
  const [gradeAds, setGradeAds] = useState<AdItem[]>([]);
  const [classAds, setClassAds] = useState<AdItem[]>([]);
  const [displayOrder, setDisplayOrder] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    unsubs.push(
      onSnapshot(schoolDocRef(schoolId), (s) => {
        setSchoolAds(
          s.exists() ? s.data().displaySettings?.ads || [] : []
        );
      })
    );
    if (departmentId) {
      unsubs.push(
        onSnapshot(departmentDocRef(schoolId, departmentId), (s) => {
          setDeptAds(
            s.exists() ? s.data().displaySettings?.ads || [] : []
          );
        })
      );
    } else {
      setDeptAds([]);
    }
    unsubs.push(
      onSnapshot(gradeDocRef(schoolId, gradeId, departmentId), (s) => {
        setGradeAds(
          s.exists() ? s.data().displaySettings?.ads || [] : []
        );
      })
    );
    unsubs.push(
      onSnapshot(
        classDocRef(schoolId, gradeId, classId, departmentId),
        (s) => {
          if (s.exists()) {
            const settings = s.data().displaySettings || {};
            setClassAds(settings.ads || []);
            setDisplayOrder(settings.adDisplayOrder || []);
          } else {
            setClassAds([]);
            setDisplayOrder([]);
          }
        }
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [schoolId, gradeId, classId, departmentId]);

  // 全広告をマージ（保存順の参照、階層順がデフォルト）
  const allAds: AdWithSource[] = [
    ...schoolAds.map((a) => ({ ...a, source: "school" as const })),
    ...deptAds.map((a) => ({ ...a, source: "department" as const })),
    ...gradeAds.map((a) => ({ ...a, source: "grade" as const })),
    ...classAds.map((a) => ({ ...a, source: "class" as const })),
  ];

  // displayOrder を適用した表示順
  const orderedAds: AdWithSource[] = (() => {
    const byId = new Map(allAds.map((a) => [a.id, a]));
    const result: AdWithSource[] = [];
    const used = new Set<string>();
    for (const id of displayOrder) {
      const ad = byId.get(id);
      if (ad) {
        result.push(ad);
        used.add(id);
      }
    }
    // displayOrder に無いものは階層順で末尾に追加
    for (const a of allAds) {
      if (!used.has(a.id)) result.push(a);
    }
    return result;
  })();

  const persistOrder = useCallback(
    async (nextOrder: string[]) => {
      setSaving(true);
      try {
        const ref = classDocRef(schoolId, gradeId, classId, departmentId);
        const snap = await getDoc(ref);
        const current = snap.exists()
          ? snap.data().displaySettings || {}
          : {};
        const nextSettings = { ...current, adDisplayOrder: nextOrder };
        if (snap.exists()) {
          await updateDoc(ref, { displaySettings: nextSettings });
        } else {
          await setDoc(ref, { displaySettings: nextSettings }, { merge: true });
        }
        setDisplayOrder(nextOrder);
      } catch (err) {
        showToast("保存エラー: " + (err as Error).message, "error");
      }
      setSaving(false);
    },
    [schoolId, gradeId, classId, departmentId, showToast]
  );

  const handleDragStart = (idx: number) => setDragIndex(idx);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (targetIdx: number) => {
    if (dragIndex === null || dragIndex === targetIdx) {
      setDragIndex(null);
      return;
    }
    const ids = orderedAds.map((a) => a.id);
    const [moved] = ids.splice(dragIndex, 1);
    ids.splice(targetIdx, 0, moved);
    setDragIndex(null);
    persistOrder(ids);
  };

  const handleMove = (idx: number, dir: "up" | "down") => {
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= orderedAds.length) return;
    const ids = orderedAds.map((a) => a.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    persistOrder(ids);
  };

  const handleReset = () => persistOrder([]);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2>広告の表示順</h2>
      </div>
      <p className={styles.settingDescription}>
        このクラスのサイネージに表示される全広告（学校/学科/学年の継承含む）の順番を、ドラッグ
        または ▲▼ ボタンで自由に並び替えできます。継承元のデータは変更されません。
      </p>

      {orderedAds.length === 0 ? (
        <p className="empty-text">広告がありません</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {orderedAds.map((ad, idx) => (
            <li
              key={ad.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(idx)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                marginBottom: 6,
                background: dragIndex === idx ? "#f0f5ff" : "#fff",
                cursor: "grab",
              }}
            >
              <span style={{ color: "#888", fontSize: 14 }}>☰</span>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#fff",
                  background: SOURCE_COLOR[ad.source],
                  padding: "2px 8px",
                  borderRadius: 10,
                  minWidth: 44,
                  textAlign: "center",
                }}
              >
                {SOURCE_LABEL[ad.source]}
              </span>
              {ad.type === "video" ? (
                <video
                  src={ad.url}
                  style={{ width: 60, height: 40, objectFit: "cover" }}
                  muted
                />
              ) : (
                <img
                  src={ad.url}
                  alt=""
                  style={{ width: 60, height: 40, objectFit: "cover" }}
                />
              )}
              <span style={{ flex: 1, fontSize: "0.85rem", color: "#555" }}>
                {ad.type === "video" ? "動画" : "画像"}
                {ad.duration_sec ? ` · ${ad.duration_sec}秒` : ""}
              </span>
              <button
                className="btn btn-sm"
                onClick={() => handleMove(idx, "up")}
                disabled={saving || idx === 0}
                style={{ padding: "2px 6px" }}
                title="上へ"
              >
                ▲
              </button>
              <button
                className="btn btn-sm"
                onClick={() => handleMove(idx, "down")}
                disabled={saving || idx === orderedAds.length - 1}
                style={{ padding: "2px 6px" }}
                title="下へ"
              >
                ▼
              </button>
            </li>
          ))}
        </ul>
      )}

      {displayOrder.length > 0 && (
        <button
          className="btn btn-sm btn-secondary"
          onClick={handleReset}
          disabled={saving}
          style={{ marginTop: 8 }}
        >
          階層順にリセット
        </button>
      )}
    </div>
  );
}
