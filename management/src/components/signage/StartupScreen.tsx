"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "@/styles/signage.module.css";

interface StartupScreenProps {
  onStart: () => void;
}

export function StartupScreen({ onStart }: StartupScreenProps) {
  const [countdown, setCountdown] = useState(5);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasDismissedRef = useRef(false);

  const dismiss = useCallback(() => {
    if (hasDismissedRef.current) return;
    hasDismissedRef.current = true;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsFadingOut(true);
    // フェードアウト後にonStartを呼ぶ
    setTimeout(() => {
      onStart();
    }, 500);
  }, [onStart]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          dismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [dismiss]);

  const overlayClass = `${styles.startupOverlay} ${isFadingOut ? styles.startupFadeOut : ""}`;

  return (
    <div className={overlayClass} onClick={dismiss}>
      <div className={styles.startupContent}>
        <div className={styles.startupIcon}>&#x1F4FA;</div>
        <h1>起動中</h1>
        <p>サイネージを準備しています...</p>
        <div className={styles.startupCountdown}>{countdown}</div>
        <div className={styles.startupHint}>タップで今すぐ開始</div>
      </div>
    </div>
  );
}
