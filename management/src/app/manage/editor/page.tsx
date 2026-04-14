"use client";

import { useState, useEffect, useCallback } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ContextSelector } from "@/components/context/ContextSelector";
import { ScheduleSection } from "@/components/editor/ScheduleSection";
import { NoticeSection } from "@/components/editor/NoticeSection";
import { AssignmentSection } from "@/components/editor/AssignmentSection";
import { ContentEditModal } from "@/components/editor/ContentEditModal";
import { CalendarView } from "@/components/editor/CalendarView";
import { HistoryModal } from "@/components/editor/HistoryModal";
import { Loading } from "@/components/ui/Loading";
import { Header } from "@/components/ui/Header";
import { Modal } from "@/components/ui/Modal";
import { useSchoolContextValue } from "@/providers/SchoolContextProvider";
import { useAuthContext } from "@/providers/AuthProvider";
import { useEditorData, type EditingLevel } from "@/hooks/useEditorData";
import { useToast } from "@/components/ui/Toast";
import {
  listSchoolsFn,
  listGradesFn,
  listClassesFn,
  copyMasterToClassesFn,
} from "@/lib/firebase-functions";
import { getTodayString, escapeHtml } from "@/lib/utils";
import type { School, Grade, Class } from "@/types/school";
import styles from "@/styles/editor.module.css";

type ContentType = "schedule" | "notice" | "assignment";

function EditorContent() {
  const { schoolId, gradeId, classId, hasFullContext, setContext } =
    useSchoolContextValue();
  const { isAdmin } = useAuthContext();
  const { showToast } = useToast();

  const {
    data,
    loading,
    editingLevel,
    setEditingLevel,
    saveItem,
    deleteItem,
    saveClassName,
  } = useEditorData(schoolId, gradeId, classId);

  // クラス名編集
  const [classNameModalOpen, setClassNameModalOpen] = useState(false);
  const [editClassNameValue, setEditClassNameValue] = useState("");

  // セレクタ用
  const [schools, setSchools] = useState<School[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

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

  // セレクタデータ読み込み
  useEffect(() => {
    async function load() {
      if (!schoolId) return;
      try {
        const [schoolRes, gradeRes] = await Promise.all([
          listSchoolsFn(),
          listGradesFn({ schoolId }),
        ]);
        setSchools(schoolRes.data.schools || []);
        setGrades(gradeRes.data.grades || []);
        if (gradeId) {
          const classRes = await listClassesFn({ schoolId, gradeId });
          setClasses(classRes.data.classes || []);
        }
      } catch {
        /* ignore */
      }
    }
    load();
  }, [schoolId, gradeId]);

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

  const handleGradeChange = async (newGradeId: string) => {
    if (!newGradeId || !schoolId) return;
    try {
      const res = await listClassesFn({ schoolId, gradeId: newGradeId });
      const cls = res.data.classes || [];
      setClasses(cls);
      if (cls.length > 0) {
        setContext(schoolId, newGradeId, cls[0].id);
      } else {
        setContext(schoolId, newGradeId, null);
      }
    } catch {
      setContext(schoolId, newGradeId, null);
    }
  };

  const handleClassChange = (newClassId: string) => {
    if (schoolId && gradeId) {
      setContext(schoolId, gradeId, newClassId);
    }
  };

  const handleSaveClassName = async () => {
    if (!editClassNameValue.trim()) return;
    try {
      await saveClassName(editClassNameValue);
      showToast("クラス名を変更しました", "success");
      setClassNameModalOpen(false);
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
  };

  if (!hasFullContext) {
    return <ContextSelector onSelected={handleContextSelected} />;
  }

  if (loading) {
    return <Loading message="データを読み込み中..." />;
  }

  const currentSchool = schools.find((s) => s.id === schoolId);
  const schoolName = currentSchool
    ? escapeHtml(currentSchool.name)
    : schoolId || "";

  return (
    <>
      <Header title={data.className || "エディター"}>
        <button
          className="btn btn-sm btn-secondary"
          onClick={() => {
            setEditClassNameValue(data.className || "");
            setClassNameModalOpen(true);
          }}
          style={{ marginLeft: 8, fontSize: "0.8rem" }}
          title="クラス名を編集"
        >
          編集
        </button>
      </Header>
      <div className={styles.editorLayout}>
      <div className={styles.pageContainer}>
      {/* 時計 */}
      <div className={styles.header}>
        <span className={styles.clock}>{currentTime}</span>
      </div>

      {/* セレクタ */}
      <div className={styles.selectorRow}>
        <span className={styles.selectorLabel}>{schoolName}</span>
        <span className={styles.selectorDivider}>/</span>
        <select
          value={gradeId || ""}
          onChange={(e) => handleGradeChange(e.target.value)}
          disabled={editingLevel === "school"}
        >
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
          disabled={editingLevel !== "class"}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* 編集レベル（管理者のみ） */}
      {isAdmin && (
        <div className={styles.levelSelector}>
          {(
            [
              { key: "class", label: "クラス", color: "#6c757d" },
              { key: "grade", label: "学年マスター", color: "#28a745" },
              { key: "school", label: "学校マスター", color: "#007bff" },
            ] as const
          ).map((l) => (
            <button
              key={l.key}
              className={styles.levelBtn}
              style={{
                borderColor: l.color,
                background:
                  editingLevel === l.key ? l.color : "#fff",
                color: editingLevel === l.key ? "#fff" : l.color,
              }}
              onClick={() => setEditingLevel(l.key as EditingLevel)}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}

      {editingLevel !== "class" && (
        <div
          className={styles.levelIndicator}
          style={{
            background:
              editingLevel === "school" ? "#007bff" : "#28a745",
          }}
        >
          <span>
            {editingLevel === "school"
              ? "学校マスター編集モード — 全クラスに自動反映されます"
              : "学年マスター編集モード — 学年内全クラスに自動反映されます"}
          </span>
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

      {/* クラス名編集モーダル */}
      <Modal
        isOpen={classNameModalOpen}
        onClose={() => setClassNameModalOpen(false)}
        title="クラス名を編集"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setClassNameModalOpen(false)}
            >
              キャンセル
            </button>
            <button className="btn btn-primary" onClick={handleSaveClassName}>
              保存
            </button>
          </>
        }
      >
        <div className="form-group">
          <label>クラス名</label>
          <input
            type="text"
            value={editClassNameValue}
            onChange={(e) => setEditClassNameValue(e.target.value)}
            placeholder="例: A組"
          />
        </div>
      </Modal>

      <footer className={styles.branding}>キミテラス by Rebounder（管理者モード）</footer>
    </div>

      {/* 広告プレビューパネル */}
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
    </div>
    </>
  );
}

export default function EditorPage() {
  return (
    <AuthGuard requiredRole="editor" loginMode="editor">
      <EditorContent />
    </AuthGuard>
  );
}
