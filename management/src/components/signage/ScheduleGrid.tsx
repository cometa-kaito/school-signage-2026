"use client";

import { useMemo } from "react";
import type { Schedule } from "@/hooks/useSignageData";
import { getTodayString, formatDateKey, getDateOffset, isWeekend, DAYS_JP } from "@/lib/utils";
import { SourceBadge } from "@/components/ui/SourceBadge";
import styles from "@/styles/signage.module.css";

// 時間キーワードを分単位に変換
const TIME_KEYWORD_MAP: Record<string, number> = {
  "朝": 0,
  "ST": 30,
  "SHR": 30,
  "1限": 540,
  "2限": 600,
  "3限": 660,
  "4限": 720,
  "昼": 780,
  "5限": 810,
  "6限": 870,
  "放課後": 960,
  "帰り": 960,
  "LHR": 960,
};

function parseTimeToMinutes(time: string): number {
  if (!time) return 9999;

  // HH:MM形式
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    return parseInt(match[1]) * 60 + parseInt(match[2]);
  }

  // キーワードマッチ
  for (const [keyword, minutes] of Object.entries(TIME_KEYWORD_MAP)) {
    if (time.includes(keyword)) return minutes;
  }

  return 9999;
}

function sortSchedules(schedules: Schedule[]): Schedule[] {
  return [...schedules].sort(
    (a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)
  );
}

interface ScheduleGridProps {
  weeklySchedules: Record<string, Schedule[]>;
  onCalendarOpen?: () => void;
}

const MIN_ROWS = 5;

export function ScheduleGrid({ weeklySchedules, onCalendarOpen }: ScheduleGridProps) {
  const todayStr = getTodayString();

  // 次の3平日を計算
  const nextThreeWeekdays = useMemo(() => {
    const days: Date[] = [];
    let offset = 0;
    while (days.length < 3) {
      const d = getDateOffset(offset);
      if (!isWeekend(d)) {
        days.push(d);
      }
      offset++;
    }
    return days;
  }, []);

  return (
    <div className={`${styles.card} ${styles.scheduleSection}`}>
      <h2>
        予定
        {onCalendarOpen && (
          <button
            className={styles.calendarToggleBtn}
            onClick={(e) => {
              e.stopPropagation();
              onCalendarOpen();
            }}
            type="button"
            aria-label="カレンダーを開く"
          >
            カレンダー
          </button>
        )}
      </h2>
      <div className={styles.scheduleGridContainer}>
        {nextThreeWeekdays.map((date) => {
          const dateKey = formatDateKey(date);
          const isToday = dateKey === todayStr;
          const schedules = weeklySchedules[dateKey] || [];
          const sorted = sortSchedules(schedules);

          const mm = String(date.getMonth() + 1).padStart(2, "0");
          const dd = String(date.getDate()).padStart(2, "0");
          const dayName = DAYS_JP[date.getDay()];
          const headerText = `${mm}/${dd} (${dayName})`;

          // 残り行数のプレースホルダー
          const placeholderCount = Math.max(0, MIN_ROWS - sorted.length);

          return (
            <div
              key={dateKey}
              className={`${styles.scheduleDayColumn} ${isToday ? styles.isToday : ""}`}
            >
              <div className={styles.scheduleDateHeader}>{headerText}</div>
              <div className={styles.scheduleScrollArea}>
                {sorted.map((schedule, idx) => (
                  <div key={idx} className={styles.scheduleListItem}>
                    <SourceBadge source={schedule._source} compact align="right" />
                    <span className={styles.scheduleTime}>{schedule.time}</span>
                    <span className={styles.scheduleContent}>
                      {schedule.content}
                      {schedule.location ? ` (${schedule.location})` : ""}
                    </span>
                  </div>
                ))}
                {Array.from({ length: placeholderCount }).map((_, idx) => (
                  <div
                    key={`ph-${idx}`}
                    className={`${styles.scheduleListItem} ${styles.schedulePlaceholder}`}
                  >
                    &nbsp;
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
