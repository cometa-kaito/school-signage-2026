"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSchoolDetailFn } from "@/lib/firebase-functions";
import { Loading } from "@/components/ui/Loading";
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

  const btnStyle = (color: string): React.CSSProperties => ({
    padding: "16px 20px",
    borderRadius: 10,
    border: `2px solid ${color}`,
    background: "#fff",
    color,
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
    minWidth: 180,
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
        (gradesByDept[d.id] || []).flatMap((g) =>
          (classesByDeptGrade[d.id]?.[g.id] || []).map((c) => ({
            deptId: d.id,
            deptName: d.name,
            gradeId: g.id,
            gradeName: g.name,
            cls: c,
          }))
        )
      )
    : grades.flatMap((g) =>
        (classesMap[g.id] || []).map((c) => ({
          deptId: null as string | null,
          deptName: "",
          gradeId: g.id,
          gradeName: g.name,
          cls: c,
        }))
      );

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <div style={{ marginBottom: 24 }}>
        <a
          href={basePath}
          style={{ color: "#666", textDecoration: "none", fontSize: "0.9rem" }}
        >
          ← 学校選択に戻る
        </a>
        <h2 style={{ margin: "8px 0 0" }}>{schoolName}</h2>
        <p style={{ color: "#888", fontSize: "0.9rem" }}>
          編集対象を選択してください
        </p>
      </div>

      {canEditMaster && (
        <div style={sectionStyle}>
          <h3 style={{ marginBottom: 8 }}>学校マスター</h3>
          <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: 8 }}>
            全クラスに自動反映されます
          </p>
          <button
            style={btnStyle("#007bff")}
            onClick={() => nav({ level: "school" })}
          >
            学校マスターを編集
          </button>
        </div>
      )}

      {canEditMaster && isDept && departments.length > 0 && (
        <div style={sectionStyle}>
          <h3 style={{ marginBottom: 8 }}>学科マスター</h3>
          <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: 8 }}>
            同学科に属する全クラスに反映されます
          </p>
          <div style={gridStyle}>
            {departments.map((d) => (
              <button
                key={d.id}
                style={btnStyle("#9b59b6")}
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
          <h3 style={{ marginBottom: 8 }}>学年マスター</h3>
          <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: 8 }}>
            学年内の全クラスに反映されます
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
                        style={btnStyle("#28a745")}
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
                              fontSize: "0.75rem",
                              color: "#666",
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
                    style={btnStyle("#28a745")}
                    onClick={() => nav({ level: "grade", grade: g.id })}
                  >
                    {g.name}
                  </button>
                ))}
          </div>
        </div>
      )}

      <div style={sectionStyle}>
        <h3 style={{ marginBottom: 8 }}>各クラス</h3>
        {allClasses.length === 0 ? (
          <p className="empty-text">クラスがありません</p>
        ) : (
          <div style={gridStyle}>
            {allClasses.map(({ deptId, deptName, gradeId, gradeName, cls }) => {
              const params: Record<string, string> = {
                grade: gradeId,
                class: cls.id,
              };
              if (deptId) params.department = deptId;
              return (
                <button
                  key={`${deptId || ""}:${gradeId}:${cls.id}`}
                  style={btnStyle("#6c757d")}
                  onClick={() => nav(params)}
                >
                  {deptName ? `${deptName} / ` : ""}
                  {gradeName} / {cls.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
