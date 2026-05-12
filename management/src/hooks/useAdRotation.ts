// hooks/useAdRotation.ts - 広告ローテーションhook

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { type ImageCache } from "@/lib/image-cache";

export interface Ad {
  id: string;
  url: string;
  type: "image" | "video";
  duration_sec?: number;
  link_url?: string;
  caption?: string;
  caption_font_scale?: number;
}

interface ImageCacheType {
  getImage: (id: string) => Promise<string | null>;
}

interface UseAdRotationParams {
  ads: Ad[];
  isQuietTime: boolean;
  imageCache: typeof ImageCache;
}

interface UseAdRotationResult {
  currentAd: Ad | null;
  currentIndex: number;
  mediaUrl: string;
  onVideoEnded: () => void;
  /** 外部（スワイプ等）から現在インデックスを上書き */
  setIndex: (i: number) => void;
}

/**
 * 広告ローテーションを管理するhook
 *
 * - 画像はduration_sec（デフォルト5秒）ごとに次へ
 * - 動画は終了時に次へ（onVideoEndedを提供）
 * - Quiet Time中はローテーションを一時停止（60秒ごとにリトライ）
 * - ImageCacheからキャッシュ済みURLを取得（500msタイムアウト、フォールバックで直接URL）
 */
export function useAdRotation({
  ads,
  isQuietTime,
  imageCache,
}: UseAdRotationParams): UseAdRotationResult {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mediaUrl, setMediaUrl] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adsRef = useRef(ads);
  const imageCacheRef = useRef<ImageCacheType>(imageCache as ImageCacheType);

  // refs を最新に保つ
  useEffect(() => {
    imageCacheRef.current = imageCache as ImageCacheType;
  }, [imageCache]);

  // ads が変わったらインデックスをリセット
  useEffect(() => {
    const prevIds = adsRef.current.map((a) => a.id).join(",");
    const newIds = ads.map((a) => a.id).join(",");
    if (prevIds !== newIds) {
      // 広告セット差替時の正常なリセット
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentIndex(0);
    }
    adsRef.current = ads;
  }, [ads]);

  /**
   * 次の広告に進む
   */
  const advanceToNext = useCallback(() => {
    setCurrentIndex((prev) => {
      const nextAds = adsRef.current;
      if (nextAds.length === 0) return 0;
      return (prev + 1) % nextAds.length;
    });
  }, []);

  /**
   * 現在の広告のメディアURLを解決
   */
  const resolveMediaUrl = useCallback(async (ad: Ad): Promise<string> => {
    if (ad.type === "video") {
      return ad.url;
    }

    // 画像の場合、キャッシュから取得（500msタイムアウト）
    try {
      const cached = await Promise.race([
        imageCacheRef.current.getImage(ad.id),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 500)),
      ]);
      if (cached) return cached;
    } catch {
      // キャッシュ取得失敗
    }

    return ad.url;
  }, []);

  // メディアURLの解決
  useEffect(() => {
    if (ads.length === 0) {
      // 広告が空になったら表示URLをクリア
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMediaUrl("");
      return;
    }

    const safeIndex = currentIndex < ads.length ? currentIndex : 0;
    const ad = ads[safeIndex];
    if (!ad) return;

    let cancelled = false;

    resolveMediaUrl(ad).then((url) => {
      if (!cancelled) {
        setMediaUrl(url);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ads, currentIndex, resolveMediaUrl]);

  // ローテーションタイマー
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (ads.length <= 1) return;

    if (isQuietTime) {
      // Quiet Time中は60秒ごとにリトライ
      timerRef.current = setTimeout(() => {
        // 次のeffect実行で再チェックされる
      }, 60000);
      return;
    }

    const safeIndex = currentIndex < ads.length ? currentIndex : 0;
    const ad = ads[safeIndex];
    if (!ad) return;

    // 画像の場合はduration_secごとに次へ（動画はonVideoEndedで制御）
    if (ad.type === "image") {
      const duration = (ad.duration_sec || 5) * 1000;
      timerRef.current = setTimeout(() => {
        advanceToNext();
      }, duration);
    } else if (ad.type === "video") {
      // 動画の安全タイムアウト: 3分間onEndedが発火しなければ強制的に次へ
      timerRef.current = setTimeout(() => {
        advanceToNext();
      }, 180000);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [ads, currentIndex, isQuietTime, advanceToNext]);

  const safeIndex = ads.length > 0 && currentIndex < ads.length ? currentIndex : 0;
  const currentAd = ads.length > 0 ? ads[safeIndex] : null;

  const setIndex = useCallback((i: number) => {
    const list = adsRef.current;
    if (list.length === 0) return;
    const clamped = ((i % list.length) + list.length) % list.length;
    setCurrentIndex(clamped);
  }, []);

  return {
    currentAd,
    currentIndex: safeIndex,
    mediaUrl,
    onVideoEnded: advanceToNext,
    setIndex,
  };
}
