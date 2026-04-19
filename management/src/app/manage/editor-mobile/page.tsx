"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ContextSelector } from "@/components/context/ContextSelector";
import { EditorSchoolPicker } from "@/components/editor/EditorSchoolPicker";
import { EditorTargetMenu } from "@/components/editor/EditorTargetMenu";
import { Loading } from "@/components/ui/Loading";
import { useSchoolContextValue } from "@/providers/SchoolContextProvider";
import { useAuthContext } from "@/providers/AuthProvider";
import { useEditorData } from "@/hooks/useEditorData";
import { useToast } from "@/components/ui/Toast";
import { logout } from "@/lib/auth";
import { getTodayString } from "@/lib/utils";
import styles from "@/styles/editor-mobile.module.css";

type TabType = "schedule" | "notice" | "assignment";

const TIME_OPTIONS = [
  { value: "", label: "-- 選択 --" },
  { value: "終日", label: "終日" },
  { value: "朝", label: "朝" },
  { value: "1限", label: "1限" },
  { value: "2限", label: "2限" },
  { value: "3限", label: "3限" },
  { value: "4限", label: "4限" },
  { value: "5限", label: "5限" },
  { value: "6限", label: "6限" },
  { value: "放課後", label: "放課後" },
  { value: "その他", label: "その他" },
];

const SUBJECT_OPTIONS = [
  { value: "", label: "-- 選択 --" },
  { value: "実習", label: "実習" },
  { value: "数学", label: "数学" },
  { value: "英語", label: "英語" },
  { value: "HR", label: "HR" },
  { value: "その他", label: "その他" },
];

