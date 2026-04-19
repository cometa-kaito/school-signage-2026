// hooks/useSignageData.ts - サイネージ表示用メインデータhook

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  type QuerySnapshot,
  type DocumentData,
  type CollectionReference,
} from "firebase/firestore";
import {
  classDocRef,
  schoolDocRef,
  dailyDataCollectionRef,
  schoolMasterDailyDataCollectionRef,
  gradeMasterDailyDataCollectionRef,
  gradeDocRef,
  departmentDocRef,
  departmentMasterDailyDataCollectionRef,
  schoolConfigRef,
  gradeConfigRef,
  departmentConfigRef,
} from "@/lib/paths";
import { getTodayString } from "@/lib/utils";
import { getDaysAgoStr, filterByDisplayRange } from "@/lib/data-filter";

// ========================================
// 型定義
// ========================================

export interface Schedule {
  time: string;
  content: string;
  location?: string;
  _source?: string;
  display_start?: string;
  display_end?: string;
  [key: string]: unknown;
}

export interface Notice {
  text: string;
  is_highlight?: boolean;
  play_sound?: boolean;
  _source?: string;
  [key: string]: unknown;
}

export interface Assignment {
  deadline: string;
  subject: string;
  task: string;
  _source?: string;
  [key: string]: unknown;
}

export interface Ad {
  id: string;
  url: string;
  type: "image" | "video";
  duration_sec?: number;
  link_url?: string;
}

export interface QuietHour {
  start: string;
  end: string;
}

export interface SignageData {
  schoolName: string;
  gradeName: string;
  className: string;
  weeklySchedules: Record<string, Schedule[]>;
  notices: Notice[];
  assignments: Assignment[];
  ads: Ad[];
  quietHours: QuietHour[];
}

interface UseSignageDataOptions {
  forceStatic?: boolean;
}

interface UseSignageDataResult extends SignageData {
  isInitialLoad: boolean;
  refetch: () => void;
}

// ========================================
// 内部ヘルパー
// ========================================

const STATIC_JSON_BASE =
  "https://storage.googleapis.com/school-signage-2026.firebasestorage.app/signage-data";
const POLLING_INTERVAL = 3000;

/**
 * QuerySnapshotをdateキーのマップに変換
 */
function snapshotToMap(
  snapshot: QuerySnapshot<DocumentData>
): Record<string, DocumentData> {
  const map: Record<string, DocumentData> = {};
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    map[data.date] = data;
  });
  return map;
}

// ========================================
// Hook本体
// ========================================

