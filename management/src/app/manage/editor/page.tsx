"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ContextSelector } from "@/components/context/ContextSelector";
import { EditorSchoolPicker } from "@/components/editor/EditorSchoolPicker";
import { EditorTargetMenu } from "@/components/editor/EditorTargetMenu";
import { ScheduleSection } from "@/components/editor/ScheduleSection";
import { NoticeSection } from "@/components/editor/NoticeSection";
import { AssignmentSection } from "@/components/editor/AssignmentSection";
import { ContentEditModal } from "@/components/editor/ContentEditModal";
import { CalendarView } from "@/components/editor/CalendarView";
import { HistoryModal } from "@/components/editor/HistoryModal";
import { Loading } from "@/components/ui/Loading";
import { Header } from "@/components/ui/Header";
import { useSchoolContextValue } from "@/providers/SchoolContextProvider";
import { useAuthContext } from "@/providers/AuthProvider";
import { useEditorData, type EditingLevel } from "@/hooks/useEditorData";
import { useToast } from "@/components/ui/Toast";
import {
  listSchoolsFn,
  listGradesFn,
  listClassesFn,
  listDepartmentsFn,
  copyMasterToClassesFn,
} from "@/lib/firebase-functions";
import { getTodayString, escapeHtml } from "@/lib/utils";
import type {
  School,
  Grade,
  Class,
  Department,
  HierarchyMode,
} from "@/types/school";
import styles from "@/styles/editor.module.css";

type ContentType = "schedule" | "notice" | "assignment";

