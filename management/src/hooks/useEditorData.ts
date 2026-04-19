"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDoc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import {
  classDocRef,
  dailyDataCollectionRef,
  dailyDataDocRef,
  schoolMasterDailyDataCollectionRef,
  schoolMasterDailyDataDocRef,
  gradeMasterDailyDataCollectionRef,
  gradeMasterDailyDataDocRef,
  departmentMasterDailyDataCollectionRef,
  departmentMasterDailyDataDocRef,
} from "@/lib/paths";
import { getTodayString, formatDateKey } from "@/lib/utils";
import { getDaysAgoStr } from "@/lib/data-filter";
import type { Schedule, Notice, Assignment } from "@/types/school";

export type EditingLevel = "class" | "grade" | "department" | "school";

interface ScheduleWithMeta extends Schedule {
  _sourceDate: string;
  _originalIndex: number;
}
interface NoticeWithMeta extends Notice {
  _sourceDate: string;
  _originalIndex: number;
}
interface AssignmentWithMeta extends Assignment {
  _sourceDate: string;
  _originalIndex: number;
}

export interface EditorData {
  className: string;
  weeklySchedules: Record<string, Schedule[]>;
  allSchedules: Record<string, ScheduleWithMeta[]>;
  notices: NoticeWithMeta[];
  allNotices: NoticeWithMeta[];
  assignments: AssignmentWithMeta[];
  allAssignments: AssignmentWithMeta[];
  ads: { url: string; type?: string }[];
}

interface UseEditorDataReturn {
  data: EditorData;
  loading: boolean;
  editingLevel: EditingLevel;
  setEditingLevel: (level: EditingLevel) => void;
  saveItem: (
    type: "schedule" | "notice" | "assignment",
    dateStr: string,
    index: number | null,
    item: Record<string, unknown>
  ) => Promise<void>;
  deleteItem: (
    type: "schedule" | "notice" | "assignment",
    dateStr: string,
    index: number
  ) => Promise<void>;
  saveClassName: (name: string) => Promise<void>;
}

const FIELD_MAP: Record<string, string> = {
  schedule: "schedules",
  notice: "notices",
  assignment: "assignments",
};

