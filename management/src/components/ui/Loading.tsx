"use client";

import styles from "@/styles/ui.module.css";

interface LoadingProps {
  message?: string;
  overlay?: boolean;
}

export function Loading({ message = "読み込み中...", overlay = false }: LoadingProps) {
  if (overlay) {
    return (
      <div className={styles.loadingOverlay}>
        <div className={styles.loadingContent}>
          <div className={styles.spinner} />
          <p>{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.loading}>
      <div className={styles.spinner} />
      <p>{message}</p>
    </div>
  );
}
