// hooks/useAutoScroll.ts - 自動スクロールhook

"use client";

import { useEffect, useRef, useCallback, type RefObject } from "react";

const SCROLL_SPEED_DOWN = 25; // px/s 下方向
const SCROLL_SPEED_UP = 37.5; // px/s 上方向
const PAUSE_AT_ENDS = 2500; // ms 上下端での一時停止
const START_DELAY = 2000; // ms 開始遅延
const USER_PAUSE_DURATION = 5000; // ms ユーザー操作後の一時停止
const OVERFLOW_THRESHOLD = 3; // px オーバーフロー判定しきい値
const RECHECK_INTERVAL = 3000; // ms オーバーフローなし時の再チェック間隔

/**
 * 双方向自動スクロールを実装するhook
 *
 * - 下方向: 25px/s、上方向: 37.5px/s
 * - 上下端で2.5秒停止
 * - ユーザー操作で5秒間一時停止
 * - 2秒後に開始
 * - コンテンツがオーバーフローしない場合は3秒ごとに再チェック
 */
export function useAutoScroll(
  elementRef: RefObject<HTMLElement | null>
): { restart: () => void } {
  const animationIdRef = useRef<number | null>(null);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const directionRef = useRef(1); // 1 = down, -1 = up
  const isPausedRef = useRef(false);
  const isUserPausedRef = useRef(false);
  const lastTimeRef = useRef(0);
  // animate と checkAndScroll は互いに・自身を setTimeout 内で呼び出すため、
  // useCallback 間で循環依存が発生する。ref 経由で最新の実装を参照し循環を断つ。
  const animateRef = useRef<() => void>(() => {});
  const checkAndScrollRef = useRef<() => void>(() => {});

  const clearTimers = useCallback(() => {
    if (animationIdRef.current !== null) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
    if (timeoutIdRef.current !== null) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  }, []);

  const pause = useCallback(() => {
    isPausedRef.current = true;
    if (animationIdRef.current !== null) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
  }, []);

  const animate = useCallback(() => {
    const el = elementRef.current;
    if (!el || isPausedRef.current || isUserPausedRef.current) return;

    const overflow = el.scrollHeight - el.clientHeight;
    if (overflow <= OVERFLOW_THRESHOLD) {
      timeoutIdRef.current = setTimeout(() => {
        if (!isPausedRef.current && !isUserPausedRef.current) {
          animateRef.current();
        }
      }, RECHECK_INTERVAL);
      return;
    }

    lastTimeRef.current = performance.now();

    const step = (currentTime: number) => {
      if (isPausedRef.current || isUserPausedRef.current) return;

      const el = elementRef.current;
      if (!el) return;

      const deltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      const currentOverflow = el.scrollHeight - el.clientHeight;
      const speed =
        directionRef.current === 1 ? SCROLL_SPEED_DOWN : SCROLL_SPEED_UP;
      el.scrollTop += speed * deltaTime * directionRef.current;

      // 下端に到達
      if (directionRef.current === 1 && el.scrollTop >= currentOverflow) {
        el.scrollTop = currentOverflow;
        directionRef.current = -1;
        timeoutIdRef.current = setTimeout(
          () => animateRef.current(),
          PAUSE_AT_ENDS
        );
        return;
      }

      // 上端に到達
      if (directionRef.current === -1 && el.scrollTop <= 0) {
        el.scrollTop = 0;
        directionRef.current = 1;
        timeoutIdRef.current = setTimeout(
          () => animateRef.current(),
          PAUSE_AT_ENDS
        );
        return;
      }

      animationIdRef.current = requestAnimationFrame(step);
    };

    animationIdRef.current = requestAnimationFrame(step);
  }, [elementRef]);

  const checkAndScroll = useCallback(() => {
    if (isPausedRef.current || isUserPausedRef.current) return;

    const el = elementRef.current;
    if (!el) return;

    const overflow = el.scrollHeight - el.clientHeight;
    if (overflow <= OVERFLOW_THRESHOLD) {
      timeoutIdRef.current = setTimeout(
        () => checkAndScrollRef.current(),
        RECHECK_INTERVAL
      );
      return;
    }

    animate();
  }, [elementRef, animate]);

  // ref を常に最新の実装に同期（循環依存を断つため）
  useEffect(() => {
    animateRef.current = animate;
    checkAndScrollRef.current = checkAndScroll;
  }, [animate, checkAndScroll]);

  const start = useCallback(() => {
    clearTimers();
    isPausedRef.current = false;
    isUserPausedRef.current = false;
    directionRef.current = 1;

    timeoutIdRef.current = setTimeout(() => {
      checkAndScroll();
    }, START_DELAY);
  }, [clearTimers, checkAndScroll]);

  const pauseForUser = useCallback(() => {
    isUserPausedRef.current = true;
    pause();

    if (timeoutIdRef.current !== null) {
      clearTimeout(timeoutIdRef.current);
    }

    timeoutIdRef.current = setTimeout(() => {
      isUserPausedRef.current = false;
      isPausedRef.current = false;
      checkAndScroll();
    }, USER_PAUSE_DURATION);
  }, [pause, checkAndScroll]);

  const restart = useCallback(() => {
    start();
  }, [start]);

  // セットアップと破棄
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const handleInteraction = () => pauseForUser();

    el.addEventListener("mousedown", handleInteraction);
    el.addEventListener("touchstart", handleInteraction, { passive: true });
    el.addEventListener("wheel", handleInteraction, { passive: true });

    // 開始遅延後にスクロール開始
    start();

    return () => {
      clearTimers();
      el.removeEventListener("mousedown", handleInteraction);
      el.removeEventListener("touchstart", handleInteraction);
      el.removeEventListener("wheel", handleInteraction);
    };
  }, [elementRef, start, clearTimers, pauseForUser]);

  return { restart };
}
