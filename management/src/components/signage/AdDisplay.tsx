"use client";

import type { Ad } from "@/hooks/useSignageData";
import styles from "@/styles/signage.module.css";

interface AdDisplayProps {
  currentAd: Ad | null;
  mediaUrl: string;
  isQuietTime: boolean;
  onVideoEnded?: () => void;
}

export function AdDisplay({ currentAd, mediaUrl, isQuietTime, onVideoEnded }: AdDisplayProps) {
  const hasMedia = !!currentAd && !!mediaUrl && !isQuietTime;
  const areaClass = `${styles.adArea} ${isQuietTime ? styles.quietMode : ""} ${hasMedia ? styles.adAreaHasMedia : ""}`;

  const renderBackdrop = () => {
    if (!currentAd || !mediaUrl || isQuietTime) return null;
    if (currentAd.type === "video") {
      return (
        <video
          key={`bd-${currentAd.id}`}
          className={styles.adBackdrop}
          src={mediaUrl}
          muted
          autoPlay
          playsInline
          loop
          aria-hidden="true"
        />
      );
    }
    return (
      <img
        key={`bd-${currentAd.id}`}
        className={styles.adBackdrop}
        src={mediaUrl}
        alt=""
        aria-hidden="true"
      />
    );
  };

  const renderMedia = () => {
    if (!currentAd || !mediaUrl || isQuietTime) return null;

    if (currentAd.type === "video") {
      const videoEl = (
        <video
          key={currentAd.id}
          src={mediaUrl}
          muted
          autoPlay
          playsInline
          loop={false}
          onEnded={onVideoEnded}
        />
      );

      if (currentAd.link_url) {
        return (
          <a href={currentAd.link_url} target="_blank" rel="noopener noreferrer">
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
      />
    );

    if (currentAd.link_url) {
      return (
        <a href={currentAd.link_url} target="_blank" rel="noopener noreferrer">
          {imgEl}
        </a>
      );
    }
    return imgEl;
  };

  const caption = hasMedia ? (currentAd?.caption || "").trim() : "";
  const captionStyle = {
    "--ad-caption-scale": String(currentAd?.caption_font_scale ?? 1),
  } as React.CSSProperties;

  return (
    <aside className={areaClass}>
      <div className={styles.adContainer}>
        {renderBackdrop()}
        <div className={styles.adForeground}>{renderMedia()}</div>
        {caption && (
          <div className={styles.adCaption} style={captionStyle}>
            {caption}
          </div>
        )}
      </div>
    </aside>
  );
}