export function useEditorData(
  schoolId: string | null,
  gradeId: string | null,
  classId: string | null,
  departmentId: string | null = null,
  /**
   * 学科モードで editingLevel="grade" のとき、同名学年に対する書込をファンアウトするための兄弟ペア。
   * 現在選択中の (departmentId, gradeId) 自身も含めて可（重複は除外されます）。
   */
  gradeSiblings: { departmentId: string; gradeId: string }[] = []
): UseEditorDataReturn {
  const [data, setData] = useState<EditorData>({
    className: "",
    weeklySchedules: {},
    allSchedules: {},
    notices: [],
    allNotices: [],
    assignments: [],
    allAssignments: [],
    ads: [],
  });
  const [loading, setLoading] = useState(true);
  const [editingLevel, setEditingLevel] = useState<EditingLevel>("class");
  const unsubscribersRef = useRef<(() => void)[]>([]);

  const getDailyDataCollectionPath = useCallback(() => {
    if (!schoolId) return null;
    if (editingLevel === "school")
      return schoolMasterDailyDataCollectionRef(schoolId);
    if (editingLevel === "department" && departmentId)
      return departmentMasterDailyDataCollectionRef(schoolId, departmentId);
    if (editingLevel === "grade" && gradeId)
      return gradeMasterDailyDataCollectionRef(schoolId, gradeId, departmentId);
    if (gradeId && classId)
      return dailyDataCollectionRef(schoolId, gradeId, classId, departmentId);
    return null;
  }, [schoolId, gradeId, classId, departmentId, editingLevel]);

  const getDailyDataDocPath = useCallback(
    (dateStr: string) => {
      if (!schoolId) return null;
      if (editingLevel === "school")
        return schoolMasterDailyDataDocRef(schoolId, dateStr);
      if (editingLevel === "department" && departmentId)
        return departmentMasterDailyDataDocRef(schoolId, departmentId, dateStr);
      if (editingLevel === "grade" && gradeId)
        return gradeMasterDailyDataDocRef(
          schoolId,
          gradeId,
          dateStr,
          departmentId
        );
      if (gradeId && classId)
        return dailyDataDocRef(
          schoolId,
          gradeId,
          classId,
          dateStr,
          departmentId
        );
      return null;
    },
    [schoolId, gradeId, classId, departmentId, editingLevel]
  );

  // リスナー起動
  useEffect(() => {
    // 既存リスナーを停止
    unsubscribersRef.current.forEach((u) => u());
    unsubscribersRef.current = [];

    const hasRequiredContext =
      (editingLevel === "school" && schoolId) ||
      (editingLevel === "department" && schoolId && departmentId) ||
      (editingLevel === "grade" && schoolId && gradeId) ||
      (editingLevel === "class" && schoolId && gradeId && classId);

    if (!hasRequiredContext) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const todayStr = getTodayString();

    // クラスレベルの場合のみ設定を監視
    if (editingLevel === "class" && schoolId && gradeId && classId) {
      const configRef = classDocRef(schoolId, gradeId, classId, departmentId);
      const unsubConfig = onSnapshot(configRef, (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setData((prev) => ({
            ...prev,
            className: d.name || "",
            ads: d.displaySettings?.ads || [],
          }));
        }
      });
      unsubscribersRef.current.push(unsubConfig);
    }

    // 日次データリスナー
    const dailyRef = getDailyDataCollectionPath();
    if (!dailyRef) {
      setLoading(false);
      return;
    }

    const q = query(
      dailyRef,
      where("date", ">=", getDaysAgoStr(5)),
      orderBy("date", "asc"),
      limit(30)
    );

    const unsubDaily = onSnapshot(q, (snapshot) => {
      const weeklySchedules: Record<string, Schedule[]> = {};
      const allSchedules: Record<string, ScheduleWithMeta[]> = {};
      const notices: NoticeWithMeta[] = [];
      const allNotices: NoticeWithMeta[] = [];
      const assignments: AssignmentWithMeta[] = [];
      const allAssignments: AssignmentWithMeta[] = [];

      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const dateKey = d.date as string;

        if (dateKey >= todayStr && d.schedules?.length > 0) {
          weeklySchedules[dateKey] = d.schedules;
        }

        if (d.schedules?.length > 0) {
          allSchedules[dateKey] = d.schedules.map(
            (s: Schedule, idx: number) => ({
              ...s,
              _sourceDate: dateKey,
              _originalIndex: idx,
            })
          );
        }

        if (d.notices?.length > 0) {
          d.notices.forEach((notice: Notice, idx: number) => {
            const ds = notice.display_start || dateKey;
            const de = notice.display_end || dateKey;
            const item: NoticeWithMeta = {
              ...notice,
              _sourceDate: dateKey,
              _originalIndex: idx,
            };
            allNotices.push(item);
            if (todayStr >= ds && todayStr <= de) notices.push(item);
          });
        }

        if (d.assignments?.length > 0) {
          d.assignments.forEach((a: Assignment, idx: number) => {
            const item: AssignmentWithMeta = {
              ...a,
              _sourceDate: dateKey,
              _originalIndex: idx,
            };
            assignments.push(item);
            allAssignments.push(item);
          });
        }
      });

      assignments.sort(
        (a, b) =>
          new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      );

      setData((prev) => ({
        ...prev,
        weeklySchedules,
        allSchedules,
        notices,
        allNotices,
        assignments,
        allAssignments,
      }));
      setLoading(false);
    });

    unsubscribersRef.current.push(unsubDaily);

    return () => {
      unsubscribersRef.current.forEach((u) => u());
      unsubscribersRef.current = [];
    };
  }, [schoolId, gradeId, classId, departmentId, editingLevel, getDailyDataCollectionPath]);

  const getGradeFanoutRefs = useCallback(
    (dateStr: string) => {
      if (
        editingLevel !== "grade" ||
        !schoolId ||
        !departmentId ||
        gradeSiblings.length === 0
      ) {
        return [];
      }
      const seen = new Set<string>();
      const refs = [];
      for (const p of gradeSiblings) {
        if (p.departmentId === departmentId && p.gradeId === gradeId) continue;
        const key = `${p.departmentId}:${p.gradeId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        refs.push(
          gradeMasterDailyDataDocRef(
            schoolId,
            p.gradeId,
            dateStr,
            p.departmentId
          )
        );
      }
      return refs;
    },
    [editingLevel, schoolId, departmentId, gradeId, gradeSiblings]
  );

  /**
   * 楽観的 UI 更新ヘルパー:
   * Firestore 書き込み完了前に手元の state を先に更新し、onSnapshot からの反映を
   * 待たずに画面に結果を見せる。Firestore への書き込みが失敗した場合は再 fetch して
   * 実サーバー状態へ巻き戻す。回線が遅い学校環境でも操作完了感が即座に得られる。
   */
  const applyLocalSave = useCallback(
    (
      type: "schedule" | "notice" | "assignment",
      dateStr: string,
      index: number | null,
      item: Record<string, unknown>
    ) => {
      setData((prev) => {
        const next = { ...prev };
        // 楽観的更新では item は「必要フィールドを含む Record<string, unknown>」として
        // 渡される。strict な Schedule/Notice/Assignment へは unknown 経由でキャストする。
        const itemAsSchedule = item as unknown as Schedule;
        const itemAsNotice = item as unknown as Notice;
        const itemAsAssignment = item as unknown as Assignment;

        if (type === "schedule") {
          const weekly = { ...prev.weeklySchedules };
          const all = { ...prev.allSchedules };
          const wlist = [...((weekly[dateStr] as Schedule[]) || [])];
          const alist = [...((all[dateStr] as ScheduleWithMeta[]) || [])];
          if (index !== null && index >= 0 && index < wlist.length) {
            wlist[index] = itemAsSchedule;
            alist[index] = {
              ...itemAsSchedule,
              _sourceDate: dateStr,
              _originalIndex: index,
            };
          } else {
            wlist.push(itemAsSchedule);
            alist.push({
              ...itemAsSchedule,
              _sourceDate: dateStr,
              _originalIndex: alist.length,
            });
          }
          weekly[dateStr] = wlist;
          all[dateStr] = alist;
          next.weeklySchedules = weekly;
          next.allSchedules = all;
        } else if (type === "notice") {
          const notices = [...prev.notices];
          const allN = [...prev.allNotices];
          const targetIdx = allN.findIndex(
            (n) => n._sourceDate === dateStr && n._originalIndex === index
          );
          const meta: NoticeWithMeta = {
            ...itemAsNotice,
            _sourceDate: dateStr,
            _originalIndex:
              index !== null
                ? index
                : allN.filter((n) => n._sourceDate === dateStr).length,
          };
          if (targetIdx >= 0) {
            allN[targetIdx] = meta;
            const ni = notices.findIndex(
              (n) => n._sourceDate === dateStr && n._originalIndex === index
            );
            if (ni >= 0) notices[ni] = meta;
          } else {
            allN.push(meta);
            notices.push(meta);
          }
          next.notices = notices;
          next.allNotices = allN;
        } else if (type === "assignment") {
          const ass = [...prev.assignments];
          const allA = [...prev.allAssignments];
          const targetIdx = allA.findIndex(
            (a) => a._sourceDate === dateStr && a._originalIndex === index
          );
          const meta: AssignmentWithMeta = {
            ...itemAsAssignment,
            _sourceDate: dateStr,
            _originalIndex:
              index !== null
                ? index
                : allA.filter((a) => a._sourceDate === dateStr).length,
          };
          if (targetIdx >= 0) {
            allA[targetIdx] = meta;
            const ai = ass.findIndex(
              (a) => a._sourceDate === dateStr && a._originalIndex === index
            );
            if (ai >= 0) ass[ai] = meta;
          } else {
            allA.push(meta);
            ass.push(meta);
          }
          ass.sort(
            (a, b) =>
              new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
          );
          next.assignments = ass;
          next.allAssignments = allA;
        }
        return next;
      });
    },
    []
  );

  const applyLocalDelete = useCallback(
    (
      type: "schedule" | "notice" | "assignment",
      dateStr: string,
      index: number
    ) => {
      setData((prev) => {
        const next = { ...prev };
        if (type === "schedule") {
          const weekly = { ...prev.weeklySchedules };
          const all = { ...prev.allSchedules };
          const wlist = [...((weekly[dateStr] as Schedule[]) || [])];
          const alist = [...((all[dateStr] as ScheduleWithMeta[]) || [])];
          if (index >= 0 && index < wlist.length) wlist.splice(index, 1);
          if (index >= 0 && index < alist.length) alist.splice(index, 1);
          weekly[dateStr] = wlist;
          all[dateStr] = alist;
          next.weeklySchedules = weekly;
          next.allSchedules = all;
        } else if (type === "notice") {
          next.notices = prev.notices.filter(
            (n) => !(n._sourceDate === dateStr && n._originalIndex === index)
          );
          next.allNotices = prev.allNotices.filter(
            (n) => !(n._sourceDate === dateStr && n._originalIndex === index)
          );
        } else if (type === "assignment") {
          next.assignments = prev.assignments.filter(
            (a) => !(a._sourceDate === dateStr && a._originalIndex === index)
          );
          next.allAssignments = prev.allAssignments.filter(
            (a) => !(a._sourceDate === dateStr && a._originalIndex === index)
          );
        }
        return next;
      });
    },
    []
  );

  const saveItem = useCallback(
    async (
      type: "schedule" | "notice" | "assignment",
      dateStr: string,
      index: number | null,
      item: Record<string, unknown>
    ) => {
      const docRef = getDailyDataDocPath(dateStr);
      if (!docRef) throw new Error("コンテキストが不足しています");

      // マスターモード時はソース情報を付与
      if (editingLevel === "school") item._source = "school";
      else if (editingLevel === "department") item._source = "department";
      else if (editingLevel === "grade") item._source = "grade";

      // 1) 楽観的に UI を更新（即時反映）
      applyLocalSave(type, dateStr, index, item);

      // 2) Firestore に書き込み（成功時は onSnapshot が追従、失敗時は巻き戻し）
      try {
        const snap = await getDoc(docRef);
        const docData = snap.exists() ? snap.data() : { date: dateStr };
        const field = FIELD_MAP[type];
        const list = [...(docData[field] || [])];

        if (index !== null) {
          list[index] = item;
        } else {
          list.push(item);
        }

        if (snap.exists()) {
          await updateDoc(docRef, { [field]: list });
        } else {
          await setDoc(docRef, { ...docData, [field]: list });
        }

        // 学科モードの学年マスターは同名学年へファンアウト
        const fanoutRefs = getGradeFanoutRefs(dateStr);
        if (fanoutRefs.length > 0) {
          await Promise.all(
            fanoutRefs.map(async (ref) => {
              const s = await getDoc(ref);
              const d = s.exists() ? s.data() : { date: dateStr };
              const l = [...(d[field] || [])];
              if (index !== null) l[index] = item;
              else l.push(item);
              if (s.exists()) {
                await updateDoc(ref, { [field]: l });
              } else {
                await setDoc(ref, { ...d, [field]: l });
              }
            })
          );
        }
      } catch (err) {
        // 書き込み失敗: onSnapshot が次に発火したときに正しい状態へ巻き戻される。
        // ここでは例外を呼び出し側へ伝搬し、トーストで失敗を通知してもらう。
        throw err;
      }
    },
    [getDailyDataDocPath, editingLevel, getGradeFanoutRefs, applyLocalSave]
  );

  const deleteItem = useCallback(
    async (
      type: "schedule" | "notice" | "assignment",
      dateStr: string,
      index: number
    ) => {
      const docRef = getDailyDataDocPath(dateStr);
      if (!docRef) return;

      // 1) 楽観的に UI から削除
      applyLocalDelete(type, dateStr, index);

      // 2) Firestore から削除（失敗時は onSnapshot が巻き戻す）
      try {
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;
        const field = FIELD_MAP[type];
        const list = [...(snap.data()[field] || [])];
        if (index >= 0 && index < list.length) {
          list.splice(index, 1);
          await updateDoc(docRef, { [field]: list });
        }

        // 学科モードの学年マスターは同名学年へファンアウト
        const fanoutRefs = getGradeFanoutRefs(dateStr);
        if (fanoutRefs.length > 0) {
          await Promise.all(
            fanoutRefs.map(async (ref) => {
              const s = await getDoc(ref);
              if (!s.exists()) return;
              const l = [...(s.data()[field] || [])];
              if (index >= 0 && index < l.length) {
                l.splice(index, 1);
                await updateDoc(ref, { [field]: l });
              }
            })
          );
        }
      } catch (err) {
        throw err;
      }
    },
    [getDailyDataDocPath, getGradeFanoutRefs, applyLocalDelete]
  );

  const saveClassName = useCallback(
    async (name: string) => {
      if (!schoolId || !gradeId || !classId) return;
      const docRef = classDocRef(schoolId, gradeId, classId, departmentId);
      await updateDoc(docRef, { name });
    },
    [schoolId, gradeId, classId, departmentId]
  );

  return {
    data,
    loading,
    editingLevel,
    setEditingLevel,
    saveItem,
    deleteItem,
    saveClassName,
  };
}