export function useSignageData(
  schoolId: string,
  gradeId: string,
  classId: string,
  departmentId: string | null = null,
  options?: UseSignageDataOptions
): UseSignageDataResult {
  const forceStatic = options?.forceStatic ?? false;
  const [data, setData] = useState<SignageData>({
    schoolName: "",
    gradeName: "",
    className: "",
    weeklySchedules: {},
    notices: [],
    assignments: [],
    ads: [],
    quietHours: [],
  });
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // 3階層マージ用の内部ストア
  const schoolMasterRef = useRef<Record<string, DocumentData>>({});
  const gradeMasterRef = useRef<Record<string, DocumentData>>({});
  const departmentMasterRef = useRef<Record<string, DocumentData>>({});
  const classRawRef = useRef<Record<string, DocumentData>>({});

  // クラス/学年設定の中間状態
  const classConfigRef = useRef<{
    schoolName: string;
    className: string;
    ads: Ad[];
    quietHours: QuietHour[];
    adDisplayOrder: string[];
  }>({
    schoolName: "",
    className: "",
    ads: [],
    quietHours: [],
    adDisplayOrder: [],
  });
  const gradeNameRef = useRef("");
  // 階層の広告ストア
  const schoolAdsRef = useRef<Ad[]>([]);
  const gradeAdsRef = useRef<Ad[]>([]);
  const departmentAdsRef = useRef<Ad[]>([]);
  // 階層の消音ストア（class > grade > department > school の優先順位で有効なものを採用）
  const classQuietHoursRef = useRef<QuietHour[]>([]);
  const gradeQuietHoursRef = useRef<QuietHour[]>([]);
  const departmentQuietHoursRef = useRef<QuietHour[]>([]);
  const schoolQuietHoursRef = useRef<QuietHour[]>([]);

  // 静的JSONポーリング用ハッシュ
  const lastJsonHashRef = useRef("");

  // 初回ロード管理
  const pendingUpdatesRef = useRef(0);
  const isInitialLoadRef = useRef(true);

  /**
   * 3階層のデータをマージして state を更新
   */
  const mergeAndUpdate = useCallback(() => {
    const todayStr = getTodayString();
    const newWeeklySchedules: Record<string, Schedule[]> = {};
    let newNotices: Notice[] = [];
    let newAssignments: Assignment[] = [];

    const allDates = new Set([
      ...Object.keys(schoolMasterRef.current),
      ...Object.keys(gradeMasterRef.current),
      ...Object.keys(departmentMasterRef.current),
      ...Object.keys(classRawRef.current),
    ]);

    for (const dateKey of allDates) {
      const school = schoolMasterRef.current[dateKey] || {};
      const grade = gradeMasterRef.current[dateKey] || {};
      const department = departmentMasterRef.current[dateKey] || {};
      const cls = classRawRef.current[dateKey] || {};

      // スケジュールのマージ（school -> department -> grade -> class）
      // スケジュールはその日（dateKey）のものを表示するだけで十分なため
      // display_start/end による絞り込みは適用しない
      const mergedSchedules: Schedule[] = [
        ...((school.schedules as Schedule[]) || []).map((s) => ({
          ...s,
          _source: s._source || "school",
        })),
        ...((department.schedules as Schedule[]) || []).map((s) => ({
          ...s,
          _source: s._source || "department",
        })),
        ...((grade.schedules as Schedule[]) || []).map((s) => ({
          ...s,
          _source: s._source || "grade",
        })),
        ...((cls.schedules as Schedule[]) || []),
      ];
      if (dateKey >= todayStr && mergedSchedules.length > 0) {
        newWeeklySchedules[dateKey] = mergedSchedules;
      }

      // 連絡のマージ: 全日付を横断し、今日が表示期間内ならば追加
      const mergedNotices: Notice[] = [
        ...((school.notices as Notice[]) || []).map((n) => ({
          ...n,
          _source: n._source || "school",
        })),
        ...((department.notices as Notice[]) || []).map((n) => ({
          ...n,
          _source: n._source || "department",
        })),
        ...((grade.notices as Notice[]) || []).map((n) => ({
          ...n,
          _source: n._source || "grade",
        })),
        ...((cls.notices as Notice[]) || []),
      ];
      const activeNotices = filterByDisplayRange(
        mergedNotices,
        todayStr,
        dateKey
      );
      if (activeNotices.length > 0) {
        newNotices = newNotices.concat(activeNotices);
      }

      // 提出物のマージ
      const mergedAssignments: Assignment[] = [
        ...((school.assignments as Assignment[]) || []).map((a) => ({
          ...a,
          _source: a._source || "school",
        })),
        ...((grade.assignments as Assignment[]) || []).map((a) => ({
          ...a,
          _source: a._source || "grade",
        })),
        ...((department.assignments as Assignment[]) || []).map((a) => ({
          ...a,
          _source: a._source || "department",
        })),
        ...((cls.assignments as Assignment[]) || []),
      ];
      if (mergedAssignments.length > 0) {
        newAssignments = newAssignments.concat(mergedAssignments);
      }
    }

    newAssignments.sort(
      (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    );

    // 広告の階層マージ（school > department > grade > class の順で連結）
    const mergedAdsBase: Ad[] = [
      ...schoolAdsRef.current,
      ...departmentAdsRef.current,
      ...gradeAdsRef.current,
      ...classConfigRef.current.ads,
    ];

    // クラス側で保存された adDisplayOrder があれば適用
    const order = classConfigRef.current.adDisplayOrder;
    let mergedAds: Ad[];
    if (order && order.length > 0) {
      const byId = new Map(mergedAdsBase.map((a) => [a.id, a]));
      const ordered: Ad[] = [];
      const used = new Set<string>();
      for (const id of order) {
        const ad = byId.get(id);
        if (ad) {
          ordered.push(ad);
          used.add(id);
        }
      }
      for (const a of mergedAdsBase) {
        if (!used.has(a.id)) ordered.push(a);
      }
      mergedAds = ordered;
    } else {
      mergedAds = mergedAdsBase;
    }

    // 消音のフォールバック: class > grade > department > school で最初に見つかった非空を採用
    const effectiveQuietHours: QuietHour[] =
      classQuietHoursRef.current.length > 0
        ? classQuietHoursRef.current
        : gradeQuietHoursRef.current.length > 0
          ? gradeQuietHoursRef.current
          : departmentQuietHoursRef.current.length > 0
            ? departmentQuietHoursRef.current
            : schoolQuietHoursRef.current;

    setData((prev) => ({
      ...prev,
      schoolName: classConfigRef.current.schoolName,
      gradeName: gradeNameRef.current,
      className: classConfigRef.current.className,
      ads: mergedAds,
      quietHours: effectiveQuietHours,
      weeklySchedules: newWeeklySchedules,
      notices: newNotices,
      assignments: newAssignments,
    }));
  }, []);

  /**
   * 初回ロード完了チェック
   */
  const markInitialLoadComplete = useCallback(() => {
    pendingUpdatesRef.current--;
    if (pendingUpdatesRef.current <= 0) {
      setTimeout(() => {
        isInitialLoadRef.current = false;
        setIsInitialLoad(false);
      }, 1000);
    }
  }, []);

  // ========================================
  // Firestoreモード
  // ========================================

  const startFirestoreListeners = useCallback(() => {
    if (!schoolId || !gradeId || !classId) return () => {};

    const unsubscribes: (() => void)[] = [];
    const todayStr = getTodayString();
    const fiveDaysAgoStr = getDaysAgoStr(5);
    pendingUpdatesRef.current = 2;

    // 1. 学年名・学年広告の監視
    unsubscribes.push(
      onSnapshot(gradeDocRef(schoolId, gradeId, departmentId), (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          gradeNameRef.current = d.name || "";
          gradeAdsRef.current = d.displaySettings?.ads || [];
          mergeAndUpdate();
        }
      })
    );

    // 1b. 学校全体の広告の監視
    unsubscribes.push(
      onSnapshot(schoolDocRef(schoolId), (snap) => {
        if (snap.exists()) {
          schoolAdsRef.current = snap.data().displaySettings?.ads || [];
        } else {
          schoolAdsRef.current = [];
        }
        mergeAndUpdate();
      })
    );

    // 1c. 学科広告・学科マスター（学科モードのみ）
    if (departmentId) {
      unsubscribes.push(
        onSnapshot(
          departmentDocRef(schoolId, departmentId),
          (snap) => {
            departmentAdsRef.current = snap.exists()
              ? snap.data().displaySettings?.ads || []
              : [];
            mergeAndUpdate();
          },
          (err) => console.warn("学科広告監視エラー:", err)
        )
      );
      unsubscribes.push(
        onSnapshot(
          query(
            departmentMasterDailyDataCollectionRef(
              schoolId,
              departmentId
            ),
            where("date", ">=", fiveDaysAgoStr),
            orderBy("date", "asc"),
            limit(10)
          ),
          (snapshot) => {
            departmentMasterRef.current = snapshotToMap(snapshot);
            mergeAndUpdate();
          },
          (err) => console.warn("学科マスター監視エラー:", err)
        )
      );
    } else {
      departmentAdsRef.current = [];
      departmentMasterRef.current = {};
    }

    // 2. クラス設定・広告の監視
    const classRef = classDocRef(schoolId, gradeId, classId, departmentId);
    unsubscribes.push(
      onSnapshot(
        classRef,
        (snap) => {
          if (snap.exists()) {
            const snapData = snap.data();
            const settings = snapData.displaySettings || {};

            classConfigRef.current.schoolName =
              snapData.schoolName || "School Name";
            classConfigRef.current.className = snapData.name || "";
            classConfigRef.current.ads = settings.ads || [];
            classConfigRef.current.adDisplayOrder =
              settings.adDisplayOrder || [];
            classQuietHoursRef.current =
              settings.quiet_hours || settings.quietHours || [];
          } else {
            classQuietHoursRef.current = [];
          }
          mergeAndUpdate();
          if (isInitialLoadRef.current) {
            markInitialLoadComplete();
          }
        },
        () => {
          if (isInitialLoadRef.current) {
            markInitialLoadComplete();
          }
        }
      )
    );

    // 2b. 学年 config の消音設定（リアルタイム）
    unsubscribes.push(
      onSnapshot(
        gradeConfigRef(schoolId, gradeId, "display_settings", departmentId),
        (snap) => {
          gradeQuietHoursRef.current = snap.exists()
            ? snap.data().quiet_hours || []
            : [];
          mergeAndUpdate();
        },
        (err) => console.warn("学年config監視エラー:", err)
      )
    );

    // 2c. 学科 config の消音設定（学科モードのみ）
    if (departmentId) {
      unsubscribes.push(
        onSnapshot(
          departmentConfigRef(schoolId, departmentId, "display_settings"),
          (snap) => {
            departmentQuietHoursRef.current = snap.exists()
              ? snap.data().quiet_hours || []
              : [];
            mergeAndUpdate();
          },
          (err) => console.warn("学科config監視エラー:", err)
        )
      );
    } else {
      departmentQuietHoursRef.current = [];
    }

    // 2d. 学校 config の消音設定（リアルタイム）
    unsubscribes.push(
      onSnapshot(
        schoolConfigRef(schoolId, "display_settings"),
        (snap) => {
          schoolQuietHoursRef.current = snap.exists()
            ? snap.data().quiet_hours || []
            : [];
          mergeAndUpdate();
        },
        (err) => console.warn("学校config監視エラー:", err)
      )
    );

    // 日次データクエリのビルダー
    function buildDailyQuery(collectionReference: CollectionReference) {
      return query(
        collectionReference,
        where("date", ">=", fiveDaysAgoStr),
        orderBy("date", "asc"),
        limit(10)
      );
    }

    // 3. 学校マスターデータの監視
    const schoolMasterCollRef = schoolMasterDailyDataCollectionRef(schoolId);
    unsubscribes.push(
      onSnapshot(
        buildDailyQuery(schoolMasterCollRef),
        (snapshot) => {
          schoolMasterRef.current = snapshotToMap(snapshot);
          mergeAndUpdate();
        },
        (error) => {
          console.warn("学校マスターデータの監視エラー（無視可）:", error);
        }
      )
    );

    // 4. 学年マスターデータの監視
    const gradeMasterCollRef = gradeMasterDailyDataCollectionRef(
      schoolId,
      gradeId,
      departmentId
    );
    unsubscribes.push(
      onSnapshot(
        buildDailyQuery(gradeMasterCollRef),
        (snapshot) => {
          gradeMasterRef.current = snapshotToMap(snapshot);
          mergeAndUpdate();
        },
        (error) => {
          console.warn("学年マスターデータの監視エラー（無視可）:", error);
        }
      )
    );

    // 5. クラスデータの監視
    const dailyRef = dailyDataCollectionRef(
      schoolId,
      gradeId,
      classId,
      departmentId
    );
    unsubscribes.push(
      onSnapshot(
        buildDailyQuery(dailyRef),
        (snapshot) => {
          classRawRef.current = snapshotToMap(snapshot);
          mergeAndUpdate();

          if (isInitialLoadRef.current) {
            markInitialLoadComplete();
          }
        },
        () => {
          if (isInitialLoadRef.current) {
            markInitialLoadComplete();
          }
        }
      )
    );

    return () => {
      unsubscribes.forEach((unsub) => unsub());
      departmentMasterRef.current = {};
      departmentAdsRef.current = [];
    };
  }, [
    schoolId,
    gradeId,
    classId,
    departmentId,
    mergeAndUpdate,
    markInitialLoadComplete,
  ]);

  // ========================================
  // 静的JSONモード
  // ========================================

  const startStaticJsonPolling = useCallback(() => {
    if (!schoolId || !gradeId || !classId) return () => {};

    let cancelled = false;
    let timerId: ReturnType<typeof setInterval> | null = null;

    const fetchJson = async (isInitial: boolean) => {
      if (cancelled) return;

      try {
        const url = `${STATIC_JSON_BASE}/${schoolId}/${gradeId}/${classId}/data.json?t=${Date.now()}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const jsonData = await response.json();

        const contentHash = JSON.stringify({
          config: jsonData.config,
          dailyData: jsonData.dailyData,
        });

        if (!isInitial && contentHash === lastJsonHashRef.current) {
          return;
        }

        lastJsonHashRef.current = contentHash;

        const config = jsonData.config || {};
        const todayStr = getTodayString();
        const dailyData = jsonData.dailyData || {};

        const newWeeklySchedules: Record<string, Schedule[]> = {};
        let newNotices: Notice[] = [];
        let newAssignments: Assignment[] = [];

        Object.entries(dailyData).forEach(([dateKey, dateData]) => {
          const d = dateData as DocumentData;

          if (dateKey >= todayStr && d.schedules) {
            newWeeklySchedules[dateKey] = d.schedules as Schedule[];
          }

          if (dateKey === todayStr && d.notices && (d.notices as Notice[]).length > 0) {
            const filteredNotices = filterByDisplayRange(
              d.notices as Notice[],
              todayStr,
              dateKey
            );
            newNotices = newNotices.concat(filteredNotices);
          }

          if (d.assignments && (d.assignments as Assignment[]).length > 0) {
            newAssignments = newAssignments.concat(
              d.assignments as Assignment[]
            );
          }
        });

        newAssignments.sort(
          (a, b) =>
            new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
        );

        setData({
          schoolName: config.schoolName || "School Name",
          gradeName: config.gradeName || "",
          className: config.className || "",
          ads: config.ads || [],
          quietHours: config.quiet_hours || config.quietHours || [],
          weeklySchedules: newWeeklySchedules,
          notices: newNotices,
          assignments: newAssignments,
        });

        if (isInitial) {
          setTimeout(() => {
            isInitialLoadRef.current = false;
            setIsInitialLoad(false);
          }, 1000);
        }
      } catch (error) {
        console.error("静的JSON取得エラー:", error);
      }
    };

    // 即時取得
    fetchJson(true);

    // ポーリング開始
    timerId = setInterval(() => {
      fetchJson(false);
    }, POLLING_INTERVAL);

    return () => {
      cancelled = true;
      if (timerId) clearInterval(timerId);
    };
  }, [schoolId, gradeId, classId]);

  // ========================================
  // 手動リフェッチ（Page Visibility API用）
  // ========================================
  const modeRef = useRef<"firestore" | "static">("firestore");

  const refetch = useCallback(() => {
    if (modeRef.current === "static") {
      // 静的JSONモード: ハッシュをリセットして即時再取得を促す
      lastJsonHashRef.current = "";
    }
    // Firestoreモード: リスナーが自動的に最新データを取得するため不要
  }, []);

  // ========================================
  // メイン effect
  // ========================================

  useEffect(() => {
    if (!schoolId || !gradeId || !classId) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;
    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;

    if (forceStatic) {
      console.log("強制静的JSONモードで起動");
      modeRef.current = "static";
      cleanup = startStaticJsonPolling();
    } else {
      // 事前の接続テストを行わず即座に Firestore リスナーを起動
      console.log("Firestoreモードで即時起動");
      modeRef.current = "firestore";
      const firestoreCleanup = startFirestoreListeners();

      // 一定時間内にデータが届かなければ静的 JSON へフォールバック
      const FALLBACK_MS = 7000;
      watchdogTimer = setTimeout(() => {
        if (cancelled) return;
        if (isInitialLoadRef.current) {
          console.warn(
            `Firestore からのデータ受信が ${FALLBACK_MS}ms 以内に来なかったため静的 JSON にフォールバック`
          );
          firestoreCleanup();
          modeRef.current = "static";
          cleanup = startStaticJsonPolling();
        }
      }, FALLBACK_MS);

      cleanup = () => {
        if (watchdogTimer) clearTimeout(watchdogTimer);
        firestoreCleanup();
      };
    }

    return () => {
      cancelled = true;
      if (watchdogTimer) clearTimeout(watchdogTimer);
      cleanup?.();
    };
  }, [schoolId, gradeId, classId, forceStatic, startFirestoreListeners, startStaticJsonPolling]);

  return {
    ...data,
    isInitialLoad,
    refetch,
  };
}
