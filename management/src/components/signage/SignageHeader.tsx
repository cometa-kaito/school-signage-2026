"use client";

import styles from "@/styles/signage.module.css";

// =====================
// デスクトップヘッダー
// =====================

interface SignageHeaderProps {
  dateText: string;
  dayText: string;
  time: string;
  className: string;
  gradeName: string;
}

export function SignageHeader({
  dateText,
  dayText,
  time,
  className,
  gradeName,
}: SignageHeaderProps) {
  const displayName = gradeName ? `${gradeName} ${className}` : className;

  return (
    <div className={styles.adHeader}>
      <span className={styles.dateText}>{dateText}</span>
      <span className={styles.dayBadge}>{dayText}</span>
      <span className={styles.timeText}>{time}</span>
      {displayName && (
        <span className={styles.classTitle}>{displayName}</span>
      )}
      <span className={styles.headerBranding}>キミテラス by Rebounder</span>
    </div>
  );
}

// =====================
// モバイルヘッダー（広告エリア上部）
// =====================

interface MobileAdHeaderProps {
  dateText: string;
  dayText: string;
  time: string;
  className: string;
}

export function MobileAdHeader({
  dateText,
  dayText,
  time,
  className,
}: MobileAdHeaderProps) {
  return (
    <div className={styles.mobileAdHeader}>
      <span className={styles.dateText}>{dateText}</span>
      <span className={styles.dayBadge}>{dayText}</span>
      <span className={styles.timeText}>{time}</span>
      {className && <span className={styles.classTitle}>{className}</span>}
    </div>
  );
}
