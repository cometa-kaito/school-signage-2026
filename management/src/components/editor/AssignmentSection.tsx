"use client";

import {
  escapeHtml,
  getTodayString,
  calculateDaysLeft,
  formatDateKey,
} from "@/lib/utils";
import styles from "@/styles/editor.module.css";

interface AssignmentItem {
  deadline: string;
  subject: string;
  task: string;
  _sourceDate: string;
  _originalIndex: number;
}

interface AssignmentSectionProps {
  assignments: AssignmentItem[];
  onEdit: (dateStr: string, index: number) => void;
  onDelete: (dateStr: string, index: number) => void;
  onAdd: (dateStr: string) => void;
  onShowHistory: () => void;
}

export function AssignmentSection({
  assignments,
  onEdit,
  onDelete,
  onAdd,
  onShowHistory,
}: AssignmentSectionProps) {
  const todayStr = getTodayString();
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  const cutoffStr = formatDateKey(fiveDaysAgo);

  const filtered = assignments.filter((item) => item.deadline >= cutoffStr);

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>提出物</h2>
        <button className="btn btn-sm btn-secondary" onClick={onShowHistory}>
          履歴
        </button>
      </div>
      <div className={styles.tableWrapper}>
        <table className={styles.assignmentTable}>
          <thead>
            <tr>
              <th>期限</th>
              <th>科目</th>
              <th>提出物</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((item, i) => {
                const { text, cssClass, days } = calculateDaysLeft(
                  item.deadline
                );
                return (
                  <tr
                    key={i}
                    className={`${styles.assignmentRow} ${days < 0 ? styles.overdue : ""}`}
                    onClick={() =>
                      onEdit(item._sourceDate, item._originalIndex)
                    }
                  >
                    <td>
                      {escapeHtml(item.deadline.slice(5))}
                      <br />
                      <span className={cssClass === "days-urgent" ? styles.daysUrgent : styles.daysLeft}>
                        {text}
                      </span>
                    </td>
                    <td>{escapeHtml(item.subject)}</td>
                    <td>{escapeHtml(item.task)}</td>
                    <td>
                      <button
                        className={styles.deleteBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item._sourceDate, item._originalIndex);
                        }}
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className={styles.emptyMessage}>
                  提出物はありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button className={styles.addButton} onClick={() => onAdd(todayStr)}>
        ＋ 提出物を追加
      </button>
    </div>
  );
}
