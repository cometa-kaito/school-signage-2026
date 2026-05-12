"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { Schedule } from "@/hooks/useSignageData";
import { getTodayString, formatDateKey, getDateOffset, isWeekend, DAYS_JP } from "@/lib/utils";
import { SourceBadge } from "@/components/ui/SourceBadge";
import styles from "@/styles/signage.module.css";

// SSR では useLayoutEffect が警告を出すため、環境に応じて切り替える
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * 1行目に収まらないときだけフォントを縮小し、それでも収まらなければ
 * 折り返しを許可する自己適応型の予定行。アニメーションは使わない。
 * - CSS変数 --row-scale を行に書き込む（既定 1）
 * - 0.78 → 0.65 と段階的に縮小し、最後の保険で white-space: normal を許可
 * - ResizeObserver でレイアウト変化時にも再評価
 */
function ScheduleRow({ schedule }: { schedule: Schedule }) {
  const rowRef = useRef<HTMLDivElement | null>(null);

  useIsoLayoutEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    const fit = () => {
      try {
        el.style.removeProperty("--row-scale");
        el.classList.remove(styles.scheduleListItemWrap);
        if (el.scrollWidth <= el.clientWidth + 1) return;

        el.style.setProperty("--row-scale", "0.78");
        if (el.scrollWidth <= el.clientWidth + 1) return;

        el.style.setProperty("--row-scale", "0.65");
        if (el.scrollWidth <= el.clientWidth + 1) return;

        // それでも入らない極端な長文は折り返しを許可（行高は固定なので
        // 縦方向は overflow:hidden で安全に抑える）
        el.classList.add(styles.scheduleListItemWrap);
      } catch {
        // レイアウト計測で例外があってもクラッシュさせない
      }
    };

    fit();

    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [schedule.content, schedule.location, schedule.time]);

  return (
    <div ref={rowRef} className={styles.scheduleListItem}>
      <SourceBadge source={schedule._source} compact align="right" />
      <span className={styles.scheduleTime}>{schedule.time}</span>
      <span className={styles.scheduleContent}>
        {schedule.content}
        {schedule.location ? ` (${schedule.location})` : ""}
      </span>
    </div>
  );
}

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
                  <ScheduleRow key={idx} schedule={schedule} />
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
