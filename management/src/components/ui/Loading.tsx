"use client";

import styles from "@/styles/ui.module.css";

interface LoadingProps {
  message?: string;
  overlay?: boolean;
  itemOverlay?: boolean;
  inline?: boolean;
}

export function Loading({
  message = "読み込み中...",
  overlay = false,
  itemOverlay = false,
  inline = false,
}: LoadingProps) {
  if (inline) {
    return <span className={styles.spinnerInline} aria-label={message} />;
  }

  if (itemOverlay) {
    return (
      <div className={styles.itemOverlay}>
        <span className={styles.spinnerInline} />
        {message && <span className={styles.itemOverlayMsg}>{message}</span>}
      </div>
    );
  }

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
