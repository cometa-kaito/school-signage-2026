"use client";

import type { Ad } from "@/hooks/useSignageData";
import styles from "@/styles/signage.module.css";

interface AdDisplayProps {
  currentAd: Ad | null;
  mediaUrl: string;
  isQuietTime: boolean;
  onImageLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
  onVideoEnded?: () => void;
}

export function AdDisplay({ currentAd, mediaUrl, isQuietTime, onImageLoad, onVideoEnded }: AdDisplayProps) {
  const areaClass = `${styles.adArea} ${isQuietTime ? styles.quietMode : ""}`;

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
        onLoad={onImageLoad}
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

  return (
    <aside className={areaClass}>
      <div className={styles.adContainer}>{renderMedia()}</div>
    </aside>
  );
}
