"use client";

import type { Ad } from "@/hooks/useSignageData";
import { MobileAdHeader } from "./SignageHeader";
import styles from "@/styles/signage.module.css";

interface MobileAdAreaProps {
  currentAd: Ad | null;
  mediaUrl: string;
  isQuietTime: boolean;
  ads: Ad[];
  currentIndex: number;
  dateText: string;
  dayText: string;
  time: string;
  className: string;
  onVideoEnded?: () => void;
}

export function MobileAdArea({
  currentAd,
  mediaUrl,
  isQuietTime,
  ads,
  currentIndex,
  dateText,
  dayText,
  time,
  className,
  onVideoEnded,
}: MobileAdAreaProps) {
  const areaClass = `${styles.mobileAdArea} ${isQuietTime ? styles.mobileAdQuietMode : ""}`;

  const renderMedia = () => {
    if (!currentAd || !mediaUrl || isQuietTime) return null;

    if (currentAd.type === "video") {
      const videoEl = (
        <video
          key={currentAd.id}
          src={mediaUrl}
          className={styles.mobileAdMedia}
          muted
          autoPlay
          playsInline
          loop={false}
          onEnded={onVideoEnded}
        />
      );

      if (currentAd.link_url) {
        return (
          <a
            href={currentAd.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.mobileAdLink}
          >
            {videoEl}
          </a>
        );
      }
      return videoEl;
    }

    // image
    const imgEl = (
      <img
        key={currentAd.id}
        src={mediaUrl}
        alt="Advertisement"
        className={styles.mobileAdMedia}
      />
    );

    if (currentAd.link_url) {
      return (
        <a
          href={currentAd.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.mobileAdLink}
        >
          {imgEl}
        </a>
      );
    }
    return imgEl;
  };

  return (
    <div className={areaClass}>
      <MobileAdHeader
        dateText={dateText}
        dayText={dayText}
        time={time}
        className={className}
      />
      <div className={styles.mobileAdContainer}>
        {renderMedia()}
        {ads.length > 1 && !isQuietTime && (
          <div className={styles.mobileAdIndicator}>
            {ads.map((_, idx) => (
              <span
                key={idx}
                className={`${styles.indicatorDot} ${idx === currentIndex ? styles.indicatorDotActive : ""}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
