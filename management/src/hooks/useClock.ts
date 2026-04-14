// hooks/useClock.ts - 時計表示hook

"use client";

import { useState, useEffect } from "react";
import { DAYS_JP } from "@/lib/utils";

interface ClockState {
  /** "HH:MM:SS" 形式 */
  time: string;
  /** "M月D日" 形式 */
  dateText: string;
  /** "(曜日)" 形式 */
  dayText: string;
}

function formatTime(now: Date): string {
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function formatDate(now: Date): string {
  return `${now.getMonth() + 1}月${now.getDate()}日`;
}

function formatDay(now: Date): string {
  return `(${DAYS_JP[now.getDay()]})`;
}

function getCurrent(): ClockState {
  const now = new Date();
  return {
    time: formatTime(now),
    dateText: formatDate(now),
    dayText: formatDay(now),
  };
}

/**
 * 現在時刻を1秒ごとに更新するhook
 */
export function useClock(): ClockState {
  const [clock, setClock] = useState<ClockState>(getCurrent);

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(getCurrent());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return clock;
}
