"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ContextSelector } from "@/components/context/ContextSelector";
import { EditorSchoolPicker } from "@/components/editor/EditorSchoolPicker";
import { EditorTargetMenu } from "@/components/editor/EditorTargetMenu";
import { EditorModeToggle } from "@/components/editor/EditorModeToggle";
import { ScheduleSection } from "@/components/editor/ScheduleSection";
import {
  ScheduleTemplateModal,
  emptyWeeklyTemplate,
  weekdayKeyOf,
  type WeeklyTemplate,
} from "@/components/editor/ScheduleTemplateModal";
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

  const [gradeSiblings, setGradeSiblings] = useState<
    { departmentId: string; gradeId: string }[]
  >([]);

  const {
    data,
    loading,
    editingLevel,
    setEditingLevel,
    saveItem,
    deleteItem,
  } = useEditorData(
    schoolId,
    gradeId,
    classId,
    selectedDepartmentId,
    gradeSiblings
  );

  // URL ?level= からの同期は「URLが変わったときのみ」実行する。
  // editingLevel を依存に入れるとユーザーのボタン操作を URL 値で打ち消してしまう。
  const lastSyncedUrlLevel = useRef<string | null>(null);
  useEffect(() => {
    if (!canEditMaster) return;
    if (lastSyncedUrlLevel.current === urlLevel) return;
    if (
      urlLevel === "school" ||
      urlLevel === "grade" ||
      urlLevel === "department" ||
      urlLevel === "class"
    ) {
      setEditingLevel(urlLevel);
      lastSyncedUrlLevel.current = urlLevel;
    }
  }, [urlLevel, canEditMaster, setEditingLevel]);

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
  /** 学科モード: 全学科の学年一覧（同名学年のファンアウトに使用） */
  const [allGradesByDept, setAllGradesByDept] = useState<
    Record<string, Grade[]>
  >({});

  // 学科モードで学年マスター編集中: 同名学年の (dept, grade) を算出
  useEffect(() => {
    if (
      hierarchyMode !== "department" ||
      !selectedDepartmentId ||
      !gradeId
    ) {
      setGradeSiblings([]);
      return;
    }
    const myList = allGradesByDept[selectedDepartmentId] || [];
    const myGrade = myList.find((g) => g.id === gradeId);
    if (!myGrade) {
      setGradeSiblings([]);
      return;
    }
    const siblings: { departmentId: string; gradeId: string }[] = [];
    Object.entries(allGradesByDept).forEach(([deptId, gs]) => {
      gs.forEach((g) => {
        if (g.name === myGrade.name) {
          siblings.push({ departmentId: deptId, gradeId: g.id });
        }
      });
    });
    setGradeSiblings(siblings);
  }, [hierarchyMode, selectedDepartmentId, gradeId, allGradesByDept]);

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

  // 時間割テンプレート
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [scheduleTemplate, setScheduleTemplate] = useState<WeeklyTemplate>(
    emptyWeeklyTemplate()
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
          const deptList = depts.data.departments || [];
          setDepartments(deptList);
          // 全学科の学年一覧を取得（同名学年マスターのファンアウトに使用）
          const byDept: Record<string, Grade[]> = {};
          await Promise.all(
            deptList.map(async (d) => {
              try {
                const r = await listGradesFn({
                  schoolId,
                  departmentId: d.id,
                });
                byDept[d.id] = r.data.grades || [];
              } catch {
                byDept[d.id] = [];
              }
            })
          );
          setAllGradesByDept(byDept);
        } else {
          setDepartments([]);
          setAllGradesByDept({});
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

  const openAddModal = (
    type: ContentType,
    dateStr: string,
    overrideData?: Record<string, unknown>
  ) => {
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
    setModalInitialData({ ...defaults[type], ...(overrideData || {}) });
    setModalOpen(true);
  };

  const handleDelete = async (
    type: ContentType,
    dateStr: string,
    index: number
  ) => {
    const label =
      type === "schedule" ? "予定" : type === "notice" ? "連絡" : "提出物";
    // 対象物の種類を引用し、結果を明記する。色に依存せず文言で意味を伝える。
    if (!confirm(`この${label}を消しますか？ 消すと元に戻せません。`)) return;
    try {
      await deleteItem(type, dateStr, index);
      showToast("消しました", "success");
    } catch (err) {
      showToast("消せませんでした: " + (err as Error).message, "error");
    }
  };

  // テンプレートをFirestoreから購読
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!schoolId) return;
      try {
        const { getDoc } = await import("firebase/firestore");
        const { scheduleTemplatesRef } = await import("@/lib/paths");
        const snap = await getDoc(scheduleTemplatesRef(schoolId));
        if (cancelled) return;
        if (snap.exists()) {
          const weekly = (snap.data().weekly || {}) as Partial<WeeklyTemplate>;
          const merged = emptyWeeklyTemplate();
          (Object.keys(merged) as (keyof WeeklyTemplate)[]).forEach((k) => {
            if (Array.isArray(weekly[k])) merged[k] = weekly[k]!;
          });
          setScheduleTemplate(merged);
        } else {
          setScheduleTemplate(emptyWeeklyTemplate());
        }
      } catch {
        /* ignore */
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [schoolId, templateModalOpen]);

  const templateCountFor = useCallback(
    (dateStr: string): number => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 0;
      return scheduleTemplate[weekdayKeyOf(d)]?.length || 0;
    },
    [scheduleTemplate]
  );

  const handleApplyTemplate = async (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return;
    const items = scheduleTemplate[weekdayKeyOf(d)] || [];
    if (items.length === 0) {
      showToast("この曜日の時間割テンプレートはまだありません", "error");
      return;
    }
    const existing = data.weeklySchedules[dateStr]?.length || 0;
    if (
      existing > 0 &&
      !confirm(
        `${dateStr} にはすでに ${existing} 件の予定があります。テンプレートを追加しますか？`
      )
    ) {
      return;
    }
    try {
      for (const item of items) {
        const payload: Record<string, unknown> = {
          time: item.time,
          content: item.content,
        };
        if (item.location) payload.location = item.location;
        await saveItem("schedule", dateStr, null, payload);
      }
      showToast(`${items.length}件の予定を入れました`, "success");
    } catch (err) {
      showToast("うまくいきませんでした: " + (err as Error).message, "error");
    }
  };

  const handleSave = async (
    type: ContentType,
    dateStr: string,
    index: number | null,
    itemData: Record<string, unknown>
  ) => {
    try {
      await saveItem(type, dateStr, index, itemData);
      showToast("保存しました", "success");
    } catch (err) {
      showToast("保存できませんでした: " + (err as Error).message, "error");
      throw err;
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
        <a
          href={`/manage/editor?school=${schoolId}`}
          className={styles.backLink}
        >
          ← クラスを選び直す
        </a>
        <EditorModeToggle
          currentBasePath="/manage/editor"
          style={{ marginRight: 12 }}
        />
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

      {/* 編集レベル（管理者 / 学校管理者）— 色ではなくラベルで識別 */}
      {canEditMaster && (
        <div className={styles.levelSelector}>
          {(
            hierarchyMode === "department"
              ? ([
                  { key: "class", label: "クラスだけ" },
                  { key: "department", label: "学科にまとめて" },
                  { key: "grade", label: "学年にまとめて" },
                  { key: "school", label: "学校全体にまとめて" },
                ] as const)
              : ([
                  { key: "class", label: "クラスだけ" },
                  { key: "grade", label: "学年にまとめて" },
                  { key: "school", label: "学校全体にまとめて" },
                ] as const)
          ).map((l) => {
            const needsGrade = l.key === "grade" && !gradeId;
            const needsDept =
              l.key === "department" && !selectedDepartmentId;
            const needsContext = needsGrade || needsDept;
            const isActive = editingLevel === l.key;
            return (
              <button
                key={l.key}
                className={`${styles.levelBtn} ${isActive ? styles.levelBtnActive : ""}`}
                onClick={() => {
                  if (needsContext) {
                    window.location.href = `/manage/editor?school=${schoolId}`;
                    return;
                  }
                  setEditingLevel(l.key as EditingLevel);
                }}
                title={
                  needsGrade
                    ? "先に対象学年を選んでください"
                    : needsDept
                      ? "先に対象学科を選んでください"
                      : ""
                }
                aria-pressed={isActive}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      )}

      {editingLevel !== "class" && (
        <div className={styles.levelIndicator} role="status">
          <span>
            {editingLevel === "school"
              ? "まとめて編集中 — この学校の全クラスに反映されます"
              : editingLevel === "department"
                ? "まとめて編集中 — 同じ学科の全クラスに反映されます"
                : hierarchyMode === "department" && gradeSiblings.length > 1
                  ? `まとめて編集中 — 同じ学年名の ${gradeSiblings.length} 学年すべてに反映されます`
                  : "まとめて編集中 — この学年の全クラスに反映されます"}
          </span>
        </div>
      )}

      {/* コンテンツセクション */}
      <ScheduleSection
        weeklySchedules={data.weeklySchedules}
        onEdit={(d, i) => openEditModal("schedule", d, i)}
        onDelete={(d, i) => handleDelete("schedule", d, i)}
        onAdd={(d) => openAddModal("schedule", d)}
        onOpenTemplate={
          canEditMaster ? () => setTemplateModalOpen(true) : undefined
        }
        onApplyTemplate={handleApplyTemplate}
        templateCountFor={templateCountFor}
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
          openAddModal("notice", getTodayString(), {
            text,
            is_highlight: isHighlight,
          });
        }}
        onReuseAssignment={(subject, task) => {
          openAddModal("assignment", getTodayString(), {
            subject,
            task,
          });
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

      {/* 時間割テンプレートモーダル */}
      <ScheduleTemplateModal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        schoolId={schoolId}
        onSaved={(t) => setScheduleTemplate(t)}
      />

      <footer className={styles.branding}>キミテラス by Rebounder（管理者モード）</footer>
    </div>

      {/* 広告プレビューパネル（クラスレベルのみ）— 連絡枠と広告枠を物理的にゾーニング
          広告の編集は学校管理者の権限が必要なため、このパネルは「見るだけ」。
          編集導線は /manage/admin?school=X からのみ。 */}
      {editingLevel === "class" && (
        <aside className={styles.adPreview} aria-label="広告枠プレビュー">
          <div className={styles.adPreviewContainer}>
            {data.ads.length > 0 ? (
              <img
                src={data.ads[0].url}
                alt="広告プレビュー"
                className={styles.adPreviewImage}
              />
            ) : (
              <div className={styles.adPreviewPlaceholder}>
                まだ広告がありません
              </div>
            )}
            <div className={styles.adPreviewOverlay}>
              <div>ここは広告の枠です（連絡とは分けて管理）</div>
              {canEditMaster ? (
                <a
                  href={`/manage/admin?school=${schoolId}`}
                  className="btn btn-sm btn-secondary"
                >
                  広告を整える（学校管理）
                </a>
              ) : (
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--color-text-muted)" }}>
                  広告の変更は学校の管理者にご相談ください
                </div>
              )}
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
