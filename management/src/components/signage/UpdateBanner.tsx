"use client";

import styles from "@/styles/signage.module.css";

interface UpdateBannerProps {
  show: boolean;
}

export function UpdateBanner({ show }: UpdateBannerProps) {
  return (
    <div
      className={`${styles.updateBanner} ${show ? styles.updateBannerShow : ""}`}
    >
      情報が更新されました
    </div>
  );
}
