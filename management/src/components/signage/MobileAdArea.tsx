"use client";

import { useEffect, useRef } from "react";
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
  /** ユーザーが横スワイプで広告を切替えた時に呼ぶ */
  onIndexChange?: (index: number) => void;
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
  onIndexChange,
}: MobileAdAreaProps) {
  const areaClass = `${styles.mobileAdArea} ${isQuietTime ? styles.mobileAdQuietMode : ""}`;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const programmaticScrollRef = useRef(false);
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // currentIndex が外部（ローテーション）で変わったときスクロール位置を追従
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || ads.length === 0) return;
    const target = el.clientWidth * currentIndex;
    if (Math.abs(el.scrollLeft - target) < 2) return;
    programmaticScrollRef.current = true;
    el.scrollTo({ left: target, behavior: "smooth" });
    // スクロールイベントを無視するフラグを一定時間後に解除
    setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 400);
  }, [currentIndex, ads.length]);

  // ユーザースクロールでインデックス同期
  const handleScroll = () => {
    if (programmaticScrollRef.current) return;
    if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    scrollDebounceRef.current = setTimeout(() => {
      const el = scrollerRef.current;
      if (!el || ads.length === 0) return;
      const width = el.clientWidth;
      if (width === 0) return;
      const idx = Math.round(el.scrollLeft / width);
      const clamped = Math.max(0, Math.min(ads.length - 1, idx));
      if (clamped !== currentIndex) {
        onIndexChange?.(clamped);
      }
    }, 120);
  };

  const renderSlide = (ad: Ad, isActive: boolean) => {
    if (isQuietTime) return null;
    // アクティブスライドはキャッシュされた mediaUrl を優先、非アクティブは元 URL
    const src = isActive && mediaUrl ? mediaUrl : ad.url;
    const backdrop =
      ad.type === "video" ? (
        <video
          key={`bd-${ad.id}`}
          className={styles.adBackdrop}
          src={src}
          muted
          playsInline
          loop
          autoPlay={isActive}
          aria-hidden="true"
        />
      ) : (
        <img
          key={`bd-${ad.id}`}
          className={styles.adBackdrop}
          src={src}
          alt=""
          aria-hidden="true"
        />
      );
    const mediaEl =
      ad.type === "video" ? (
        <video
          key={ad.id}
          src={src}
          className={styles.mobileAdMedia}
          muted
          playsInline
          loop={false}
          autoPlay={isActive}
          onEnded={isActive ? onVideoEnded : undefined}
        />
      ) : (
        <img
          key={ad.id}
          src={src}
          alt="Advertisement"
          className={styles.mobileAdMedia}
          loading={isActive ? "eager" : "lazy"}
        />
      );
    const foreground = ad.link_url ? (
      <a
        href={ad.link_url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.mobileAdLink}
      >
        {mediaEl}
      </a>
    ) : (
      mediaEl
    );
    const caption = (ad.caption || "").trim();
    const captionStyle = {
      "--ad-caption-scale": String(ad.caption_font_scale ?? 1),
    } as React.CSSProperties;
    return (
      <>
        {backdrop}
        {foreground}
        {caption && (
          <div className={styles.mobileAdCaption} style={captionStyle}>
            {caption}
          </div>
        )}
      </>
    );
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
        {ads.length === 0 || isQuietTime ? (
          // フォールバック（広告なし or 消音中）: 従来の単一レンダリング
          <>
            {currentAd && !isQuietTime && mediaUrl && (
              <div className={styles.mobileAdSlide}>
                {renderSlide(currentAd, true)}
              </div>
            )}
          </>
        ) : (
          <div
            ref={scrollerRef}
            className={styles.mobileAdScroller}
            onScroll={handleScroll}
          >
            {ads.map((ad, idx) => (
              <div key={ad.id || idx} className={styles.mobileAdSlide}>
                {renderSlide(ad, idx === currentIndex)}
              </div>
            ))}
          </div>
        )}
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
