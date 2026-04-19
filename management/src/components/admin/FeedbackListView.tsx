"use client";

import { useEffect, useState, useCallback } from "react";
import {
  listFeedbackFn,
  type FeedbackItem,
} from "@/lib/firebase-functions";
import { Loading } from "@/components/ui/Loading";
import { useToast } from "@/components/ui/Toast";
import styles from "@/styles/admin.module.css";

const STUDENT_REACTION_LABELS: Record<number, string> = {
  1: "全く見ていない",
  2: "あまり見ていない",
  3: "普通",
  4: "時々話題にしている",
  5: "非常に興味を持って見ている",
};

const TEACHER_UTILITY_LABELS: Record<number, string> = {
  1: "負担が増えた",
  2: "やや使いにくい",
  3: "変わらない",
  4: "やや役立っている",
  5: "非常に役立っている",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export function FeedbackListView() {
  const { showToast } = useToast();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listFeedbackFn({ limit: 100 });
      setItems(res.data.items || []);
    } catch (err) {
      showToast(
        "フィードバックの読み込みに失敗: " + (err as Error).message,
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading message="フィードバックを読み込み中…" />;

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h2>教員からのフィードバック</h2>
        <button className="btn btn-sm btn-secondary" onClick={load}>
          更新
        </button>
      </div>
      <p className={styles.sectionLead}>
        /manage/guide のフィードバックフォームから送信された内容の一覧です。
        新しい送信があると 20051215kaito@gmail.com にも通知メールが届きます。
      </p>

      {items.length === 0 ? (
        <p className="empty-text">まだフィードバックはありません</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((it) => (
            <article
              key={it.id}
              style={{
                background: "var(--color-canvas)",
                border: "var(--border-1)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-4) var(--space-5)",
              }}
            >
              <header
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 10,
                  paddingBottom: 10,
                  borderBottom: "var(--border-1)",
                }}
              >
                <div>
                  <strong
                    style={{
                      fontSize: "var(--fs-md)",
                      color: "var(--color-text)",
                    }}
                  >
                    {it.classroomLabel || "(教室未指定)"}
                  </strong>
                  <div
                    style={{
                      fontSize: "var(--fs-xs)",
                      color: "var(--color-text-muted)",
                      marginTop: 2,
                    }}
                  >
                    学校: {it.schoolId || "-"} ・ 送信者:{" "}
                    {it.submitterEmail || it.submitterUid || "不明"}
                  </div>
                </div>
                <time
                  style={{
                    fontSize: "var(--fs-xs)",
                    color: "var(--color-text-muted)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatDateTime(it.createdAt)}
                </time>
              </header>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "var(--fs-xs)",
                      color: "var(--color-text-muted)",
                      marginBottom: 2,
                    }}
                  >
                    生徒の反応
                  </div>
                  <strong
                    style={{
                      fontSize: "var(--fs-md)",
                      color: "var(--color-text)",
                    }}
                  >
                    {it.studentReaction} / 5
                  </strong>{" "}
                  <span
                    style={{
                      fontSize: "var(--fs-xs)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {STUDENT_REACTION_LABELS[it.studentReaction] || ""}
                  </span>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "var(--fs-xs)",
                      color: "var(--color-text-muted)",
                      marginBottom: 2,
                    }}
                  >
                    先生の負担・利便性
                  </div>
                  <strong
                    style={{
                      fontSize: "var(--fs-md)",
                      color: "var(--color-text)",
                    }}
                  >
                    {it.teacherUtility} / 5
                  </strong>{" "}
                  <span
                    style={{
                      fontSize: "var(--fs-xs)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {TEACHER_UTILITY_LABELS[it.teacherUtility] || ""}
                  </span>
                </div>
              </div>

              {it.studentEpisode && (
                <div style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      fontSize: "var(--fs-xs)",
                      color: "var(--color-text-muted)",
                      marginBottom: 4,
                    }}
                  >
                    生徒の反応についてのエピソード
                  </div>
                  <div
                    style={{
                      fontSize: "var(--fs-sm)",
                      whiteSpace: "pre-wrap",
                      padding: "10px 12px",
                      background: "var(--color-surface-muted)",
                      borderRadius: "var(--radius-sm)",
                      borderLeft: "3px solid var(--color-accent)",
                    }}
                  >
                    {it.studentEpisode}
                  </div>
                </div>
              )}

              {it.improvement && (
                <div>
                  <div
                    style={{
                      fontSize: "var(--fs-xs)",
                      color: "var(--color-text-muted)",
                      marginBottom: 4,
                    }}
                  >
                    改善の要望・お気付きの点
                  </div>
                  <div
                    style={{
                      fontSize: "var(--fs-sm)",
                      whiteSpace: "pre-wrap",
                      padding: "10px 12px",
                      background: "var(--color-surface-muted)",
                      borderRadius: "var(--radius-sm)",
                      borderLeft: "3px solid var(--color-accent)",
                    }}
                  >
                    {it.improvement}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
