"use client";

import { forwardRef } from "react";
import type { Notice } from "@/hooks/useSignageData";
import styles from "@/styles/signage.module.css";

function getSourceBadge(source?: string): string {
  if (source === "school") return "\u{1F3EB}";
  if (source === "grade") return "\u{1F4DA}";
  return "";
}

interface NoticeListProps {
  notices: Notice[];
}

const MIN_ROWS = 5;

export const NoticeList = forwardRef<HTMLUListElement, NoticeListProps>(
  function NoticeList({ notices }, ref) {
    const placeholderCount = Math.max(0, MIN_ROWS - notices.length);

    return (
      <div className={styles.noticeSection}>
        <h2>
          <span className={styles.cardIcon}>&#x1F4E2;</span>
          連絡事項
        </h2>
        <ul className={styles.listGroup} ref={ref}>
          {notices.length === 0 ? (
            <li className={styles.noNotice}>連絡事項はありません</li>
          ) : (
            <>
              {notices.map((notice, idx) => {
                const badge = getSourceBadge(notice._source);
                const isHighlight = notice.is_highlight === true;
                return (
                  <li
                    key={idx}
                    className={isHighlight ? styles.highlight : undefined}
                  >
                    {badge && (
                      <span className={styles.sourceBadge}>{badge}</span>
                    )}
                    {isHighlight && "【重要】"}
                    {notice.text}
                  </li>
                );
              })}
              {Array.from({ length: placeholderCount }).map((_, idx) => (
                <li key={`ph-${idx}`} className={styles.noticePlaceholder}>
                  &nbsp;
                </li>
              ))}
            </>
          )}
        </ul>
      </div>
    );
  }
);
