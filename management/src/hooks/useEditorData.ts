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
  departmentId: string | null = null
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

  const saveItem = useCallback(
    async (
      type: "schedule" | "notice" | "assignment",
      dateStr: string,
      index: number | null,
      item: Record<string, unknown>
    ) => {
      const docRef = getDailyDataDocPath(dateStr);
      if (!docRef) throw new Error("コンテキストが不足しています");

      const snap = await getDoc(docRef);
      const docData = snap.exists()
        ? snap.data()
        : { date: dateStr };
      const field = FIELD_MAP[type];
      const list = [...(docData[field] || [])];

      // マスターモード時はソース情報を付与
      if (editingLevel === "school") item._source = "school";
      else if (editingLevel === "department") item._source = "department";
      else if (editingLevel === "grade") item._source = "grade";

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
    },
    [getDailyDataDocPath, editingLevel]
  );

  const deleteItem = useCallback(
    async (
      type: "schedule" | "notice" | "assignment",
      dateStr: string,
      index: number
    ) => {
      const docRef = getDailyDataDocPath(dateStr);
      if (!docRef) return;
      const snap = await getDoc(docRef);
      if (!snap.exists()) return;
      const field = FIELD_MAP[type];
      const list = [...(snap.data()[field] || [])];
      if (index >= 0 && index < list.length) {
        list.splice(index, 1);
        await updateDoc(docRef, { [field]: list });
      }
    },
    [getDailyDataDocPath]
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
