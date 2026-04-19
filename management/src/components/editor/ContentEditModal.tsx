"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { getTodayString } from "@/lib/utils";

const TIME_OPTIONS = [
  { value: "", label: "-- 選択 --" },
  { value: "終日", label: "終日 (All Day)" },
  { value: "朝学習", label: "朝学習" },
  { value: "1限", label: "1限" },
  { value: "2限", label: "2限" },
  { value: "3限", label: "3限" },
  { value: "4限", label: "4限" },
  { value: "5限", label: "5限" },
  { value: "6限", label: "6限" },
  { value: "放課後", label: "放課後" },
  { value: "その他", label: "その他（自由入力）" },
];

type ContentType = "schedule" | "notice" | "assignment";

interface ContentEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: ContentType;
  mode: "add" | "edit";
  dateStr: string;
  index: number | null;
  initialData?: Record<string, unknown>;
  onSave: (
    type: ContentType,
    dateStr: string,
    index: number | null,
    data: Record<string, unknown>
  ) => Promise<void>;
}

const TYPE_LABELS: Record<ContentType, string> = {
  schedule: "予定",
  notice: "連絡",
  assignment: "提出物",
};

export function ContentEditModal({
  isOpen,
  onClose,
  type,
  mode,
  dateStr,
  index,
  initialData,
  onSave,
}: ContentEditModalProps) {
  const [saving, setSaving] = useState(false);

  // Schedule state
  const currentTime = (initialData?.time as string) || "";
  const isCustomTime =
    currentTime && !TIME_OPTIONS.some((opt) => opt.value === currentTime);
  const [timeSelect, setTimeSelect] = useState(
    isCustomTime ? "その他" : currentTime
  );
  const [timeCustom, setTimeCustom] = useState(isCustomTime ? currentTime : "");
  const [content, setContent] = useState(
    (initialData?.content as string) || ""
  );
  const [location, setLocation] = useState(
    (initialData?.location as string) || ""
  );

  // Notice state
  const [text, setText] = useState((initialData?.text as string) || "");
  const [isHighlight, setIsHighlight] = useState(
    (initialData?.is_highlight as boolean) || false
  );
  const [playSound, setPlaySound] = useState(
    (initialData?.play_sound as boolean) || false
  );

  // Assignment state
  const [deadline, setDeadline] = useState(
    (initialData?.deadline as string) || getTodayString()
  );
  const [subject, setSubject] = useState(
    (initialData?.subject as string) || ""
  );
  const [task, setTask] = useState((initialData?.task as string) || "");

  // Display range (shared)
  const [displayStart, setDisplayStart] = useState(
    (initialData?.display_start as string) || ""
  );
  const [displayEnd, setDisplayEnd] = useState(
    (initialData?.display_end as string) || ""
  );

  // モーダルを開くたびに initialData から再初期化（前回の入力を持ち越さない）
  useEffect(() => {
    if (!isOpen) return;
    const t = (initialData?.time as string) || "";
    const custom = t && !TIME_OPTIONS.some((opt) => opt.value === t);
    setTimeSelect(custom ? "その他" : t);
    setTimeCustom(custom ? t : "");
    setContent((initialData?.content as string) || "");
    setLocation((initialData?.location as string) || "");
    setText((initialData?.text as string) || "");
    setIsHighlight((initialData?.is_highlight as boolean) || false);
    setPlaySound((initialData?.play_sound as boolean) || false);
    setDeadline((initialData?.deadline as string) || getTodayString());
    setSubject((initialData?.subject as string) || "");
    setTask((initialData?.task as string) || "");
    setDisplayStart((initialData?.display_start as string) || "");
    setDisplayEnd((initialData?.display_end as string) || "");
  }, [isOpen, initialData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let data: Record<string, unknown> = {};
      if (type === "schedule") {
        data = {
          time: timeSelect === "その他" ? timeCustom : timeSelect,
          content,
          location: location || undefined,
          display_start: displayStart,
          display_end: displayEnd,
        };
      } else if (type === "notice") {
        data = {
          text,
          is_highlight: isHighlight,
          play_sound: playSound,
          display_start: displayStart,
          display_end: displayEnd,
        };
      } else if (type === "assignment") {
        data = { deadline, subject, task };
      }
      await onSave(type, dateStr, index, data);
      onClose();
    } catch (err) {
      alert("保存エラー: " + (err as Error).message);
    }
    setSaving(false);
  };

  const title = `${TYPE_LABELS[type]}を${mode === "add" ? "追加" : "編集"}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </>
      }
    >
      {type === "schedule" && (
        <>
          <div className="form-group">
            <label>時間</label>
            <select
              value={timeSelect}
              onChange={(e) => setTimeSelect(e.target.value)}
            >
              {TIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {timeSelect === "その他" && (
            <div className="form-group">
              <label>自由入力</label>
              <input
                type="text"
                value={timeCustom}
                onChange={(e) => setTimeCustom(e.target.value)}
                placeholder="例: 昼休み, 13:30"
              />
            </div>
          )}
          <div className="form-group">
            <label>内容</label>
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="例: 数学テスト"
            />
          </div>
          <div className="form-group">
            <label>場所</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="例: 体育館, 教室A"
            />
          </div>
          <div className="form-group">
            <label>表示期間（空欄＝この日のみ表示）</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <input
                  type="date"
                  value={displayStart}
                  onChange={(e) => setDisplayStart(e.target.value)}
                />
                <input
                  type="text"
                  value={displayStart}
                  onChange={(e) => setDisplayStart(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  pattern="\d{4}-\d{2}-\d{2}"
                />
              </div>
              <span>〜</span>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <input
                  type="date"
                  value={displayEnd}
                  onChange={(e) => setDisplayEnd(e.target.value)}
                />
                <input
                  type="text"
                  value={displayEnd}
                  onChange={(e) => setDisplayEnd(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  pattern="\d{4}-\d{2}-\d{2}"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {type === "notice" && (
        <>
          <div className="form-group">
            <label>内容</label>
            <textarea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={isHighlight}
                onChange={(e) => setIsHighlight(e.target.checked)}
              />
              重要として表示
            </label>
          </div>
          <div className="form-group">
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={playSound}
                onChange={(e) => setPlaySound(e.target.checked)}
              />
              通知音を鳴らす
            </label>
          </div>
          <div className="form-group">
            <label>表示期間（空欄＝この日のみ表示）</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <input
                  type="date"
                  value={displayStart}
                  onChange={(e) => setDisplayStart(e.target.value)}
                />
                <input
                  type="text"
                  value={displayStart}
                  onChange={(e) => setDisplayStart(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  pattern="\d{4}-\d{2}-\d{2}"
                />
              </div>
              <span>〜</span>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <input
                  type="date"
                  value={displayEnd}
                  onChange={(e) => setDisplayEnd(e.target.value)}
                />
                <input
                  type="text"
                  value={displayEnd}
                  onChange={(e) => setDisplayEnd(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  pattern="\d{4}-\d{2}-\d{2}"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {type === "assignment" && (
        <>
          <div className="form-group">
            <label>期限日</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>科目</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>提出物名</label>
            <input
              type="text"
              value={task}
              onChange={(e) => setTask(e.target.value)}
            />
          </div>
        </>
      )}
    </Modal>
  );
}
