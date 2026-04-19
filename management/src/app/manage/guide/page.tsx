"use client";

/**
 * /manage/guide — 認証なしで開ける、使い方 + フィードバックページ
 * 誰でも開けるため、学校・クラス情報はすべてフォーム上で選択してもらう。
 * 書き込みは submitFeedback Cloud Function が行い、直接 Firestore には書かない。
 */

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/ui/Header";
import { useToast } from "@/components/ui/Toast";
import {
  submitFeedbackFn,
  listSchoolsPublicFn,
} from "@/lib/firebase-functions";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import styles from "@/styles/guide.module.css";

type ScaleValue = 1 | 2 | 3 | 4 | 5;

interface SchoolOption {
  id: string;
  name: string;
  hierarchyMode: "class" | "department";
}

const STUDENT_REACTION_LABELS: Record<ScaleValue, string> = {
  1: "全く見ていない",
  2: "あまり見ていない",
  3: "普通",
  4: "時々話題にしている",
  5: "非常に興味を持って見ている",
};

const TEACHER_UTILITY_LABELS: Record<ScaleValue, string> = {
  1: "負担が増えた・使いにくい",
  2: "やや使いにくい",
  3: "変わらない",
  4: "やや役立っている",
  5: "非常に役立っている",
};

const SCALE_SHORT_STUDENT: Record<ScaleValue, string> = {
  1: "全く見ない",
  2: "あまり見ない",
  3: "普通",
  4: "時々話題",
  5: "非常に興味",
};

const SCALE_SHORT_TEACHER: Record<ScaleValue, string> = {
  1: "負担増",
  2: "やや負担",
  3: "変わらず",
  4: "やや役立つ",
  5: "非常に役立つ",
};

/**
 * 指定学校の「教室ラベル」一覧を Firestore から直接取得。
 * grades/classes/departments は firestore.rules で `allow read: if true;` が設定されており
 * 認証なしでも読める。
 */
async function fetchClassroomLabels(
  schoolId: string,
  mode: "class" | "department"
): Promise<string[]> {
  const labels: string[] = [];
  if (mode === "department") {
    const deptSnap = await getDocs(
      collection(db, "schools", schoolId, "departments")
    );
    for (const deptDoc of deptSnap.docs) {
      const deptName = deptDoc.data().name || deptDoc.id;
      const gradeSnap = await getDocs(
        collection(
          db,
          "schools",
          schoolId,
          "departments",
          deptDoc.id,
          "grades"
        )
      );
      for (const gradeDoc of gradeSnap.docs) {
        const gradeName = gradeDoc.data().name || gradeDoc.id;
        const classSnap = await getDocs(
          collection(
            db,
            "schools",
            schoolId,
            "departments",
            deptDoc.id,
            "grades",
            gradeDoc.id,
            "classes"
          )
        );
        classSnap.forEach((classDoc) => {
          const className = classDoc.data().name || classDoc.id;
          labels.push(`${deptName} / ${gradeName} / ${className}`);
        });
      }
    }
  } else {
    const gradeSnap = await getDocs(
      collection(db, "schools", schoolId, "grades")
    );
    for (const gradeDoc of gradeSnap.docs) {
      const gradeName = gradeDoc.data().name || gradeDoc.id;
      const classSnap = await getDocs(
        collection(
          db,
          "schools",
          schoolId,
          "grades",
          gradeDoc.id,
          "classes"
        )
      );
      classSnap.forEach((classDoc) => {
        const className = classDoc.data().name || classDoc.id;
        labels.push(`${gradeName} / ${className}`);
      });
    }
  }
  return labels;
}

