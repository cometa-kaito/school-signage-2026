"use client";

import { escapeHtml, getTodayString } from "@/lib/utils";
import { SourceBadge } from "@/components/ui/SourceBadge";
import styles from "@/styles/editor.module.css";

interface NoticeItem {
  text: string;
  is_highlight?: boolean;
  _source?: string;
  _sourceDate: string;
  _originalIndex: number;
}

interface NoticeSectionProps {
  notices: NoticeItem[];
  onEdit: (dateStr: string, index: number) => void;
  onDelete: (dateStr: string, index: number) => void;
  onAdd: (dateStr: string) => void;
  onShowHistory: () => void;
}

export function NoticeSection({
  notices,
  onEdit,
  onDelete,
  onAdd,
  onShowHistory,
}: NoticeSectionProps) {
  const todayStr = getTodayString();

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>連絡</h2>
        <button className="btn btn-sm btn-secondary" onClick={onShowHistory}>
          履歴
        </button>
      </div>
      <ul className={styles.noticeList}>
        {notices.length > 0 ? (
          notices.map((item, i) => (
            <li
              key={i}
              className={`${styles.noticeItem} ${item.is_highlight ? styles.highlight : ""}`}
              onClick={() => onEdit(item._sourceDate, item._originalIndex)}
            >
              <SourceBadge source={item._source} compact />
              {item.is_highlight && (
                <span className={styles.importantBadge}>【重要】</span>
              )}
              {escapeHtml(item.text)}
              <button
                className={styles.deleteBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item._sourceDate, item._originalIndex);
                }}
              >
                &times;
              </button>
            </li>
          ))
        ) : (
          <li className={styles.emptyMessage}>連絡事項はありません</li>
        )}
      </ul>
      <button className={styles.addButton} onClick={() => onAdd(todayStr)}>
        ＋ 連絡を追加
      </button>
    </div>
  );
}
