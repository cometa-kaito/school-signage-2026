"use client";

import { useState, useCallback, useEffect } from "react";
import { getDoc, updateDoc, type DocumentReference } from "firebase/firestore";
import {
  classDocRef,
  schoolConfigRef,
  gradeConfigRef,
  departmentConfigRef,
} from "@/lib/paths";
import { useToast } from "@/components/ui/Toast";
import styles from "@/styles/class-settings.module.css";

interface QuietHourItem {
  start: string;
  end: string;
}

interface QuietHoursConfigProps {
  schoolId: string;
  gradeId: string;
  classId: string;
  departmentId?: string | null;
  quietHours: QuietHourItem[];
  onQuietHoursChange: (qh: QuietHourItem[]) => void;
}

export function QuietHoursConfig({
  schoolId,
  gradeId,
  classId,
  departmentId,
  quietHours,
  onQuietHoursChange,
}: QuietHoursConfigProps) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [masterNote, setMasterNote] = useState("");
  const [localHours, setLocalHours] = useState<QuietHourItem[]>(quietHours);

  // マスター設定のメモを読み込み（学年 → 学科 → 学校 の順でフォールバック）
  useEffect(() => {
    async function loadMasterNote() {
      if (quietHours.length > 0) {
        setMasterNote("");
        return;
      }
      const tryLoad = async (
        ref: DocumentReference,
        label: string
      ): Promise<boolean> => {
        try {
          const snap = await getDoc(ref);
          const data = snap.exists() ? (snap.data() as { quiet_hours?: QuietHourItem[] }) : undefined;
          const qh: QuietHourItem[] = data?.quiet_hours || [];
          if (qh.length > 0) {
            setMasterNote(
              `現在、${label}マスター設定（${qh.map((q) => q.start + "〜" + q.end).join(", ")}）が適用されています。`
            );
            return true;
          }
        } catch {
          /* ignore */
        }
        return false;
      };
      if (
        await tryLoad(
          gradeConfigRef(schoolId, gradeId, "display_settings", departmentId),
          "学年"
        )
      )
        return;
      if (
        departmentId &&
        (await tryLoad(
          departmentConfigRef(schoolId, departmentId, "display_settings"),
          "学科"
        ))
      )
        return;
      if (
        await tryLoad(schoolConfigRef(schoolId, "display_settings"), "学校")
      )
        return;
      setMasterNote(
        "音声オフが未設定です。マスター設定も未設定のため、広告は常時表示されます。"
      );
    }
    loadMasterNote();
  }, [schoolId, gradeId, departmentId, quietHours]);

  const handleAdd = () => {
    const newHours = [...localHours, { start: "08:30", end: "15:30" }];
    setLocalHours(newHours);
  };

  const handleRemove = (index: number) => {
    const newHours = localHours.filter((_, i) => i !== index);
    setLocalHours(newHours);
  };

  const handleTimeChange = (
    index: number,
    field: "start" | "end",
    value: string
  ) => {
    const newHours = [...localHours];
    newHours[index] = { ...newHours[index], [field]: value };
    setLocalHours(newHours);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const docRef = classDocRef(schoolId, gradeId, classId, departmentId);
      const snap = await getDoc(docRef);
      const current = snap.exists()
        ? snap.data().displaySettings || {}
        : {};
      current.quiet_hours = localHours;
      await updateDoc(docRef, { displaySettings: current });
      onQuietHoursChange(localHours);
      showToast("保存しました", "success");
      if (localHours.length > 0) {
        setMasterNote("");
      }
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  }, [
    schoolId,
    gradeId,
    classId,
    departmentId,
    localHours,
    onQuietHoursChange,
    showToast,
  ]);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2>音声オフ設定</h2>
      </div>
      <p className={styles.settingDescription}>
        この時間帯は広告が非表示になります。未設定の場合、学年 → 学科 → 学校 の順にマスター設定が適用されます。
      </p>

      <div>
        {localHours.length === 0 ? (
          <p className="empty-text">未設定（マスター設定を使用）</p>
        ) : (
          localHours.map((item, idx) => (
            <div key={idx} className={styles.quietHourRow}>
              <input
                type="time"
                value={item.start}
                onChange={(e) =>
                  handleTimeChange(idx, "start", e.target.value)
                }
                className={styles.timeInput}
              />
              <span>〜</span>
              <input
                type="time"
                value={item.end}
                onChange={(e) =>
                  handleTimeChange(idx, "end", e.target.value)
                }
                className={styles.timeInput}
              />
              <button
                className="btn-icon"
                onClick={() => handleRemove(idx)}
                style={{ color: "var(--danger)" }}
              >
                ✕
              </button>
            </div>
          ))
        )}

        <button className="btn btn-secondary" onClick={handleAdd}>
          + 時間帯追加
        </button>
      </div>

      <button
        className="btn btn-primary"
        onClick={handleSave}
        disabled={saving}
        style={{ marginTop: "8px" }}
      >
        {saving ? "保存中..." : "設定保存"}
      </button>

      {masterNote && (
        <p className={styles.masterNote}>{masterNote}</p>
      )}
    </div>
  );
}
