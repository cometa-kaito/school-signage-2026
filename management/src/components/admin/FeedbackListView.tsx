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

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function distribution(nums: number[]): Record<number, number> {
  const d: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  nums.forEach((n) => {
    if (d[n] !== undefined) d[n] += 1;
  });
  return d;
}

interface StatsCardProps {
  title: string;
  values: number[];
  labels: Record<number, string>;
}

function StatsCard({ title, values, labels }: StatsCardProps) {
  const avg = average(values);
  const dist = distribution(values);
  const total = values.length;
  return (
    <div
      style={{
        background: "var(--color-canvas)",
        border: "var(--border-1)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4) var(--space-5)",
      }}
    >
      <div
        style={{
          fontSize: "var(--fs-xs)",
          color: "var(--color-text-muted)",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <strong style={{ fontSize: "1.6rem", color: "var(--color-text)" }}>
          {total > 0 ? avg.toFixed(2) : "-"}
        </strong>
        <span
          style={{ fontSize: "var(--fs-xs)", color: "var(--color-text-muted)" }}
        >
          / 5 ・ 回答 {total} 件
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {[5, 4, 3, 2, 1].map((score) => {
          const count = dist[score] || 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div
              key={score}
              style={{
                display: "grid",
                gridTemplateColumns: "16px 1fr 36px",
                alignItems: "center",
                gap: 8,
                fontSize: "var(--fs-xs)",
              }}
              title={labels[score]}
            >
              <span
                style={{
                  color: "var(--color-text-muted)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {score}
              </span>
              <span
                style={{
                  height: 8,
                  background: "var(--color-surface-muted)",
                  borderRadius: 4,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <span
                  style={{
                    display: "block",
                    height: "100%",
                    width: `${pct}%`,
                    background: "var(--color-accent)",
                  }}
                />
              </span>
              <span
                style={{
                  color: "var(--color-text-muted)",
                  fontVariantNumeric: "tabular-nums",
                  textAlign: "right",
                }}
              >
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FeedbackListView() {
  const { showToast } = useToast();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listVisible, setListVisible] = useState(false);

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
    // 初回マウント/load 関数差替え時のフェッチ。load 内部の setState は
    // 非同期処理の進捗反映に必要で、effect 経由でしか起動できない。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (loading) return <Loading message="フィードバックを読み込み中…" />;

  const studentReactions = items.map((it) => it.studentReaction);
  const teacherUtilities = items.map((it) => it.teacherUtility);
  const episodeCount = items.filter((it) => it.studentEpisode?.trim()).length;
  const improvementCount = items.filter((it) => it.improvement?.trim()).length;

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
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <StatsCard
              title="生徒の反応（平均）"
              values={studentReactions}
              labels={STUDENT_REACTION_LABELS}
            />
            <StatsCard
              title="先生の負担・利便性（平均）"
              values={teacherUtilities}
              labels={TEACHER_UTILITY_LABELS}
            />
            <div
              style={{
                background: "var(--color-canvas)",
                border: "var(--border-1)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-4) var(--space-5)",
              }}
            >
              <div
                style={{
                  fontSize: "var(--fs-xs)",
                  color: "var(--color-text-muted)",
                  marginBottom: 6,
                }}
              >
                回答数
              </div>
              <strong style={{ fontSize: "1.6rem", color: "var(--color-text)" }}>
                {items.length}
              </strong>
              <span
                style={{
                  fontSize: "var(--fs-xs)",
                  color: "var(--color-text-muted)",
                  marginLeft: 6,
                }}
              >
                件
              </span>
              <div
                style={{
                  marginTop: 10,
                  fontSize: "var(--fs-xs)",
                  color: "var(--color-text-muted)",
                  lineHeight: 1.8,
                }}
              >
                自由記述（エピソード）: {episodeCount} 件
                <br />
                自由記述（改善要望）: {improvementCount} 件
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <button
              className="btn btn-secondary"
              onClick={() => setListVisible((v) => !v)}
              aria-expanded={listVisible}
            >
              {listVisible
                ? `▼ フィードバック一覧を隠す（${items.length} 件）`
                : `▶ フィードバック一覧を表示（${items.length} 件）`}
            </button>
          </div>

          {listVisible && (
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
                    学校: {it.schoolName || it.schoolId || "-"}
                    {it.schoolName && it.schoolId ? (
                      <span style={{ color: "var(--color-text-subtle)", marginLeft: 6 }}>
                        ({it.schoolId})
                      </span>
                    ) : null}
                    {" ・ 送信者: "}
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
        </>
      )}
    </div>
  );
}
