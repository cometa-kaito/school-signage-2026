"use client";

import { useState, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { DAYS_JP, formatDateKey, escapeHtml } from "@/lib/utils";
import type { Schedule, Notice, Assignment } from "@/types/school";
import styles from "@/styles/calendar.module.css";

interface ScheduleWithMeta extends Schedule {
  _sourceDate: string;
  _originalIndex: number;
}
interface NoticeWithMeta extends Notice {
  _sourceDate: string;
  _originalIndex: number;
}
interface AssignmentWithMeta extends Assignment {
  _sourceDate: string;
  _originalIndex: number;
}

interface CalendarViewProps {
  isOpen: boolean;
  onClose: () => void;
  allSchedules: Record<string, ScheduleWithMeta[]>;
  allNotices: NoticeWithMeta[];
  allAssignments: AssignmentWithMeta[];
  onEdit: (type: "schedule" | "notice" | "assignment", dateStr: string, index: number) => void;
  onDelete: (type: "schedule" | "notice" | "assignment", dateStr: string, index: number) => void;
  onAdd: (type: "schedule" | "notice" | "assignment", dateStr: string) => void;
}

export function CalendarView({
  isOpen,
  onClose,
  allSchedules,
  allNotices,
  allAssignments,
  onEdit,
  onDelete,
  onAdd,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const todayStr = formatDateKey(new Date());

  const prevMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
    setSelectedDate(null);
  };

  const nextMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
    setSelectedDate(null);
  };

  const getDataForDate = (dateStr: string) => ({
    schedules: allSchedules[dateStr] || [],
    notices: allNotices.filter((n) => n._sourceDate === dateStr),
    assignments: allAssignments.filter((a) => a._sourceDate === dateStr),
  });

  const { year, month, startDayOfWeek, days } = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const dim = new Date(y, m + 1, 0).getDate();
    const sdow = new Date(y, m, 1).getDay();
    const result: { day: number; dateStr: string; dow: number }[] = [];
    for (let day = 1; day <= dim; day++) {
      const date = new Date(y, m, day);
      result.push({
        day,
        dateStr: formatDateKey(date),
        dow: date.getDay(),
      });
    }
    return {
      year: y,
      month: m,
      daysInMonth: dim,
      startDayOfWeek: sdow,
      days: result,
    };
  }, [currentDate]);

  const selectedData = selectedDate ? getDataForDate(selectedDate) : null;

  const handleAction = (
    action: "edit" | "delete" | "add",
    type: "schedule" | "notice" | "assignment",
    dateStr: string,
    index?: number
  ) => {
    onClose();
    if (action === "edit" && index !== undefined) onEdit(type, dateStr, index);
    else if (action === "delete" && index !== undefined) {
      if (confirm("削除しますか？")) onDelete(type, dateStr, index);
    } else if (action === "add") onAdd(type, dateStr);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="カレンダー">
      <div className={styles.calendarNav}>
        <button className="btn btn-sm btn-secondary" onClick={prevMonth}>
          &lt;
        </button>
        <span className={styles.monthLabel}>
          {year}年{month + 1}月
        </span>
        <button className="btn btn-sm btn-secondary" onClick={nextMonth}>
          &gt;
        </button>
      </div>

      <div className={styles.calendarGrid}>
        {DAYS_JP.map((d, i) => (
          <div
            key={d}
            className={`${styles.calendarHeader} ${i === 0 ? styles.sunday : i === 6 ? styles.saturday : ""}`}
          >
            {d}
          </div>
        ))}

        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className={styles.calendarCellEmpty} />
        ))}

        {days.map(({ day, dateStr, dow }) => {
          const { schedules, notices, assignments } = getDataForDate(dateStr);
          const total = schedules.length + notices.length + assignments.length;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;

          return (
            <div
              key={dateStr}
              className={`${styles.calendarCell} ${isToday ? styles.today : ""} ${isSelected ? styles.selected : ""} ${dow === 0 ? styles.sunday : dow === 6 ? styles.saturday : ""} ${total > 0 ? styles.hasEvents : ""}`}
              onClick={() => setSelectedDate(dateStr)}
            >
              <div className={styles.dayNumber}>{day}</div>
              {total > 0 && (
                <div className={styles.eventDots}>
                  {schedules.length > 0 && <span className={styles.dotSchedule} />}
                  {notices.length > 0 && <span className={styles.dotNotice} />}
                  {assignments.length > 0 && <span className={styles.dotAssignment} />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 日付詳細 */}
      {selectedDate && selectedData && (
        <div className={styles.dayDetail}>
          <h4 className={styles.dayDetailTitle}>
            {(() => {
              const [y, m, d] = selectedDate.split("-").map(Number);
              const date = new Date(y, m - 1, d);
              return `${m}/${d} (${DAYS_JP[date.getDay()]})`;
            })()}
          </h4>

          {/* 予定 */}
          <div className={styles.detailSection}>
            <div className={styles.detailSectionHeader}>予定</div>
            {selectedData.schedules.length > 0 ? (
              selectedData.schedules.map((s) => (
                <div key={s._originalIndex} className={styles.detailItem}>
                  <span>
                    <strong style={{ color: "var(--color-accent)" }}>[{escapeHtml(s.time)}]</strong>{" "}
                    {escapeHtml(s.content)}
                  </span>
                  <div className={styles.detailActions}>
                    <button onClick={() => handleAction("edit", "schedule", selectedDate, s._originalIndex)}>&#9998;</button>
                    <button onClick={() => handleAction("delete", "schedule", selectedDate, s._originalIndex)}>&#128465;</button>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.detailEmpty}>なし</div>
            )}
            <button className={styles.detailAdd} onClick={() => handleAction("add", "schedule", selectedDate)}>
              + 予定を追加
            </button>
          </div>

          {/* 連絡 */}
          <div className={styles.detailSection}>
            <div className={styles.detailSectionHeader}>連絡</div>
            {selectedData.notices.length > 0 ? (
              selectedData.notices.map((n) => (
                <div key={n._originalIndex} className={styles.detailItem}>
                  <span>
                    {n.is_highlight && <strong style={{ color: "var(--color-alert)" }}>[重要] </strong>}
                    {escapeHtml(n.text)}
                  </span>
                  <div className={styles.detailActions}>
                    <button onClick={() => handleAction("edit", "notice", selectedDate, n._originalIndex)}>&#9998;</button>
                    <button onClick={() => handleAction("delete", "notice", selectedDate, n._originalIndex)}>&#128465;</button>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.detailEmpty}>なし</div>
            )}
            <button className={styles.detailAdd} onClick={() => handleAction("add", "notice", selectedDate)}>
              + 連絡を追加
            </button>
          </div>

          {/* 提出物 */}
          <div className={styles.detailSection}>
            <div className={styles.detailSectionHeader}>提出物</div>
            {selectedData.assignments.length > 0 ? (
              selectedData.assignments.map((a) => (
                <div key={a._originalIndex} className={styles.detailItem}>
                  <span>
                    <strong>{escapeHtml(a.subject)}</strong> {escapeHtml(a.task)}{" "}
                    <span style={{ color: "#888", fontSize: "0.8rem" }}>(期限: {a.deadline})</span>
                  </span>
                  <div className={styles.detailActions}>
                    <button onClick={() => handleAction("edit", "assignment", selectedDate, a._originalIndex)}>&#9998;</button>
                    <button onClick={() => handleAction("delete", "assignment", selectedDate, a._originalIndex)}>&#128465;</button>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.detailEmpty}>なし</div>
            )}
            <button className={styles.detailAdd} onClick={() => handleAction("add", "assignment", selectedDate)}>
              + 提出物を追加
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
