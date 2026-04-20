// hooks/useQuietHours.ts - 授業時間（Quiet Hours）判定hook

"use client";

import { useState, useEffect } from "react";

export interface QuietHour {
  start: string;
  end: string;
}

/**
 * 現在時刻がQuiet Hours内かどうかを判定
 * 30秒ごとに再チェックする
 */
export function useQuietHours(quietHours: QuietHour[]): { isQuietTime: boolean } {
  const [isQuietTime, setIsQuietTime] = useState(false);

  useEffect(() => {
    function check(): boolean {
      if (!quietHours || quietHours.length === 0) {
        return false;
      }

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      for (const period of quietHours) {
        if (!period.start || !period.end) continue;

        const [startH, startM] = period.start.split(":").map(Number);
        const [endH, endM] = period.end.split(":").map(Number);

        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
          return true;
        }
      }

      return false;
    }

    // 初回チェック（初期 state=false と実際の時刻の乖離を埋める）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsQuietTime(check());

    // 30秒ごとに再チェック
    const timer = setInterval(() => {
      setIsQuietTime(check());
    }, 30000);

    return () => clearInterval(timer);
  }, [quietHours]);

  return { isQuietTime };
}
