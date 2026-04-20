"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSignageData } from "@/hooks/useSignageData";
import { useClock } from "@/hooks/useClock";
import { useQuietHours } from "@/hooks/useQuietHours";
import { useAdRotation } from "@/hooks/useAdRotation";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { ImageCache } from "@/lib/image-cache";
import { debounce } from "@/lib/utils";
import { SignageHeader } from "./SignageHeader";
import { ScheduleGrid } from "./ScheduleGrid";
import { NoticeList } from "./NoticeList";
import { AssignmentTable } from "./AssignmentTable";
import { AdDisplay } from "./AdDisplay";
import { MobileAdArea } from "./MobileAdArea";
import { StartupScreen } from "./StartupScreen";
import { UpdateBanner } from "./UpdateBanner";
import { CalendarModal } from "./CalendarModal";
import styles from "@/styles/signage.module.css";

const IMAGE_POLLING_INTERVAL = 300000; // 画像キャッシュ: 5分
const DETAIL_MODE_DURATION = 20000; // 詳細モード: 20秒

interface SignagePageProps {
  schoolId: string;
  gradeId: string;
  classId: string;
  departmentId?: string | null;
  forceStatic?: boolean;
}

export function SignagePage({ schoolId, gradeId, classId, departmentId, forceStatic }: SignagePageProps) {
  // ========================================
  // Hooks
  // ========================================
  const {
    schoolName,
    gradeName,
    className,
    weeklySchedules,
    notices,
    assignments,
    ads,
    quietHours,
    isInitialLoad,
    refetch,
  } = useSignageData(schoolId, gradeId, classId, departmentId ?? null, { forceStatic });

  const { time, dateText, dayText } = useClock();
  const { isQuietTime } = useQuietHours(quietHours);
  const { currentAd, currentIndex, mediaUrl, onVideoEnded, setIndex } =
    useAdRotation({
      ads,
      isQuietTime,
      imageCache: ImageCache,
    });
  const { showBanner, enableAudio } = useNotificationSound({
    notices,
    isInitialLoad,
    isQuietTime,
  });

  // 自動スクロール — 連絡事項がオーバーフローしたら双方向スクロール
  const noticeListRef = useRef<HTMLUListElement>(null);
  const { restart: restartNoticeScroll } = useAutoScroll(noticeListRef);

  // 連絡が更新されたらスクロール位置をリセット＆再開
  useEffect(() => {
    restartNoticeScroll();
  }, [notices, restartNoticeScroll]);

  // ========================================
  // scrollRestoration制御
  // ========================================
  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    const resetScroll = setTimeout(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 100);

    return () => clearTimeout(resetScroll);
  }, []);

  // ========================================
  // レイアウト管理
  // ========================================
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 900);
    checkMobile();

    const debouncedCheck = debounce(checkMobile, 150);
    window.addEventListener("resize", debouncedCheck);
    return () => window.removeEventListener("resize", debouncedCheck);
  }, []);

  // ========================================
  // 起動画面
  // ========================================
  const [showStartup, setShowStartup] = useState(true);

  // kiosk/autostart パラメータチェック（URL パラメータの初回検知）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("kiosk") === "1" || params.get("autostart") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowStartup(false);
      enableAudio();
    }
  }, [enableAudio]);

  const handleStart = useCallback(() => {
    setShowStartup(false);
    enableAudio();
  }, [enableAudio]);

  // ========================================
  // 詳細モード（タップで広告を隠す）+ ヒントバナー
  // ========================================
  const [isDetailMode, setIsDetailMode] = useState(false);
  const detailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const exitDetailMode = useCallback(() => {
    setIsDetailMode(false);
    if (detailTimerRef.current) {
      clearTimeout(detailTimerRef.current);
      detailTimerRef.current = null;
    }
  }, []);

  const toggleDetailMode = useCallback(() => {
    if (isMobile) return; // モバイルでは無効

    setIsDetailMode((prev) => {
      const next = !prev;
      if (detailTimerRef.current) {
        clearTimeout(detailTimerRef.current);
        detailTimerRef.current = null;
      }
      if (next) {
        // 20秒後に自動復帰
        detailTimerRef.current = setTimeout(() => {
          setIsDetailMode(false);
        }, DETAIL_MODE_DURATION);
      }
      return next;
    });
  }, [isMobile]);

  useEffect(() => {
    return () => {
      if (detailTimerRef.current) {
        clearTimeout(detailTimerRef.current);
      }
    };
  }, []);

  // ========================================
  // カレンダーモーダル
  // ========================================
  const [showCalendar, setShowCalendar] = useState(false);

  const handleCalendarOpen = useCallback(() => {
    setShowCalendar(true);
  }, []);

  const handleCalendarClose = useCallback(() => {
    setShowCalendar(false);
  }, []);

  // ========================================
  // 画像キャッシュ初期化
  // ========================================
  useEffect(() => {
    ImageCache.init().catch((err) => {
      console.warn("ImageCache初期化エラー:", err);
    });
  }, []);

  // 広告画像のプリキャッシュ
  useEffect(() => {
    if (ads.length === 0) return;

    const cacheAds = async () => {
      for (const ad of ads) {
        if (ad.type === "image") {
          const has = await ImageCache.hasImage(ad.id);
          if (!has) {
            await ImageCache.cacheImage(ad.id, ad.url);
          }
        }
      }
      // 不要キャッシュの削除
      await ImageCache.cleanup(ads.map((a) => a.id));
    };

    cacheAds();
  }, [ads]);

  // ========================================
  // 画像キャッシュ定期更新（5分間隔）
  // ========================================
  useEffect(() => {
    const timerId = setInterval(() => {
      if (ads.length > 0) {
        const syncCache = async () => {
          for (const ad of ads) {
            if (ad.type === "image") {
              const has = await ImageCache.hasImage(ad.id);
              if (!has) {
                await ImageCache.cacheImage(ad.id, ad.url);
              }
            }
          }
          await ImageCache.cleanup(ads.map((a) => a.id));
        };
        syncCache();
      }
    }, IMAGE_POLLING_INTERVAL);

    return () => clearInterval(timerId);
  }, [ads]);

  // ========================================
  // Page Visibility API（タブ復帰時にリフレッシュ）
  // ========================================
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refetch();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refetch]);

  // コンテンツ 7 : 広告 3 の比率は CSS (.container) で固定する。

  // ========================================
  // 表示クラス名
  // ========================================
  const displayClassName = useMemo(() => {
    return gradeName ? `${gradeName} ${className}` : className;
  }, [gradeName, className]);

  // ========================================
  // ルートクラス
  // ========================================
  const rootClass = useMemo(() => {
    const classes = [styles.signageRoot];
    if (isDetailMode) classes.push(styles.detailMode);
    return classes.join(" ");
  }, [isDetailMode]);

  // ========================================
  // レンダー
  // ========================================
  return (
    <div className={rootClass}>
      {/* 更新バナー */}
      <UpdateBanner show={showBanner} />

      {/* 詳細モード ヒントバナー */}
      {isDetailMode && (
        <div className={styles.detailModeHint} onClick={exitDetailMode}>
          {"📖 詳細表示中（20秒後に自動で戻ります）"}
          <br />
          タップで戻る
        </div>
      )}

      {/* 起動画面 */}
      {showStartup && <StartupScreen onStart={handleStart} />}

      {isMobile ? (
        // モバイルレイアウト
        <div className={styles.mobileLayout}>
          <MobileAdArea
            currentAd={currentAd}
            mediaUrl={mediaUrl}
            isQuietTime={isQuietTime}
            ads={ads}
            currentIndex={currentIndex}
            dateText={dateText}
            dayText={dayText}
            time={time}
            className={displayClassName}
            onVideoEnded={onVideoEnded}
            onIndexChange={setIndex}
          />
          <div className={styles.mobileInfoArea}>
            <div className={styles.mobileContentGrid}>
              <ScheduleGrid
                weeklySchedules={weeklySchedules}
                onCalendarOpen={handleCalendarOpen}
              />
              <NoticeList notices={notices} ref={noticeListRef} />
              <AssignmentTable assignments={assignments} />
            </div>
          </div>
        </div>
      ) : (
        // デスクトップレイアウト
        <>
          <SignageHeader
            dateText={dateText}
            dayText={dayText}
            time={time}
            className={className}
            gradeName={gradeName}
          />
          <div className={styles.container}>
            <AdDisplay
              currentAd={currentAd}
              mediaUrl={mediaUrl}
              isQuietTime={isQuietTime}
              onVideoEnded={onVideoEnded}
            />
            <main className={styles.infoArea} onClick={toggleDetailMode}>
              <div className={styles.contentGrid}>
                <ScheduleGrid
                  weeklySchedules={weeklySchedules}
                  onCalendarOpen={handleCalendarOpen}
                />
                <NoticeList notices={notices} ref={noticeListRef} />
                <AssignmentTable assignments={assignments} />
              </div>
            </main>
          </div>
        </>
      )}

      {/* カレンダーモーダル */}
      {showCalendar && (
        <CalendarModal
          weeklySchedules={weeklySchedules}
          onClose={handleCalendarClose}
        />
      )}
    </div>
  );
}
