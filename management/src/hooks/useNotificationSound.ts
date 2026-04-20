// hooks/useNotificationSound.ts - 通知音hook

"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Notice {
  text: string;
  play_sound?: boolean;
  [key: string]: unknown;
}

interface UseNotificationSoundParams {
  notices: Notice[];
  isInitialLoad: boolean;
  isQuietTime: boolean;
}

interface UseNotificationSoundResult {
  showBanner: boolean;
  enableAudio: () => void;
}

/**
 * 通知音と更新バナーを管理するhook
 *
 * - ユーザー操作（click/touchstart）でAudioContextを初期化
 * - play_sound: trueの通知が変化した場合に通知音を再生
 * - 通知音: sine波、830Hz -> 1046Hz（150ms）、gain 0.3 -> 0.01（300ms）
 * - 初回ロード中、Quiet Time中は再生しない
 */
export function useNotificationSound({
  notices,
  isInitialLoad,
  isQuietTime,
}: UseNotificationSoundParams): UseNotificationSoundResult {
  const [showBanner, setShowBanner] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const previousHashRef = useRef<string>("");
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoadRef = useRef(isInitialLoad);

  // isInitialLoadの最新値を追跡
  useEffect(() => {
    isInitialLoadRef.current = isInitialLoad;
  }, [isInitialLoad]);

  /**
   * AudioContextを初期化/再開
   */
  const enableAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
  }, []);

  // ユーザー操作でAudioContextを初期化
  useEffect(() => {
    const handler = () => enableAudio();

    document.addEventListener("click", handler);
    document.addEventListener("touchstart", handler);

    return () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [enableAudio]);

  /**
   * 通知音を再生
   */
  const playSound = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state === "suspended") return;

    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(830, ctx.currentTime);
      oscillator.frequency.setValueAtTime(1046, ctx.currentTime + 0.15);

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.warn("通知音の再生に失敗:", e);
    }
  }, []);

  /**
   * 更新バナーを表示（3秒後に自動非表示）
   */
  const showUpdateBanner = useCallback(() => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
    }
    setShowBanner(true);
    bannerTimerRef.current = setTimeout(() => {
      setShowBanner(false);
    }, 3000);
  }, []);

  // 通知データの変化を監視して音を再生
  useEffect(() => {
    const soundNotices = notices.filter((n) => n.play_sound === true);
    const currentHash = JSON.stringify(soundNotices.map((n) => n.text));

    // 初回ロード時はハッシュを記録するだけ
    if (isInitialLoadRef.current) {
      previousHashRef.current = currentHash;
      return;
    }

    // 前回と同じなら何もしない
    if (currentHash === previousHashRef.current) {
      return;
    }

    previousHashRef.current = currentHash;

    // 通知データ（props）変化への反応。useEffectEvent が stable 化されるまで
    // この位置での呼び出しが必要。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    showUpdateBanner();

    // play_soundの通知があり、Quiet Timeでなければ音を鳴らす
    if (soundNotices.length > 0 && !isQuietTime) {
      playSound();
    }
  }, [notices, isQuietTime, playSound, showUpdateBanner]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  return {
    showBanner,
    enableAudio,
  };
}