function EditorMobileContent() {
  const { schoolId, gradeId, classId, hasFullContext, setContext } =
    useSchoolContextValue();
  const { user, roleLabel } = useAuthContext();
  const { showToast } = useToast();
  const { data, loading, saveItem } = useEditorData(schoolId, gradeId, classId);

  // タブ
  const [activeTab, setActiveTab] = useState<TabType>("schedule");

  // 共通: 対象日付
  const [targetDate, setTargetDate] = useState(getTodayString());

  // 予定フォーム
  const [schedTimeSelect, setSchedTimeSelect] = useState("");
  const [schedTimeCustom, setSchedTimeCustom] = useState("");
  const [schedContent, setSchedContent] = useState("");
  const [schedLocation, setSchedLocation] = useState("");
  const [schedDisplayStart, setSchedDisplayStart] = useState("");
  const [schedDisplayEnd, setSchedDisplayEnd] = useState("");
  const [schedOptionalOpen, setSchedOptionalOpen] = useState(false);

  // 連絡フォーム
  const [noticeText, setNoticeText] = useState("");
  const [noticeHighlight, setNoticeHighlight] = useState(false);
  const [noticeSound, setNoticeSound] = useState(false);
  const [noticeDisplayStart, setNoticeDisplayStart] = useState("");
  const [noticeDisplayEnd, setNoticeDisplayEnd] = useState("");
  const [noticeOptionalOpen, setNoticeOptionalOpen] = useState(false);

  // 提出物フォーム
  const [assignDeadline, setAssignDeadline] = useState(getTodayString());
  const [assignSubject, setAssignSubject] = useState("");
  const [assignTask, setAssignTask] = useState("");

  // 送信状態
  const [submitting, setSubmitting] = useState(false);

  const handleContextSelected = useCallback(
    (s: string, g: string, c: string) => setContext(s, g, c),
    [setContext]
  );

  const clearScheduleForm = () => {
    setSchedTimeSelect("");
    setSchedTimeCustom("");
    setSchedContent("");
    setSchedLocation("");
    setSchedDisplayStart("");
    setSchedDisplayEnd("");
    setSchedOptionalOpen(false);
  };

  const clearNoticeForm = () => {
    setNoticeText("");
    setNoticeHighlight(false);
    setNoticeSound(false);
    setNoticeDisplayStart("");
    setNoticeDisplayEnd("");
    setNoticeOptionalOpen(false);
  };

  const clearAssignmentForm = () => {
    setAssignDeadline(getTodayString());
    setAssignSubject("");
    setAssignTask("");
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (activeTab === "schedule") {
        const time =
          schedTimeSelect === "その他" ? schedTimeCustom : schedTimeSelect;
        if (!time || !schedContent) {
          showToast("時限と内容は必須です", "error");
          return;
        }
        const item: Record<string, unknown> = {
          time,
          content: schedContent,
        };
        if (schedLocation) item.location = schedLocation;
        if (schedDisplayStart) item.display_start = schedDisplayStart;
        if (schedDisplayEnd) item.display_end = schedDisplayEnd;
        await saveItem("schedule", targetDate, null, item);
        clearScheduleForm();
      } else if (activeTab === "notice") {
        if (!noticeText) {
          showToast("連絡内容は必須です", "error");
          return;
        }
        const item: Record<string, unknown> = {
          text: noticeText,
          is_highlight: noticeHighlight,
          play_sound: noticeSound,
          display_start: noticeDisplayStart || targetDate,
          display_end: noticeDisplayEnd || targetDate,
        };
        await saveItem("notice", targetDate, null, item);
        clearNoticeForm();
      } else {
        if (!assignDeadline || !assignSubject || !assignTask) {
          showToast("締切・教科・課題名は必須です", "error");
          return;
        }
        const item: Record<string, unknown> = {
          deadline: assignDeadline,
          subject: assignSubject,
          task: assignTask,
        };
        await saveItem("assignment", assignDeadline, null, item);
        clearAssignmentForm();
      }
      showToast("登録しました", "success");
    } catch (err) {
      showToast("登録エラー: " + (err as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasFullContext) {
    return <ContextSelector onSelected={handleContextSelected} />;
  }

  if (loading) {
    return <Loading message="データを読み込み中..." />;
  }

  return (
    <div className={styles.pageContainer}>
      {/* ヘッダー */}
      <div className={styles.appHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.contextLabel}>
            {data.className || "連絡登録"}
          </span>
          {roleLabel && <span className={styles.roleBadge}>{roleLabel}</span>}
        </div>
        <div className={styles.headerRight}>
          <button className={styles.logoutBtn} onClick={() => logout()}>
            ログアウト
          </button>
        </div>
      </div>

      {/* タブバー */}
      <div className={styles.tabs}>
        {(
          [
            { key: "schedule", label: "予定" },
            { key: "notice", label: "連絡" },
            { key: "assignment", label: "提出物" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 対象日付カード（提出物タブ以外） */}
      <div
        className={`${styles.card} ${activeTab === "assignment" ? styles.cardDisabled : ""}`}
      >
        <div className={styles.cardTitle}>対象日付</div>
        <input
          type="date"
          className={styles.formInput}
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          style={{ marginBottom: 0 }}
        />
      </div>

      {/* 予定フォーム */}
      {activeTab === "schedule" && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>予定を登録</div>

          <label className={styles.formLabel}>時限</label>
          <select
            className={styles.formSelect}
            value={schedTimeSelect}
            onChange={(e) => setSchedTimeSelect(e.target.value)}
          >
            {TIME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {schedTimeSelect === "その他" && (
            <>
              <label className={styles.formLabel}>時間（自由入力）</label>
              <input
                type="text"
                className={styles.formInput}
                placeholder="例: 13:00"
                value={schedTimeCustom}
                onChange={(e) => setSchedTimeCustom(e.target.value)}
              />
            </>
          )}

          <label className={styles.formLabel}>内容</label>
          <input
            type="text"
            className={styles.formInput}
            placeholder="例: 避難訓練"
            value={schedContent}
            onChange={(e) => setSchedContent(e.target.value)}
          />

          <label className={styles.formLabel}>場所（任意）</label>
          <input
            type="text"
            className={styles.formInput}
            placeholder="例: グラウンド"
            value={schedLocation}
            onChange={(e) => setSchedLocation(e.target.value)}
          />

          {/* 表示期間（折りたたみ） */}
          <div className={styles.optionalSection}>
            <div
              className={styles.optionalHeader}
              onClick={() => setSchedOptionalOpen(!schedOptionalOpen)}
            >
              <span
                className={`${styles.optionalIndicator} ${schedOptionalOpen ? styles.optionalIndicatorOpen : ""}`}
              >
                ▶
              </span>
              表示期間を設定（任意）
            </div>
            <div
              className={`${styles.optionalFields} ${schedOptionalOpen ? styles.optionalFieldsOpen : ""}`}
            >
              <label className={styles.formLabel}>表示開始日</label>
              <input
                type="date"
                className={styles.formInput}
                value={schedDisplayStart}
                onChange={(e) => setSchedDisplayStart(e.target.value)}
              />
              <label className={styles.formLabel}>表示終了日</label>
              <input
                type="date"
                className={styles.formInput}
                value={schedDisplayEnd}
                onChange={(e) => setSchedDisplayEnd(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* 連絡フォーム */}
      {activeTab === "notice" && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>連絡を登録</div>

          <label className={styles.formLabel}>連絡内容</label>
          <textarea
            className={styles.formTextarea}
            rows={3}
            placeholder="例: 体操服を忘れないように"
            value={noticeText}
            onChange={(e) => setNoticeText(e.target.value)}
          />

          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="notice-highlight"
              checked={noticeHighlight}
              onChange={(e) => setNoticeHighlight(e.target.checked)}
            />
            <label htmlFor="notice-highlight">重要（赤文字で表示）</label>
          </div>

          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="notice-sound"
              checked={noticeSound}
              onChange={(e) => setNoticeSound(e.target.checked)}
            />
            <label htmlFor="notice-sound">通知音を鳴らす</label>
          </div>

          {/* 表示期間（折りたたみ） */}
          <div className={styles.optionalSection}>
            <div
              className={styles.optionalHeader}
              onClick={() => setNoticeOptionalOpen(!noticeOptionalOpen)}
            >
              <span
                className={`${styles.optionalIndicator} ${noticeOptionalOpen ? styles.optionalIndicatorOpen : ""}`}
              >
                ▶
              </span>
              表示期間を設定（任意）
            </div>
            <div
              className={`${styles.optionalFields} ${noticeOptionalOpen ? styles.optionalFieldsOpen : ""}`}
            >
              <label className={styles.formLabel}>表示開始日</label>
              <input
                type="date"
                className={styles.formInput}
                value={noticeDisplayStart}
                onChange={(e) => setNoticeDisplayStart(e.target.value)}
              />
              <label className={styles.formLabel}>表示終了日</label>
              <input
                type="date"
                className={styles.formInput}
                value={noticeDisplayEnd}
                onChange={(e) => setNoticeDisplayEnd(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* 提出物フォーム */}
      {activeTab === "assignment" && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>提出物を登録</div>

          <label className={styles.formLabel}>締切日</label>
          <input
            type="date"
            className={styles.formInput}
            value={assignDeadline}
            onChange={(e) => setAssignDeadline(e.target.value)}
          />

          <label className={styles.formLabel}>教科</label>
          <select
            className={styles.formSelect}
            value={assignSubject}
            onChange={(e) => setAssignSubject(e.target.value)}
          >
            {SUBJECT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <label className={styles.formLabel}>課題名</label>
          <input
            type="text"
            className={styles.formInput}
            placeholder="例: レポート"
            value={assignTask}
            onChange={(e) => setAssignTask(e.target.value)}
          />
        </div>
      )}

      {/* 登録ボタン */}
      <button
        className={styles.submitBtn}
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? "送信中..." : "登録する"}
      </button>

      {/* ローディングオーバーレイ */}
      {submitting && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
          <span className={styles.loadingText}>処理中...</span>
        </div>
      )}
    </div>
  );
}

function EditorMobileRouter() {
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get("school");
  const gradeParam = searchParams.get("grade");
  const classParam = searchParams.get("class");

  if (!schoolParam) {
    return <EditorSchoolPicker basePath="/manage/editor-mobile" />;
  }

  // モバイル版はクラス編集のみ対応
  const hasTarget = !!gradeParam && !!classParam;

  if (!hasTarget) {
    return (
      <AuthGuard requiredRole="editor" loginMode="editor">
        <EditorTargetMenu
          schoolId={schoolParam}
          basePath="/manage/editor-mobile"
          mobileMode
        />
      </AuthGuard>
    );
  }

  return (
    <AuthGuard requiredRole="editor" loginMode="editor">
      <EditorMobileContent />
    </AuthGuard>
  );
}

export default function EditorMobilePage() {
  return <EditorMobileRouter />;
}
