"use client";

import { useEffect, useState, useCallback } from "react";
import { getDoc, setDoc } from "firebase/firestore";
import { Modal } from "@/components/ui/Modal";
import { scheduleTemplatesRef } from "@/lib/paths";
import type { Schedule } from "@/types/school";
import styles from "@/styles/editor.module.css";

export const WEEKDAY_KEYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: "月",
  tue: "火",
  wed: "水",
  thu: "木",
  fri: "金",
  sat: "土",
  sun: "日",
};

export type WeeklyTemplate = Record<WeekdayKey, Schedule[]>;

export function emptyWeeklyTemplate(): WeeklyTemplate {
  return {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
  };
}

interface ScheduleTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string | null;
  onSaved?: (template: WeeklyTemplate) => void;
}

export function ScheduleTemplateModal({
  isOpen,
  onClose,
  schoolId,
  onSaved,
}: ScheduleTemplateModalProps) {
  const [activeDay, setActiveDay] = useState<WeekdayKey>("mon");
  const [template, setTemplate] = useState<WeeklyTemplate>(emptyWeeklyTemplate());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !schoolId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(scheduleTemplatesRef(schoolId));
        if (cancelled) return;
        if (snap.exists()) {
          const weekly = (snap.data().weekly || {}) as Partial<WeeklyTemplate>;
          const merged = emptyWeeklyTemplate();
          for (const k of WEEKDAY_KEYS) {
            merged[k] = Array.isArray(weekly[k]) ? weekly[k]! : [];
          }
          setTemplate(merged);
        } else {
          setTemplate(emptyWeeklyTemplate());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, schoolId]);

  const updateItem = useCallback(
    (idx: number, patch: Partial<Schedule>) => {
      setTemplate((prev) => {
        const list = [...prev[activeDay]];
        list[idx] = { ...list[idx], ...patch };
        return { ...prev, [activeDay]: list };
      });
    },
    [activeDay]
  );

  const addItem = useCallback(() => {
    setTemplate((prev) => ({
      ...prev,
      [activeDay]: [...prev[activeDay], { time: "", content: "", location: "" }],
    }));
  }, [activeDay]);

  const removeItem = useCallback(
    (idx: number) => {
      setTemplate((prev) => {
        const list = [...prev[activeDay]];
        list.splice(idx, 1);
        return { ...prev, [activeDay]: list };
      });
    },
    [activeDay]
  );

  const copyFrom = useCallback(
    (sourceDay: WeekdayKey) => {
      setTemplate((prev) => ({
        ...prev,
        [activeDay]: prev[sourceDay].map((s) => ({ ...s })),
      }));
    },
    [activeDay]
  );

  const handleSave = useCallback(async () => {
    if (!schoolId) return;
    setSaving(true);
    try {
      const cleaned = emptyWeeklyTemplate();
      for (const k of WEEKDAY_KEYS) {
        cleaned[k] = template[k]
          .filter((s) => s.time?.trim() || s.content?.trim())
          .map((s) => {
            const out: Schedule = {
              time: (s.time || "").trim(),
              content: (s.content || "").trim(),
            };
            if (s.location?.trim()) out.location = s.location.trim();
            return out;
          });
      }
      await setDoc(
        scheduleTemplatesRef(schoolId),
        { weekly: cleaned, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      onSaved?.(cleaned);
      onClose();
    } finally {
      setSaving(false);
    }
  }, [schoolId, template, onSaved, onClose]);

  const currentItems = template[activeDay] || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="時間割テンプレート"
      description="曜日ごとの基本時間割を設定します。エディターの「テンプレ展開」ボタンでこの内容がその日の予定に反映されます。"
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            キャンセル
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      }
    >
      {loading ? (
        <div style={{ padding: 24, textAlign: "center" }}>読み込み中...</div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
            {WEEKDAY_KEYS.map((k) => (
              <button
                key={k}
                onClick={() => setActiveDay(k)}
                className={`btn btn-sm ${activeDay === k ? "btn-primary" : "btn-secondary"}`}
              >
                {WEEKDAY_LABELS[k]}
                {template[k].length > 0 && ` (${template[k].length})`}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: 8, fontSize: "0.85rem", color: "#666" }}>
            別曜日からコピー:{" "}
            {WEEKDAY_KEYS.filter((k) => k !== activeDay).map((k) => (
              <button
                key={k}
                className="btn btn-sm btn-link"
                style={{ marginRight: 4 }}
                onClick={() => copyFrom(k)}
                disabled={template[k].length === 0}
              >
                {WEEKDAY_LABELS[k]}
              </button>
            ))}
          </div>

          <table className={styles.dataTable} style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: "20%" }}>時間</th>
                <th>内容</th>
                <th style={{ width: "20%" }}>場所</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "#999" }}>
                    この曜日のテンプレートは未設定です
                  </td>
                </tr>
              ) : (
                currentItems.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        type="text"
                        value={item.time || ""}
                        placeholder="例: 1限"
                        onChange={(e) => updateItem(idx, { time: e.target.value })}
                        style={{ width: "100%" }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={item.content || ""}
                        placeholder="例: 数学"
                        onChange={(e) => updateItem(idx, { content: e.target.value })}
                        style={{ width: "100%" }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={item.location || ""}
                        placeholder="任意"
                        onChange={(e) => updateItem(idx, { location: e.target.value })}
                        style={{ width: "100%" }}
                      />
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => removeItem(idx)}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-sm btn-secondary" onClick={addItem}>
              + 行を追加
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Date から WeekdayKey への変換 */
export function weekdayKeyOf(date: Date): WeekdayKey {
  // JS: 0=Sun, 1=Mon, ... 6=Sat
  const map: WeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[date.getDay()];
}
