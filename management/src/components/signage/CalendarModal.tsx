"use client";

import { useState, useMemo, useCallback } from "react";
import type { Schedule } from "@/hooks/useSignageData";
import { getTodayString, formatDateKey, DAYS_JP } from "@/lib/utils";
import styles from "@/styles/signage.module.css";

interface CalendarModalProps {
  weeklySchedules: Record<string, Schedule[]>;
  onClose: () => void;
}

export function CalendarModal({ weeklySchedules, onClose }: CalendarModalProps) {
  const today = new Date();
  const todayStr = getTodayString();

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // React Compiler が setCurrentYear を依存として推論するため明示的に含める
  // （React の保証により setState 関数は安定なので動作は同一）
  const goToPrevMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev === 0) {
        setCurrentYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
    setSelectedDate(null);
  }, [setCurrentYear]);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev === 11) {
        setCurrentYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
    setSelectedDate(null);
  }, [setCurrentYear]);

  // カレンダー日付セルの生成
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells: Array<{
      date: Date;
      dateKey: string;
      dayNum: number;
      isOtherMonth: boolean;
      isToday: boolean;
      dayOfWeek: number;
      hasSchedule: boolean;
    }> = [];

    // 前月の残り
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1, daysInPrevMonth - i);
      const dk = formatDateKey(d);
      cells.push({
        date: d,
        dateKey: dk,
        dayNum: daysInPrevMonth - i,
        isOtherMonth: true,
        isToday: dk === todayStr,
        dayOfWeek: d.getDay(),
        hasSchedule: !!weeklySchedules[dk]?.length,
      });
    }

    // 今月
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(currentYear, currentMonth, day);
      const dk = formatDateKey(d);
      cells.push({
        date: d,
        dateKey: dk,
        dayNum: day,
        isOtherMonth: false,
        isToday: dk === todayStr,
        dayOfWeek: d.getDay(),
        hasSchedule: !!weeklySchedules[dk]?.length,
      });
    }

    // 次月の埋め（6行分）
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(currentYear, currentMonth + 1, i);
      const dk = formatDateKey(d);
      cells.push({
        date: d,
        dateKey: dk,
        dayNum: i,
        isOtherMonth: true,
        isToday: dk === todayStr,
        dayOfWeek: d.getDay(),
        hasSchedule: !!weeklySchedules[dk]?.length,
      });
    }

    return cells;
  }, [currentYear, currentMonth, weeklySchedules, todayStr]);

  // 選択日のスケジュール
  const selectedSchedules = useMemo(() => {
    if (!selectedDate) return null;
    return weeklySchedules[selectedDate] || [];
  }, [selectedDate, weeklySchedules]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const monthTitle = `${currentYear}年${currentMonth + 1}月`;

  return (
    <div className={styles.calendarModal} onClick={handleBackdropClick}>
      <div className={styles.calendarModalContent}>
        {/* ヘッダー */}
        <div className={styles.calendarModalHeader}>
          <button
            className={styles.calendarNavBtn}
            onClick={goToPrevMonth}
            type="button"
          >
            &#x25C0;
          </button>
          <h3>{monthTitle}</h3>
          <button
            className={styles.calendarNavBtn}
            onClick={goToNextMonth}
            type="button"
          >
            &#x25B6;
          </button>
          <button
            className={styles.calendarCloseBtn}
            onClick={onClose}
            type="button"
          >
            &#x2715;
          </button>
        </div>

        {/* カレンダーグリッド */}
        <div className={styles.calendarGrid}>
          <div className={styles.calendarWeekdays}>
            {DAYS_JP.map((day, idx) => (
              <span
                key={day}
                className={
                  idx === 0
                    ? styles.calendarWeekdaySunday
                    : idx === 6
                      ? styles.calendarWeekdaySaturday
                      : undefined
                }
              >
                {day}
              </span>
            ))}
          </div>
          <div className={styles.calendarDays}>
            {calendarDays.map((cell, idx) => {
              const classNames = [styles.calendarDay];
              if (cell.isOtherMonth) classNames.push(styles.calendarDayOtherMonth);
              if (cell.isToday) classNames.push(styles.calendarDayToday);
              if (cell.dateKey === selectedDate) classNames.push(styles.calendarDaySelected);
              if (cell.hasSchedule) classNames.push(styles.calendarDayHasSchedule);
              if (cell.dayOfWeek === 0) classNames.push(styles.calendarDaySunday);
              if (cell.dayOfWeek === 6) classNames.push(styles.calendarDaySaturday);

              return (
                <button
                  key={idx}
                  className={classNames.join(" ")}
                  onClick={() => setSelectedDate(cell.dateKey)}
                  type="button"
                >
                  {cell.dayNum}
                </button>
              );
            })}
          </div>
        </div>

        {/* スケジュール詳細 */}
        <div className={styles.calendarScheduleDetail}>
          {selectedDate === null ? (
            <div className={styles.calendarDetailPlaceholder}>
              日付をタップして予定を表示
            </div>
          ) : selectedSchedules && selectedSchedules.length > 0 ? (
            <>
              <div className={styles.calendarDetailDate}>
                {selectedDate.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$2/$3")}
                の予定
              </div>
              {selectedSchedules.map((schedule, idx) => (
                <div key={idx} className={styles.calendarDetailItem}>
                  <span className={styles.calendarDetailTime}>
                    {schedule.time || "--:--"}
                  </span>
                  <span className={styles.calendarDetailContent}>
                    {schedule.content}
                    {schedule.location ? ` (${schedule.location})` : ""}
                  </span>
                </div>
              ))}
            </>
          ) : (
            <div className={styles.calendarNoSchedule}>
              この日の予定はありません
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