export default function GuidePage() {
  const { showToast } = useToast();

  // ===== 学校選択 =====
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listSchoolsPublicFn();
        if (cancelled) return;
        setSchools(res.data.schools || []);
      } catch {
        setSchools([]);
      } finally {
        if (!cancelled) setSchoolsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ===== 教室選択（学校選択に連動） =====
  const [classrooms, setClassrooms] = useState<string[]>([]);
  const [classroomsLoading, setClassroomsLoading] = useState(false);
  const [classroomLabel, setClassroomLabel] = useState("");

  useEffect(() => {
    let cancelled = false;
    setClassroomLabel("");
    if (!selectedSchoolId) {
      setClassrooms([]);
      return;
    }
    const school = schools.find((s) => s.id === selectedSchoolId);
    if (!school) return;
    setClassroomsLoading(true);
    (async () => {
      try {
        const labels = await fetchClassroomLabels(
          selectedSchoolId,
          school.hierarchyMode
        );
        if (!cancelled) setClassrooms(labels);
      } catch {
        if (!cancelled) setClassrooms([]);
      } finally {
        if (!cancelled) setClassroomsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSchoolId, schools]);

  // ===== フォーム state =====
  const [studentReaction, setStudentReaction] = useState<ScaleValue | null>(
    null
  );
  const [studentEpisode, setStudentEpisode] = useState("");
  const [teacherUtility, setTeacherUtility] = useState<ScaleValue | null>(null);
  const [improvement, setImprovement] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const resetForm = useCallback(() => {
    setClassroomLabel("");
    setStudentReaction(null);
    setStudentEpisode("");
    setTeacherUtility(null);
    setImprovement("");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolId) {
      showToast("学校を選んでください", "error");
      return;
    }
    if (!classroomLabel) {
      showToast("教室を選んでください", "error");
      return;
    }
    if (!studentReaction) {
      showToast("生徒の反応を選んでください", "error");
      return;
    }
    if (!teacherUtility) {
      showToast("先生の負担・利便性を選んでください", "error");
      return;
    }

    setSubmitting(true);
    try {
      await submitFeedbackFn({
        schoolId: selectedSchoolId,
        classroomLabel,
        studentReaction,
        studentEpisode: studentEpisode.trim(),
        teacherUtility,
        improvement: improvement.trim(),
      });
      setSubmitted(true);
      resetForm();
      // 画面上部までスクロールして成功メッセージを見せる
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      showToast(
        "送信できませんでした: " + (err as Error).message,
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ===== ナビゲーションリンク =====
  const navLinks = [
    {
      href: "/",
      title: "サイネージ表示",
      desc: "教室ディスプレイで表示される画面（学校 / 学年 / クラスを URL で指定）",
    },
    {
      href: "/manage/editor",
      title: "連絡をつくる（PC）",
      desc: "予定・連絡・提出物を入力してサイネージに送る（ログインが必要）",
    },
    {
      href: "/manage/editor-mobile",
      title: "連絡をつくる（スマホ）",
      desc: "移動中や授業直前の速報配信向けの軽量版（ログインが必要）",
    },
    {
      href: "/manage/admin",
      title: "学校管理",
      desc: "学校・学年・クラス・メンバー・広告の管理（管理者のみ）",
    },
    {
      href: "/manage/school-admin",
      title: "学校管理ハブ",
      desc: "担当校の一覧から各画面へ素早く遷移（学校管理者）",
    },
  ];

  return (
    <>
      <Header title="つかい方とフィードバック" />
      <div className={styles.pageContainer}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>気付いたことを教えてください</h1>
          <p className={styles.pageLead}>
            キミテラスを実際につかってみて気付いたことを、下のフォームから
            お知らせください。先生以外の方（生徒・保護者・見学者など）もお送りいただけます。
            ログインは不要で、所要 1〜2 分です。
          </p>
        </div>

        {/* フィードバックフォーム（最上部） */}
        <section className={styles.section}>
          <div className={styles.feedbackCard}>
            {submitted ? (
              // 送信完了時: フォームを隠して「Thanks」画面に切り替える
              <div className={styles.thanksScreen} role="status" aria-live="polite">
                <div className={styles.thanksBadge}>Thanks</div>
                <h2 className={styles.thanksTitle}>送信が完了しました</h2>
                <p className={styles.thanksMessage}>
                  フィードバックをありがとうございます。<br />
                  いただいた内容は担当者が確認します。
                </p>
                <div className={styles.thanksActions}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setSubmitted(false);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    もう一件、送る
                  </button>
                  <a href="/manage/editor" className="btn btn-primary">
                    連絡づくりに戻る
                  </a>
                </div>
              </div>
            ) : (
              <>
                <p className={styles.feedbackIntro}>
                  全部で 5 つの質問です。学校と教室を先に選んでください。
                </p>

            <form onSubmit={handleSubmit}>
              {/* 0. 学校選択（ログインしていないので最初に選んでもらう） */}
              <div className={styles.field}>
                <label className={styles.fieldLabelMain} htmlFor="school">
                  学校
                </label>
                <span className={styles.fieldHint}>
                  どの学校についてのフィードバックかを選んでください。
                </span>
                <select
                  id="school"
                  className={styles.select}
                  value={selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(e.target.value)}
                  disabled={submitting || schoolsLoading}
                  required
                  style={{ marginTop: 8 }}
                >
                  <option value="">
                    {schoolsLoading
                      ? "読み込み中…"
                      : schools.length === 0
                        ? "学校が見つかりません"
                        : "-- 学校を選ぶ --"}
                  </option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 1. どの教室 */}
              <div className={styles.field}>
                <label className={styles.fieldLabelMain} htmlFor="classroom">
                  1. どの教室ですか？
                </label>
                <span className={styles.fieldHint}>
                  フィードバックの対象となる教室を選んでください。
                </span>
                <select
                  id="classroom"
                  className={styles.select}
                  value={classroomLabel}
                  onChange={(e) => setClassroomLabel(e.target.value)}
                  disabled={
                    submitting || classroomsLoading || !selectedSchoolId
                  }
                  required
                  style={{ marginTop: 8 }}
                >
                  <option value="">
                    {!selectedSchoolId
                      ? "先に学校を選んでください"
                      : classroomsLoading
                        ? "読み込み中…"
                        : classrooms.length === 0
                          ? "教室が見つかりません"
                          : "-- 教室を選ぶ --"}
                  </option>
                  {classrooms.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. 生徒の反応・注目度 */}
              <div className={styles.field}>
                <span className={styles.fieldLabelMain}>
                  2. 生徒の反応・注目度はいかがでしたか？
                </span>
                <span className={styles.fieldHint}>
                  1 = 全く見ていない、5 = 非常に興味を持って見ている
                </span>
                <div
                  className={styles.scale}
                  role="radiogroup"
                  aria-label="生徒の反応・注目度"
                >
                  {([1, 2, 3, 4, 5] as ScaleValue[]).map((n) => {
                    const isActive = studentReaction === n;
                    return (
                      <label
                        key={n}
                        className={`${styles.scaleOption} ${isActive ? styles.scaleOptionActive : ""}`}
                      >
                        <input
                          type="radio"
                          name="studentReaction"
                          value={n}
                          checked={isActive}
                          onChange={() => setStudentReaction(n)}
                          disabled={submitting}
                          className={styles.scaleInput}
                        />
                        <span className={styles.scaleNumber}>{n}</span>
                        <span className={styles.scaleLabel}>
                          {SCALE_SHORT_STUDENT[n]}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {studentReaction && (
                  <span className={styles.fieldHint} style={{ marginTop: 8 }}>
                    選択中: {STUDENT_REACTION_LABELS[studentReaction]}
                  </span>
                )}
              </div>

              {/* 3. 生徒の反応についての具体的なエピソード */}
              <div className={styles.field}>
                <label
                  className={styles.fieldLabelMain}
                  htmlFor="studentEpisode"
                >
                  3. 生徒の反応について、具体的なエピソードがあれば教えてください
                </label>
                <span className={styles.fieldHint}>
                  例: 特定の企業の求人情報に反応していた、連絡事項の確認が早くなった、など（任意）
                </span>
                <textarea
                  id="studentEpisode"
                  className={styles.textarea}
                  value={studentEpisode}
                  onChange={(e) => setStudentEpisode(e.target.value)}
                  disabled={submitting}
                  maxLength={2000}
                  placeholder="自由にご記入ください"
                  style={{ marginTop: 8 }}
                />
              </div>

              {/* 4. 先生の業務負担・利便性 */}
              <div className={styles.field}>
                <span className={styles.fieldLabelMain}>
                  4. 先生の業務負担や利便性はいかがですか？
                </span>
                <span className={styles.fieldHint}>
                  1 = 負担が増えた、5 = 非常に役立っている（手間が減った）
                </span>
                <div
                  className={styles.scale}
                  role="radiogroup"
                  aria-label="先生の業務負担・利便性"
                >
                  {([1, 2, 3, 4, 5] as ScaleValue[]).map((n) => {
                    const isActive = teacherUtility === n;
                    return (
                      <label
                        key={n}
                        className={`${styles.scaleOption} ${isActive ? styles.scaleOptionActive : ""}`}
                      >
                        <input
                          type="radio"
                          name="teacherUtility"
                          value={n}
                          checked={isActive}
                          onChange={() => setTeacherUtility(n)}
                          disabled={submitting}
                          className={styles.scaleInput}
                        />
                        <span className={styles.scaleNumber}>{n}</span>
                        <span className={styles.scaleLabel}>
                          {SCALE_SHORT_TEACHER[n]}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {teacherUtility && (
                  <span className={styles.fieldHint} style={{ marginTop: 8 }}>
                    選択中: {TEACHER_UTILITY_LABELS[teacherUtility]}
                  </span>
                )}
              </div>

              {/* 5. 改善の要望 */}
              <div className={styles.field}>
                <label
                  className={styles.fieldLabelMain}
                  htmlFor="improvement"
                >
                  5. 改善の要望や、システム・コンテンツに関するお気付きの点
                </label>
                <span className={styles.fieldHint}>
                  例: 〇〇の機能が欲しい、画面が明るすぎる/暗すぎる、更新の手間を減らしたい、など（任意）
                </span>
                <textarea
                  id="improvement"
                  className={styles.textarea}
                  value={improvement}
                  onChange={(e) => setImprovement(e.target.value)}
                  disabled={submitting}
                  maxLength={2000}
                  placeholder="自由にご記入ください"
                  style={{ marginTop: 8 }}
                />
              </div>

              <div className={styles.submitRow}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "送っています…" : "フィードバックを送る"}
                </button>
              </div>
            </form>
              </>
            )}
          </div>
        </section>

        {/* 画面リンク（フォームの下に配置） */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>画面への入口</h2>
          <div className={styles.linkGrid}>
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className={styles.linkCard}>
                <span className={styles.linkCardTitle}>{l.title}</span>
                <span className={styles.linkCardDesc}>{l.desc}</span>
              </a>
            ))}
          </div>
        </section>

        {/* 使い方ステップ（最下部） */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>連絡を送るまでの流れ</h2>
          <ol className={styles.steps}>
            <li className={styles.stepItem}>
              <span className={styles.stepNumber}>1</span>
              <div className={styles.stepBody}>
                <p className={styles.stepTitle}>クラスを選ぶ</p>
                <p className={styles.stepDesc}>
                  「連絡をつくる」を開き、学校・学年・クラスを選びます。
                  次回以降は前回のクラスが自動で開きます。
                </p>
              </div>
            </li>
            <li className={styles.stepItem}>
              <span className={styles.stepNumber}>2</span>
              <div className={styles.stepBody}>
                <p className={styles.stepTitle}>内容を入れる</p>
                <p className={styles.stepDesc}>
                  予定・連絡・提出物のいずれかを選び、内容を入れます。
                  連絡は「重要にする」で赤く目立たせることができます。
                </p>
              </div>
            </li>
            <li className={styles.stepItem}>
              <span className={styles.stepNumber}>3</span>
              <div className={styles.stepBody}>
                <p className={styles.stepTitle}>送る</p>
                <p className={styles.stepDesc}>
                  「○○組に送る」を押すと、数秒で教室のサイネージに反映されます。
                  送った後でも「書き直す」「消す」で修正・撤回できます。
                </p>
              </div>
            </li>
          </ol>
        </section>
      </div>
    </>
  );
}
