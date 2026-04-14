"use client";

import { Modal } from "@/components/ui/Modal";
import { escapeHtml } from "@/lib/utils";

interface NoticeItem {
  text: string;
  is_highlight?: boolean;
  _sourceDate: string;
  _originalIndex: number;
}

interface AssignmentItem {
  deadline: string;
  subject: string;
  task: string;
  _sourceDate: string;
  _originalIndex: number;
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "notice" | "assignment";
  notices: NoticeItem[];
  assignments: AssignmentItem[];
  onReuseNotice: (text: string, isHighlight: boolean) => void;
  onReuseAssignment: (subject: string, task: string) => void;
}

export function HistoryModal({
  isOpen,
  onClose,
  type,
  notices,
  assignments,
  onReuseNotice,
  onReuseAssignment,
}: HistoryModalProps) {
  const title = type === "notice" ? "連絡の入力履歴" : "提出物の入力履歴";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      {type === "notice" && (
        <div>
          {notices.length === 0 ? (
            <p style={{ color: "#999", textAlign: "center", padding: 20 }}>
              履歴がありません
            </p>
          ) : (
            [...notices]
              .sort((a, b) => b._sourceDate.localeCompare(a._sourceDate))
              .map((item, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid #eee",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 12, color: "#999" }}>
                      {item._sourceDate}
                    </span>
                    {item.is_highlight && (
                      <span
                        style={{
                          color: "#e53935",
                          fontWeight: 600,
                          fontSize: 12,
                          marginLeft: 6,
                        }}
                      >
                        【重要】
                      </span>
                    )}
                    <div style={{ marginTop: 2 }}>{escapeHtml(item.text)}</div>
                  </div>
                  <button
                    className="btn-icon"
                    onClick={() => {
                      onClose();
                      onReuseNotice(item.text, item.is_highlight || false);
                    }}
                    title="再利用"
                    style={{
                      background: "none",
                      border: "1px solid #ddd",
                      borderRadius: 4,
                      padding: "2px 6px",
                      cursor: "pointer",
                    }}
                  >
                    &#128203;
                  </button>
                </div>
              ))
          )}
        </div>
      )}

      {type === "assignment" && (
        <div>
          {assignments.length === 0 ? (
            <p style={{ color: "#999", textAlign: "center", padding: 20 }}>
              履歴がありません
            </p>
          ) : (
            [...assignments]
              .sort((a, b) => b._sourceDate.localeCompare(a._sourceDate))
              .map((item, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid #eee",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 12, color: "#999" }}>
                      期限: {item.deadline}
                    </span>
                    <div style={{ marginTop: 2 }}>
                      <strong>{escapeHtml(item.subject)}</strong> —{" "}
                      {escapeHtml(item.task)}
                    </div>
                  </div>
                  <button
                    className="btn-icon"
                    onClick={() => {
                      onClose();
                      onReuseAssignment(item.subject, item.task);
                    }}
                    title="再利用"
                    style={{
                      background: "none",
                      border: "1px solid #ddd",
                      borderRadius: 4,
                      padding: "2px 6px",
                      cursor: "pointer",
                    }}
                  >
                    &#128203;
                  </button>
                </div>
              ))
          )}
        </div>
      )}
    </Modal>
  );
}
