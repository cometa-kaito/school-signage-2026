"use client";

import { useEffect, useState } from "react";
import {
  getDoc,
  setDoc,
  type DocumentReference,
} from "firebase/firestore";
import { useToast } from "@/components/ui/Toast";

interface QuietHour {
  start: string;
  end: string;
}

interface QuietHoursEditorProps {
  docRef: DocumentReference;
  title: string;
  description?: string;
}

export function QuietHoursEditor({
  docRef,
  title,
  description,
}: QuietHoursEditorProps) {
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
        setHours(snap.exists() ? snap.data().quiet_hours || [] : []);
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
  const handleChange = (i: number, field: "start" | "end", value: string) => {
    const next = [...hours];
    next[i] = { ...next[i], [field]: value };
    setHours(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(docRef, { quiet_hours: hours }, { merge: true });
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
          未設定
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
