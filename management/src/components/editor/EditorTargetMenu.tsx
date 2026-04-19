"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSchoolDetailFn } from "@/lib/firebase-functions";
import { Loading } from "@/components/ui/Loading";
import { EditorModeToggle } from "@/components/editor/EditorModeToggle";
import { useAuthContext } from "@/providers/AuthProvider";
import type {
  Grade,
  Class,
  Department,
  HierarchyMode,
} from "@/types/school";

interface EditorTargetMenuProps {
  schoolId: string;
  /** 遷移先のベースパス（例: "/manage/editor"） */
  basePath: string;
  /** モバイルはマスター編集不可（クラスのみ表示） */
  mobileMode?: boolean;
}

export function EditorTargetMenu({
  schoolId,
  basePath,
  mobileMode = false,
}: EditorTargetMenuProps) {
  const router = useRouter();
  const { isAdmin, isSchoolAdmin } = useAuthContext();
  const canEditMaster = !mobileMode && (isAdmin || isSchoolAdmin);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [mode, setMode] = useState<HierarchyMode>("class");
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classesMap, setClassesMap] = useState<Record<string, Class[]>>({});
  const [departments, setDepartments] = useState<Department[]>([]);
  const [gradesByDept, setGradesByDept] = useState<Record<string, Grade[]>>({});
  const [classesByDeptGrade, setClassesByDeptGrade] = useState<
    Record<string, Record<string, Class[]>>
  >({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getSchoolDetailFn({ schoolId });
        if (cancelled) return;
        const d = res.data;
        setSchoolName(d.schoolName || schoolId);
        setMode(d.hierarchyMode);
        setGrades(d.grades || []);
        setClassesMap(d.classesMap || {});
        setDepartments(d.departments || []);
        setGradesByDept(d.gradesByDept || {});
        setClassesByDeptGrade(d.classesByDeptGrade || {});
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  if (loading) return <Loading message="学校情報を読み込み中..." />;
  if (error)
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <h3>読み込みエラー</h3>
        <p>{error}</p>
        <a href={basePath}>← 学校選択に戻る</a>
      </div>
    );

  const nav = (params: Record<string, string>) => {
    const qs = new URLSearchParams({ school: schoolId, ...params }).toString();
    router.push(`${basePath}?${qs}`);
  };

  // 全ボタン同一スタイル。意味はラベル文字列で区別（色に依存しない）。
  // variant は視覚的な「強さ」のみを表し、レベルの種類とは独立している。
  const btnStyle = (variant: "primary" | "secondary" = "secondary"): React.CSSProperties => ({
    padding: "14px 18px",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-line-strong)",
    background:
      variant === "primary" ? "var(--color-text)" : "var(--color-canvas)",
    color:
      variant === "primary" ? "var(--color-canvas)" : "var(--color-text)",
    fontSize: "var(--fs-md)",
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
    minWidth: 180,
    fontFamily: "inherit",
    transition: "background 0.15s ease, border-color 0.15s ease",
  });

  const sectionStyle: React.CSSProperties = {
    marginBottom: 28,
  };
  const gridStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
  };

  const isDept = mode === "department";
  const allClasses = isDept
    ? departments.flatMap((d) =>
        (gradesByDept[d.id] || []).flatMap((g) => {
          const gradeClasses = classesByDeptGrade[d.id]?.[g.id] || [];
          // hasClasses=false の学年は先頭クラスのみ（学年が単位）
          const list =
            g.hasClasses === false ? gradeClasses.slice(0, 1) : gradeClasses;
          return list.map((c) => ({
            deptId: d.id,
            deptName: d.name,
            gradeId: g.id,
            gradeName: g.name,
            gradeHasClasses: g.hasClasses !== false,
            cls: c,
          }));
        })
      )
    : grades.flatMap((g) => {
        const gradeClasses = classesMap[g.id] || [];
        const list =
          g.hasClasses === false ? gradeClasses.slice(0, 1) : gradeClasses;
        return list.map((c) => ({
          deptId: null as string | null,
          deptName: "",
          gradeId: g.id,
          gradeName: g.name,
          gradeHasClasses: g.hasClasses !== false,
          cls: c,
        }));
      });

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <a
            href={basePath}
            style={{
              color: "var(--color-text-muted)",
              textDecoration: "none",
              fontSize: "var(--fs-sm)",
              fontWeight: 500,
            }}
          >
            ← 学校を選び直す
          </a>
          <EditorModeToggle
            currentBasePath={
              basePath === "/manage/editor-mobile"
                ? "/manage/editor-mobile"
                : "/manage/editor"
            }
          />
        </div>
        <h2 style={{ margin: "8px 0 0", fontSize: "var(--fs-xl)", fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.01em" }}>
          {schoolName}
        </h2>
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--fs-sm)" }}>
          どこに送りますか？
        </p>
      </div>

      {canEditMaster && (
        <div style={sectionStyle}>
          <h3 style={{ marginBottom: 6, fontSize: "var(--fs-md)", fontWeight: 600, color: "var(--color-text)" }}>
            学校全体にまとめて
          </h3>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--fs-sm)", marginBottom: 10 }}>
            この学校の全クラスに反映されます
          </p>
          <button
            style={btnStyle("primary")}
            onClick={() => nav({ level: "school" })}
          >
            学校全体にまとめて送る
          </button>
        </div>
      )}

      {canEditMaster && isDept && departments.length > 0 && (
        <div style={sectionStyle}>
          <h3 style={{ marginBottom: 6, fontSize: "var(--fs-md)", fontWeight: 600, color: "var(--color-text)" }}>
            学科にまとめて
          </h3>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--fs-sm)", marginBottom: 10 }}>
            同じ学科の全クラスに反映されます
          </p>
          <div style={gridStyle}>
            {departments.map((d) => (
              <button
                key={d.id}
                style={btnStyle("secondary")}
                onClick={() =>
                  nav({ level: "department", department: d.id })
                }
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {canEditMaster && (
        <div style={sectionStyle}>
          <h3 style={{ marginBottom: 6, fontSize: "var(--fs-md)", fontWeight: 600, color: "var(--color-text)" }}>
            学年にまとめて
          </h3>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--fs-sm)", marginBottom: 10 }}>
            この学年の全クラスに反映されます
          </p>
          <div style={gridStyle}>
            {isDept
              ? (() => {
                  const byName = new Map<
                    string,
                    { deptId: string; gradeId: string }[]
                  >();
                  departments.forEach((d) => {
                    (gradesByDept[d.id] || []).forEach((g) => {
                      if (!byName.has(g.name)) byName.set(g.name, []);
                      byName.get(g.name)!.push({
                        deptId: d.id,
                        gradeId: g.id,
                      });
                    });
                  });
                  const names = [...byName.keys()].sort((a, b) =>
                    a.localeCompare(b, "ja")
                  );
                  return names.map((name) => {
                    const pairs = byName.get(name)!;
                    const primary = pairs[0];
                    return (
                      <button
                        key={`grade-name:${name}`}
                        style={btnStyle("secondary")}
                        onClick={() =>
                          nav({
                            level: "grade",
                            department: primary.deptId,
                            grade: primary.gradeId,
                          })
                        }
                        title={
                          pairs.length > 1
                            ? `全学科の「${name}」(${pairs.length}学年) に反映されます`
                            : ""
                        }
                      >
                        {name}
                        {pairs.length > 1 && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: "var(--fs-xs)",
                              color: "var(--color-text-muted)",
                            }}
                          >
                            ({pairs.length}学科共通)
                          </span>
                        )}
                      </button>
                    );
                  });
                })()
              : grades.map((g) => (
                  <button
                    key={g.id}
                    style={btnStyle("secondary")}
                    onClick={() => nav({ level: "grade", grade: g.id })}
                  >
                    {g.name}
                  </button>
                ))}
          </div>
        </div>
      )}

      <div style={sectionStyle}>
        <h3 style={{ marginBottom: 6, fontSize: "var(--fs-md)", fontWeight: 600, color: "var(--color-text)" }}>
          クラスを選ぶ
        </h3>
        {allClasses.length === 0 ? (
          <p className="empty-text">クラスがまだありません</p>
        ) : (
          <div style={gridStyle}>
            {allClasses.map(
              ({
                deptId,
                deptName,
                gradeId,
                gradeName,
                gradeHasClasses,
                cls,
              }) => {
                const params: Record<string, string> = {
                  grade: gradeId,
                  class: cls.id,
                };
                if (deptId) params.department = deptId;
                const label = gradeHasClasses
                  ? `${deptName ? deptName + " / " : ""}${gradeName} / ${cls.name}`
                  : `${deptName ? deptName + " / " : ""}${gradeName}`;
                return (
                  <button
                    key={`${deptId || ""}:${gradeId}:${cls.id}`}
                    style={btnStyle("secondary")}
                    onClick={() => nav(params)}
                  >
                    {label}
                  </button>
                );
              }
            )}
          </div>
        )}
      </div>
    </div>
  );
}
