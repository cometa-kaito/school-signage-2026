"use client";

import { useEffect, useState } from "react";
import {
  getDoc,
  updateDoc,
  type DocumentReference,
} from "firebase/firestore";
import { useToast } from "@/components/ui/Toast";

interface QuietHour {
  start: string;
  end: string;
}

interface ClassQuietHoursEditorProps {
  /** クラスドキュメントへの参照。displaySettings.quiet_hours に対して読み書きする */
  docRef: DocumentReference;
  title: string;
  description?: string;
}

export function ClassQuietHoursEditor({
  docRef,
  title,
  description,
}: ClassQuietHoursEditorProps) {
  const { showToast } = useToast();
  const [hours, setHours] = useState<QuietHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(docRef);
        if (cancelled) return;
        const qh = snap.exists()
          ? snap.data().displaySettings?.quiet_hours || []
          : [];
        setHours(qh);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [docRef]);

  const handleAdd = () =>
    setHours([...hours, { start: "08:45", end: "15:30" }]);
  const handleRemove = (i: number) =>
    setHours(hours.filter((_, idx) => idx !== i));
  const handleChange = (
    i: number,
    field: "start" | "end",
    value: string
  ) => {
    const next = [...hours];
    next[i] = { ...next[i], [field]: value };
    setHours(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const snap = await getDoc(docRef);
      const current = snap.exists()
        ? snap.data().displaySettings || {}
        : {};
      current.quiet_hours = hours;
      await updateDoc(docRef, { displaySettings: current });
      showToast("音声オフ設定を保存しました", "success");
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{ color: "#888", fontSize: "0.85rem" }}>読み込み中...</div>
    );
  }

  return (
    <div>
      <h4 style={{ margin: "0 0 4px" }}>{title}</h4>
      {description && (
        <p style={{ color: "#888", fontSize: "0.8rem", margin: "0 0 8px" }}>
          {description}
        </p>
      )}
      {hours.length === 0 && (
        <p style={{ color: "#999", fontSize: "0.85rem", margin: "4px 0" }}>
          未設定（上位マスター設定が適用されます）
        </p>
      )}
      {hours.map((qh, idx) => (
        <div
          key={idx}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <input
            type="time"
            value={qh.start}
            onChange={(e) => handleChange(idx, "start", e.target.value)}
            style={{
              padding: "4px 8px",
              border: "1px solid #ddd",
              borderRadius: 6,
            }}
          />
          <span>〜</span>
          <input
            type="time"
            value={qh.end}
            onChange={(e) => handleChange(idx, "end", e.target.value)}
            style={{
              padding: "4px 8px",
              border: "1px solid #ddd",
              borderRadius: 6,
            }}
          />
          <button
            className="btn btn-sm btn-danger"
            onClick={() => handleRemove(idx)}
          >
            削除
          </button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button className="btn btn-sm" onClick={handleAdd}>
          + 時間帯を追加
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={saving}
          style={{ marginLeft: "auto" }}
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}