function EditorContent() {
  const { schoolId, gradeId, classId, hasFullContext, setContext } =
    useSchoolContextValue();
  const { isAdmin, isSchoolAdmin } = useAuthContext();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const urlLevel = searchParams.get("level");
  const urlDepartment = searchParams.get("department");
  const canEditMaster = isAdmin || isSchoolAdmin;

  const [selectedDepartmentId, setSelectedDepartmentId] = useState<
    string | null
  >(urlDepartment);

  const {
    data,
    loading,
    editingLevel,
    setEditingLevel,
    saveItem,
    deleteItem,
  } = useEditorData(schoolId, gradeId, classId, selectedDepartmentId);

  // URL ?level= からの初期同期
  useEffect(() => {
    if (!canEditMaster) return;
    if (
      urlLevel === "school" ||
      urlLevel === "grade" ||
      urlLevel === "department" ||
      urlLevel === "class"
    ) {
      if (urlLevel !== editingLevel) setEditingLevel(urlLevel);
    }
  }, [urlLevel, canEditMaster, editingLevel, setEditingLevel]);

  useEffect(() => {
    if (urlDepartment) setSelectedDepartmentId(urlDepartment);
  }, [urlDepartment]);

  const hasRequiredContext =
    (editingLevel === "school" && !!schoolId) ||
    (editingLevel === "department" && !!schoolId && !!selectedDepartmentId) ||
    (editingLevel === "grade" && !!schoolId && !!gradeId) ||
    (editingLevel === "class" && hasFullContext);

  // セレクタ用
  const [schools, setSchools] = useState<School[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [hierarchyMode, setHierarchyMode] = useState<HierarchyMode>("class");

  // 時計
  const [currentTime, setCurrentTime] = useState("");

  // モーダル
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ContentType>("schedule");
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [modalDateStr, setModalDateStr] = useState(getTodayString());
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [modalInitialData, setModalInitialData] = useState<
    Record<string, unknown> | undefined
  >();

  // カレンダー・履歴モーダル
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyType, setHistoryType] = useState<"notice" | "assignment">(
    "notice"
  );

  // 時計更新
  useEffect(() => {
    const update = () => {
      setCurrentTime(
        new Date().toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // 学校一覧と現在の学校の hierarchyMode、学科一覧（学科モード時）
  useEffect(() => {
    async function load() {
      if (!schoolId) return;
      try {
        const schoolRes = await listSchoolsFn();
        const allSchools = schoolRes.data.schools || [];
        setSchools(allSchools);
        const currentSchool = allSchools.find((s) => s.id === schoolId);
        const mode: "class" | "department" =
          currentSchool?.hierarchyMode || "class";
        setHierarchyMode(mode);
        if (mode === "department") {
          const depts = await listDepartmentsFn({ schoolId });
          setDepartments(depts.data.departments || []);
        } else {
          setDepartments([]);
        }
      } catch {
        /* ignore */
      }
    }
    load();
  }, [schoolId]);

  // 学年一覧をモードに応じて取得
  useEffect(() => {
    async function loadGrades() {
      if (!schoolId) {
        setGrades([]);
        return;
      }
      try {
        if (hierarchyMode === "department") {
          if (!selectedDepartmentId) {
            setGrades([]);
            return;
          }
          const res = await listGradesFn({
            schoolId,
            departmentId: selectedDepartmentId,
          });
          setGrades(res.data.grades || []);
        } else {
          const res = await listGradesFn({ schoolId });
          setGrades(res.data.grades || []);
        }
      } catch {
        setGrades([]);
      }
    }
    loadGrades();
  }, [schoolId, hierarchyMode, selectedDepartmentId]);

  // クラス一覧
  useEffect(() => {
    async function loadClasses() {
      if (!schoolId || !gradeId) {
        setClasses([]);
        return;
      }
      try {
        const res = await listClassesFn({
          schoolId,
          gradeId,
          departmentId:
            hierarchyMode === "department" ? selectedDepartmentId : null,
        });
        setClasses(res.data.classes || []);
      } catch {
        setClasses([]);
      }
    }
    loadClasses();
  }, [schoolId, gradeId, hierarchyMode, selectedDepartmentId]);

  const handleContextSelected = useCallback(
    (s: string, g: string, c: string) => setContext(s, g, c),
    [setContext]
  );

  // モーダル操作
  const openEditModal = (type: ContentType, dateStr: string, index: number) => {
    let found: unknown;
    if (type === "schedule") {
      found = data.allSchedules[dateStr]?.find(
        (s) => s._originalIndex === index
      );
    } else if (type === "notice") {
      found = data.allNotices.find(
        (n) => n._sourceDate === dateStr && n._originalIndex === index
      );
    } else {
      found = data.allAssignments.find(
        (a) => a._sourceDate === dateStr && a._originalIndex === index
      );
    }
    const initialData = found as Record<string, unknown> | undefined;
    setModalType(type);
    setModalMode("edit");
    setModalDateStr(dateStr);
    setModalIndex(index);
    setModalInitialData(initialData as Record<string, unknown> | undefined);
    setModalOpen(true);
  };

  const openAddModal = (type: ContentType, dateStr: string) => {
    const today = getTodayString();
    const defaults: Record<string, Record<string, unknown>> = {
      schedule: { display_start: dateStr, display_end: dateStr },
      notice: { display_start: today, display_end: today },
      assignment: { deadline: today },
    };
    setModalType(type);
    setModalMode("add");
    setModalDateStr(dateStr);
    setModalIndex(null);
    setModalInitialData(defaults[type]);
    setModalOpen(true);
  };

  const handleDelete = async (
    type: ContentType,
    dateStr: string,
    index: number
  ) => {
    if (!confirm("削除しますか？")) return;
    try {
      await deleteItem(type, dateStr, index);
      showToast("削除しました", "success");
    } catch (err) {
      showToast("削除エラー: " + (err as Error).message, "error");
    }
  };

  const handleSave = async (
    type: ContentType,
    dateStr: string,
    index: number | null,
    itemData: Record<string, unknown>
  ) => {
    await saveItem(type, dateStr, index, itemData);
    showToast("保存しました", "success");
  };

  const handleCopyToClasses = async () => {
    const levelLabel =
      editingLevel === "school" ? "学校マスター" : "学年マスター";
    const targetLabel =
      editingLevel === "school" ? "全学年の全クラス" : "学年内の全クラス";
    if (
      !confirm(
        `${levelLabel}の今日のデータを${targetLabel}にコピーしますか？`
      )
    )
      return;
    try {
      await copyMasterToClassesFn({
        schoolId: schoolId!,
        gradeId: gradeId || undefined,
        sourceLevel: editingLevel as "school" | "grade",
        dateStr: getTodayString(),
        contentType: "all",
      });
      showToast("コピーが完了しました", "success");
    } catch (err) {
      showToast("コピーエラー: " + (err as Error).message, "error");
    }
  };

  const handleGradeChange = (newGradeId: string) => {
    if (!schoolId) return;
    setContext(schoolId, newGradeId || null, null);
  };

  const handleClassChange = (newClassId: string) => {
    if (schoolId && gradeId) {
      setContext(schoolId, gradeId, newClassId);
    }
  };

  if (!hasRequiredContext) {
    return <ContextSelector onSelected={handleContextSelected} />;
  }

  if (loading) {
    return <Loading message="データを読み込み中..." />;
  }

  const currentSchool = schools.find((s) => s.id === schoolId);
  const schoolName = currentSchool
    ? escapeHtml(currentSchool.name)
    : schoolId || "";

  const headerTitle =
    editingLevel === "school"
      ? "学校マスター"
      : editingLevel === "grade"
        ? "学年マスター"
        : editingLevel === "department"
          ? `学科マスター — ${departments.find((d) => d.id === selectedDepartmentId)?.name || ""}`
          : data.className || "エディター";

  return (
    <>
      <Header title={headerTitle} />
      <div className={styles.editorLayout}>
      <div className={styles.pageContainer}>
      {/* 時計 */}
      <div className={styles.header}>
        <span className={styles.clock}>{currentTime}</span>
      </div>

      {/* セレクタ: 学校 > 学科(dept mode) > 学年 > クラス */}
      <div className={styles.selectorRow}>
        <span className={styles.selectorLabel}>{schoolName}</span>
        {hierarchyMode === "department" && (
          <>
            <span className={styles.selectorDivider}>/</span>
            <select
              value={selectedDepartmentId || ""}
              onChange={(e) => {
                setSelectedDepartmentId(e.target.value || null);
                setContext(schoolId!, null, null);
              }}
              disabled={editingLevel === "school"}
            >
              <option value="">-- 学科 --</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </>
        )}
        <span className={styles.selectorDivider}>/</span>
        <select
          value={gradeId || ""}
          onChange={(e) => handleGradeChange(e.target.value)}
          disabled={
            editingLevel === "school" ||
            editingLevel === "department" ||
            (hierarchyMode === "department" && !selectedDepartmentId)
          }
        >
          <option value="">-- 学年 --</option>
          {grades.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <span className={styles.selectorDivider}>/</span>
        <select
          value={classId || ""}
          onChange={(e) => handleClassChange(e.target.value)}
          disabled={editingLevel !== "class" || !gradeId}
        >
          <option value="">-- クラス --</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* 編集レベル（管理者 / 学校管理者） */}
      {canEditMaster && (
        <div className={styles.levelSelector}>
          {(
            hierarchyMode === "department"
              ? ([
                  { key: "class", label: "クラス", color: "#6c757d" },
                  {
                    key: "department",
                    label: "学科マスター",
                    color: "#9b59b6",
                  },
                  {
                    key: "grade",
                    label: "学年マスター",
                    color: "#28a745",
                  },
                  {
                    key: "school",
                    label: "学校マスター",
                    color: "#007bff",
                  },
                ] as const)
              : ([
                  { key: "class", label: "クラス", color: "#6c757d" },
                  {
                    key: "grade",
                    label: "学年マスター",
                    color: "#28a745",
                  },
                  {
                    key: "school",
                    label: "学校マスター",
                    color: "#007bff",
                  },
                ] as const)
          ).map((l) => {
            const deptDisabled =
              l.key === "department" && !selectedDepartmentId;
            return (
              <button
                key={l.key}
                className={styles.levelBtn}
                style={{
                  borderColor: l.color,
                  background:
                    editingLevel === l.key ? l.color : "#fff",
                  color: editingLevel === l.key ? "#fff" : l.color,
                  opacity: deptDisabled ? 0.5 : 1,
                }}
                disabled={deptDisabled}
                onClick={() => setEditingLevel(l.key as EditingLevel)}
                title={
                  deptDisabled
                    ? "先に学科を選択してください"
                    : ""
                }
              >
                {l.label}
              </button>
            );
          })}
        </div>
      )}

      {editingLevel !== "class" && (
        <div
          className={styles.levelIndicator}
          style={{
            background:
              editingLevel === "school"
                ? "#007bff"
                : editingLevel === "department"
                  ? "#9b59b6"
                  : "#28a745",
          }}
        >
          <span>
            {editingLevel === "school"
              ? "学校マスター編集モード — 全クラスに自動反映されます"
              : editingLevel === "department"
                ? "学科マスター編集モード — 同学科に属する全クラスに自動反映されます"
                : "学年マスター編集モード — 学年内全クラスに自動反映されます"}
          </span>
          {editingLevel !== "department" && (
            <button
              className="btn btn-sm"
              style={{
                background: "#fff",
                color: editingLevel === "school" ? "#007bff" : "#28a745",
                border: "none",
                fontWeight: "bold",
              }}
              onClick={handleCopyToClasses}
            >
              全クラスにコピー
            </button>
          )}
        </div>
      )}

      {/* コンテンツセクション */}
      <ScheduleSection
        weeklySchedules={data.weeklySchedules}
        onEdit={(d, i) => openEditModal("schedule", d, i)}
        onDelete={(d, i) => handleDelete("schedule", d, i)}
        onAdd={(d) => openAddModal("schedule", d)}
      />

      <NoticeSection
        notices={data.notices}
        onEdit={(d, i) => openEditModal("notice", d, i)}
        onDelete={(d, i) => handleDelete("notice", d, i)}
        onAdd={(d) => openAddModal("notice", d)}
        onShowHistory={() => {
          setHistoryType("notice");
          setHistoryOpen(true);
        }}
      />

      <AssignmentSection
        assignments={data.assignments}
        onEdit={(d, i) => openEditModal("assignment", d, i)}
        onDelete={(d, i) => handleDelete("assignment", d, i)}
        onAdd={(d) => openAddModal("assignment", d)}
        onShowHistory={() => {
          setHistoryType("assignment");
          setHistoryOpen(true);
        }}
      />

      {/* カレンダーボタン */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <button
          className="btn btn-secondary"
          onClick={() => setCalendarOpen(true)}
        >
          カレンダーを開く
        </button>
      </div>

      {/* カレンダーモーダル */}
      <CalendarView
        isOpen={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        allSchedules={data.allSchedules}
        allNotices={data.allNotices}
        allAssignments={data.allAssignments}
        onEdit={(type, d, i) => openEditModal(type, d, i)}
        onDelete={(type, d, i) => handleDelete(type, d, i)}
        onAdd={(type, d) => openAddModal(type, d)}
      />

      {/* 履歴モーダル */}
      <HistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        type={historyType}
        notices={data.allNotices}
        assignments={data.allAssignments}
        onReuseNotice={(text, isHighlight) => {
          openAddModal("notice", getTodayString());
          setTimeout(() => {
            setModalInitialData({
              text,
              is_highlight: isHighlight,
              display_start: getTodayString(),
              display_end: getTodayString(),
            });
          }, 50);
        }}
        onReuseAssignment={(subject, task) => {
          openAddModal("assignment", getTodayString());
          setTimeout(() => {
            setModalInitialData({
              subject,
              task,
              deadline: getTodayString(),
            });
          }, 50);
        }}
      />

      {/* 編集モーダル */}
      <ContentEditModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        type={modalType}
        mode={modalMode}
        dateStr={modalDateStr}
        index={modalIndex}
        initialData={modalInitialData}
        onSave={handleSave}
      />

      <footer className={styles.branding}>キミテラス by Rebounder（管理者モード）</footer>
    </div>

      {/* 広告プレビューパネル（クラスレベルのみ） */}
      {editingLevel === "class" && (
        <aside className={styles.adPreview}>
          <div className={styles.adPreviewContainer}>
            {data.ads.length > 0 ? (
              <img
                src={data.ads[0].url}
                alt="広告プレビュー"
                className={styles.adPreviewImage}
              />
            ) : (
              <div className={styles.adPreviewPlaceholder}>No Image</div>
            )}
            <div className={styles.adPreviewOverlay}>
              <a
                href={`/manage/class-settings?school=${schoolId}&grade=${gradeId}&class=${classId}`}
                className="btn btn-sm btn-primary"
                style={{ textDecoration: "none" }}
              >
                広告を管理
              </a>
            </div>
          </div>
        </aside>
      )}
    </div>
    </>
  );
}

function EditorRouter() {
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");
  const level = searchParams.get("level");
  const gradeParam = searchParams.get("grade");
  const classParam = searchParams.get("class");
  const deptParam = searchParams.get("department");

  if (!schoolParam) {
    return <EditorSchoolPicker basePath="/manage/editor" />;
  }

  const hasTarget =
    level === "school" ||
    (level === "department" && !!deptParam) ||
    (level === "grade" && !!gradeParam) ||
    (!level && !!gradeParam && !!classParam);

  if (!hasTarget) {
    return (
      <AuthGuard requiredRole="editor" loginMode="editor">
        <EditorTargetMenu
          schoolId={schoolParam}
          basePath="/manage/editor"
        />
      </AuthGuard>
    );
  }

  return (
    <AuthGuard requiredRole="editor" loginMode="editor">
      <EditorContent />
    </AuthGuard>
  );
}

export default function EditorPage() {
  return <EditorRouter />;
}
