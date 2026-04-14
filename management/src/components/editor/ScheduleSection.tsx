"use client";

import {
  DAYS_JP,
  formatDateKey,
  getDateOffset,
  isWeekend,
  escapeHtml,
} from "@/lib/utils";
import type { Schedule } from "@/types/school";
import styles from "@/styles/editor.module.css";

interface ScheduleSectionProps {
  weeklySchedules: Record<string, Schedule[]>;
  onEdit: (dateStr: string, index: number) => void;
  onDelete: (dateStr: string, index: number) => void;
  onAdd: (dateStr: string) => void;
}

export function ScheduleSection({
  weeklySchedules,
  onEdit,
  onDelete,
  onAdd,
}: ScheduleSectionProps) {
  const columns: { dateKey: string; label: string; isToday: boolean }[] = [];
  let dayOffset = 0;

  while (columns.length < 3) {
    const targetDate = getDateOffset(dayOffset);
    if (!isWeekend(targetDate)) {
      const dateKey = formatDateKey(targetDate);
      const day = DAYS_JP[targetDate.getDay()];
      const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
      const dd = String(targetDate.getDate()).padStart(2, "0");
      columns.push({
        dateKey,
        label: `${mm}/${dd} (${day})`,
        isToday: dayOffset === 0,
      });
    }
    dayOffset++;
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>予定</h2>
      </div>
      <div className={styles.scheduleGrid}>
        {columns.map((col) => {
          const schedules = weeklySchedules[col.dateKey] || [];
          return (
            <div
              key={col.dateKey}
              className={`${styles.scheduleColumn} ${col.isToday ? styles.isToday : ""}`}
            >
              <div className={styles.scheduleDateHeader}>{col.label}</div>
              <div className={styles.scheduleItems}>
                {schedules.length > 0 ? (
                  schedules.map((item, idx) => (
                    <div
                      key={idx}
                      className={styles.scheduleItem}
                      onClick={() => onEdit(col.dateKey, idx)}
                    >
                      <span className={styles.scheduleTime}>
                        {escapeHtml(item.time)}
                      </span>
                      <span className={styles.scheduleContent}>
                        {escapeHtml(item.content)}
                        {item.location && (
                          <span className={styles.scheduleLocation}>
                            {escapeHtml(item.location)}
                          </span>
                        )}
                      </span>
                      <button
                        className={styles.deleteBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(col.dateKey, idx);
                        }}
                      >
                        &times;
                      </button>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyMessage}>予定なし</div>
                )}
              </div>
              <button
                className={styles.addButton}
                onClick={() => onAdd(col.dateKey)}
              >
                ＋ 予定を追加
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
