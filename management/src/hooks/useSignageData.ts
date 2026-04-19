// hooks/useSignageData.ts - サイネージ表示用メインデータhook

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  doc,
  getDoc,
  type QuerySnapshot,
  type DocumentData,
  type CollectionReference,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  classDocRef,
  schoolDocRef,
  dailyDataCollectionRef,
  schoolMasterDailyDataCollectionRef,
  gradeMasterDailyDataCollectionRef,
  gradeDocRef,
  departmentDocRef,
  departmentMasterDailyDataCollectionRef,
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

const FIRESTORE_PROJECT_ID = "school-signage-2026";
const STATIC_JSON_BASE =
  "https://storage.googleapis.com/school-signage-2026.firebasestorage.app/signage-data";
const POLLING_INTERVAL = 3000;

/**
 * Firestore接続をテスト
 */
async function testFirestoreConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`,
      { method: "GET", signal: controller.signal }
    );
    clearTimeout(timeoutId);

    return (
      response.ok || response.status === 401 || response.status === 403
    );
  } catch {
    return false;
  }
}

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
  }>({ schoolName: "", className: "", ads: [], quietHours: [] });
  const gradeNameRef = useRef("");
  // 階層の広告ストア
  const schoolAdsRef = useRef<Ad[]>([]);
  const gradeAdsRef = useRef<Ad[]>([]);
  const departmentAdsRef = useRef<Ad[]>([]);

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

      // スケジュールのマージ（school -> grade -> department -> class）
      const mergedSchedules: Schedule[] = [
        ...((school.schedules as Schedule[]) || []).map((s) => ({
          ...s,
          _source: s._source || "school",
        })),
        ...((grade.schedules as Schedule[]) || []).map((s) => ({
          ...s,
          _source: s._source || "grade",
        })),
        ...((department.schedules as Schedule[]) || []).map((s) => ({
          ...s,
          _source: s._source || "department",
        })),
        ...((cls.schedules as Schedule[]) || []),
      ];
      if (dateKey >= todayStr && mergedSchedules.length > 0) {
        const filtered = filterByDisplayRange(mergedSchedules, todayStr, dateKey);
        if (filtered.length > 0) {
          newWeeklySchedules[dateKey] = filtered;
        }
      }

      // 連絡のマージ（今日分のみ + 表示期間フィルタ）
      if (dateKey === todayStr) {
        const mergedNotices: Notice[] = [
          ...((school.notices as Notice[]) || []).map((n) => ({
            ...n,
            _source: n._source || "school",
          })),
          ...((grade.notices as Notice[]) || []).map((n) => ({
            ...n,
            _source: n._source || "grade",
          })),
          ...((department.notices as Notice[]) || []).map((n) => ({
            ...n,
            _source: n._source || "department",
          })),
          ...((cls.notices as Notice[]) || []),
        ];
        newNotices = filterByDisplayRange(mergedNotices, todayStr, dateKey);
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

    // 広告の階層マージ（school > grade > department > class の順で連結）
    const mergedAds: Ad[] = [
      ...schoolAdsRef.current,
      ...gradeAdsRef.current,
      ...departmentAdsRef.current,
      ...classConfigRef.current.ads,
    ];

    setData((prev) => ({
      ...prev,
      schoolName: classConfigRef.current.schoolName,
      gradeName: gradeNameRef.current,
      className: classConfigRef.current.className,
      ads: mergedAds,
      quietHours: classConfigRef.current.quietHours,
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
        async (snap) => {
          if (snap.exists()) {
            const snapData = snap.data();
            const settings = snapData.displaySettings || {};

            classConfigRef.current.schoolName =
              snapData.schoolName || "School Name";
            classConfigRef.current.className = snapData.name || "";
            classConfigRef.current.ads = settings.ads || [];

            // quiet_hours フォールバックチェーン: クラス → 学年 → 学科 → 学校
            let qh: QuietHour[] =
              settings.quiet_hours || settings.quietHours || [];
            const tryLoad = async (ref: ReturnType<typeof doc>) => {
              if (qh.length > 0) return;
              try {
                const snap = await getDoc(ref);
                if (snap.exists()) {
                  qh = snap.data().quiet_hours || [];
                }
              } catch {
                /* ignore */
              }
            };
            if (qh.length === 0) {
              const gradeConfigPath = departmentId
                ? doc(
                    db,
                    "schools",
                    schoolId,
                    "departments",
                    departmentId,
                    "grades",
                    gradeId,
                    "config",
                    "display_settings"
                  )
                : doc(
                    db,
                    "schools",
                    schoolId,
                    "grades",
                    gradeId,
                    "config",
                    "display_settings"
                  );
              await tryLoad(gradeConfigPath);
            }
            if (qh.length === 0 && departmentId) {
              await tryLoad(
                doc(
                  db,
                  "schools",
                  schoolId,
                  "departments",
                  departmentId,
                  "config",
                  "display_settings"
                )
              );
            }
            if (qh.length === 0) {
              await tryLoad(
                doc(db, "schools", schoolId, "config", "display_settings")
              );
            }
            classConfigRef.current.quietHours = qh;

            mergeAndUpdate();

            if (isInitialLoadRef.current) {
              markInitialLoadComplete();
            }
          } else {
            if (isInitialLoadRef.current) {
              markInitialLoadComplete();
            }
          }
        },
        () => {
          if (isInitialLoadRef.current) {
            markInitialLoadComplete();
          }
        }
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

    (async () => {
      if (forceStatic) {
        console.log("強制静的JSONモードで起動");
        modeRef.current = "static";
        const fn = startStaticJsonPolling();
        if (cancelled) { fn(); return; }
        cleanup = fn;
        return;
      }

      const firestoreAvailable = await testFirestoreConnection();
      if (cancelled) return;

      if (firestoreAvailable) {
        console.log("Firestoreモードで起動");
        modeRef.current = "firestore";
        cleanup = startFirestoreListeners();
      } else {
        console.log("静的JSONモードにフォールバック");
        modeRef.current = "static";
        cleanup = startStaticJsonPolling();
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [schoolId, gradeId, classId, forceStatic, startFirestoreListeners, startStaticJsonPolling]);

  return {
    ...data,
    isInitialLoad,
    refetch,
  };
}
