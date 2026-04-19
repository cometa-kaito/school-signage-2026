"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  listSchoolsFn,
  getSchoolDetailFn,
} from "@/lib/firebase-functions";
import { useAuthContext } from "@/providers/AuthProvider";
import { Loading } from "@/components/ui/Loading";
import { useToast } from "@/components/ui/Toast";
import type {
  School,
  Grade,
  Department,
  Class,
  HierarchyMode,
} from "@/types/school";
import styles from "@/styles/admin.module.css";

function buildEditorHref(
  schoolId: string,
  level: "school" | "grade" | "department" | "class",
  opts?: { gradeId?: string; classId?: string; departmentId?: string }
): string {
  const params = new URLSearchParams();
  params.set("school", schoolId);
  if (opts?.gradeId) params.set("grade", opts.gradeId);
  if (opts?.classId) params.set("class", opts.classId);
  if (opts?.departmentId) params.set("department", opts.departmentId);
  params.set("level", level);
  return `/manage/editor?${params.toString()}`;
}

function SchoolPicker({ schools }: { schools: School[] }) {
  return (
    <div>
      <p className={styles.sectionLead}>
        管理する学校を選択してください。
      </p>
      <div className={styles.cardList}>
        {schools.map((s) => (
          <a
            key={s.id}
            href={`/manage/school-admin?school=${s.id}`}
            className={styles.card}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div className={styles.cardBody}>
              <h3>
                {s.name}
                <span
                  className="badge"
                  style={{
                    marginLeft: 8,
                    fontSize: "0.7rem",
                    background:
                      (s.hierarchyMode || "class") === "department"
                        ? "#f0e8ff"
                        : "#e3f2fd",
                    color:
                      (s.hierarchyMode || "class") === "department"
                        ? "#5a2ea6"
                        : "#1565c0",
                  }}
                >
                  {(s.hierarchyMode || "class") === "department"
                    ? "学科モード"
                    : "クラスモード"}
                </span>
              </h3>
              <p className={styles.cardSubtext}>ID: {s.id}</p>
            </div>
            <div className={styles.cardActions}>
              <span className="btn btn-sm btn-primary">選択</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

interface SchoolHubViewData {
  school: School;
  hierarchyMode: HierarchyMode;
  grades: Grade[];
  classesMap: Record<string, Class[]>;
  departments: Department[];
  gradesByDept: Record<string, Grade[]>;
  classesByDeptGrade: Record<string, Record<string, Class[]>>;
}

function SchoolHubView({
  school,
  hierarchyMode,
  grades,
  classesMap,
  departments,
  gradesByDept,
  classesByDeptGrade,
}: SchoolHubViewData) {
  const isDeptMode = hierarchyMode === "department";
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(
    new Set(grades.map((g) => g.id))
  );
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(
    new Set(departments.map((d) => d.id))
  );

  const toggleGrade = (id: string) => {
    setExpandedGrades((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleDept = (key: string) => {
    setExpandedDepts((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <a href="/manage/school-admin" className={styles.backLink}>
          &lt; 学校一覧に戻る
        </a>
      </div>

      <div className={styles.hubSchoolCard}>
        <div className={styles.hubSchoolHeader} style={{ cursor: "default" }}>
          <h3 className={styles.hubSchoolName}>
            {school.name}
            <span
              className="badge"
              style={{
                marginLeft: 8,
                fontSize: "0.7rem",
                background: isDeptMode ? "#f0e8ff" : "#e3f2fd",
                color: isDeptMode ? "#5a2ea6" : "#1565c0",
              }}
            >
              {isDeptMode ? "学科モード" : "クラスモード"}
            </span>
          </h3>
          <a
            href={buildEditorHref(school.id, "school")}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-primary"
            style={{ marginLeft: "auto", textDecoration: "none" }}
          >
            学校マスターを編集
          </a>
        </div>
      </div>

      {/* クラスモード: 学年 > クラス */}
      {!isDeptMode && (
        <div className={styles.hubSchoolCard}>
          <div className={styles.hubSchoolHeader} style={{ cursor: "default" }}>
            <h3 className={styles.hubSchoolName}>学年一覧</h3>
            <span
              style={{ marginLeft: "auto", fontSize: "0.85rem", color: "#555" }}
            >
              {grades.length}学年
            </span>
          </div>
          <div className={styles.hubGradesContainer}>
            {grades.length === 0 ? (
              <p className="empty-text">学年がありません</p>
            ) : (
              grades.map((grade) => {
                const gExpanded = expandedGrades.has(grade.id);
                const classes = classesMap[grade.id] || [];
                return (
                  <div key={grade.id} className={styles.hubGradeCard}>
                    <div
                      className={styles.hubGradeHeader}
                      onClick={() => toggleGrade(grade.id)}
                    >
                      <span className={styles.hubToggle}>
                        {gExpanded ? "▼" : "▶"}
                      </span>
                      <strong>{grade.name}</strong>
                      <span className={styles.classBadge}>
                        {classes.length}クラス
                      </span>
                      <a
                        href={buildEditorHref(school.id, "grade", {
                          gradeId: grade.id,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="btn btn-sm btn-primary"
                        style={{
                          marginLeft: "auto",
                          textDecoration: "none",
                        }}
                      >
                        学年マスターを編集
                      </a>
                    </div>
                    {gExpanded && (
                      <div className={styles.hubClassesContainer}>
                        {classes.length === 0 ? (
                          <p className="empty-text">クラスなし</p>
                        ) : (
                          classes.map((cls) => (
                            <div key={cls.id} className={styles.hubClassRow}>
                              <span className={styles.hubClassName}>
                                {cls.name}
                              </span>
                              <a
                                href={buildEditorHref(school.id, "class", {
                                  gradeId: grade.id,
                                  classId: cls.id,
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm btn-secondary"
                                style={{
                                  marginLeft: "auto",
                                  textDecoration: "none",
                                }}
                              >
                                クラスを編集
                              </a>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 学科モード: 学科 > 学年 > クラス */}
      {isDeptMode && (
        <div className={styles.hubSchoolCard}>
          <div className={styles.hubSchoolHeader} style={{ cursor: "default" }}>
            <h3 className={styles.hubSchoolName}>学科一覧</h3>
            <span
              style={{ marginLeft: "auto", fontSize: "0.85rem", color: "#555" }}
            >
              {departments.length}学科
            </span>
          </div>
          <div className={styles.hubGradesContainer}>
            {departments.length === 0 ? (
              <p className="empty-text">
                学科がありません。「学年・クラス」タブから作成してください。
              </p>
            ) : (
              departments.map((dept) => {
                const dExpanded = expandedDepts.has(dept.id);
                const dGrades = gradesByDept[dept.id] || [];
                return (
                  <div key={dept.id} className={styles.hubGradeCard}>
                    <div
                      className={styles.hubGradeHeader}
                      style={{ background: "#faf5ff" }}
                      onClick={() => toggleDept(dept.id)}
                    >
                      <span className={styles.hubToggle}>
                        {dExpanded ? "▼" : "▶"}
                      </span>
                      <span
                        className="badge"
                        style={{
                          background: "#f0e8ff",
                          color: "#5a2ea6",
                          marginRight: 6,
                        }}
                      >
                        学科
                      </span>
                      <strong>{dept.name}</strong>
                      <span className={styles.classBadge}>
                        {dGrades.length}学年
                      </span>
                      <a
                        href={buildEditorHref(school.id, "department", {
                          departmentId: dept.id,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="btn btn-sm btn-primary"
                        style={{
                          marginLeft: "auto",
                          textDecoration: "none",
                          background: "#9b59b6",
                          borderColor: "#9b59b6",
                        }}
                      >
                        学科マスターを編集
                      </a>
                    </div>
                    {dExpanded && (
                      <div className={styles.hubClassesContainer}>
                        {dGrades.length === 0 ? (
                          <p className="empty-text">学年なし</p>
                        ) : (
                          dGrades.map((grade) => {
                            const gKey = `${dept.id}:${grade.id}`;
                            const gExpanded = expandedGrades.has(gKey);
                            const classes =
                              classesByDeptGrade[dept.id]?.[grade.id] || [];
                            return (
                              <div
                                key={grade.id}
                                style={{
                                  border: "1px solid #eee",
                                  borderRadius: 6,
                                  marginBottom: 8,
                                  background: "#f8fbff",
                                }}
                              >
                                <div
                                  className={styles.hubGradeHeader}
                                  onClick={() => toggleGrade(gKey)}
                                  style={{ background: "#f0f8ff" }}
                                >
                                  <span className={styles.hubToggle}>
                                    {gExpanded ? "▼" : "▶"}
                                  </span>
                                  <strong>{grade.name}</strong>
                                  <span className={styles.classBadge}>
                                    {classes.length}クラス
                                  </span>
                                  <a
                                    href={buildEditorHref(school.id, "grade", {
                                      gradeId: grade.id,
                                      departmentId: dept.id,
                                    })}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="btn btn-sm btn-primary"
                                    style={{
                                      marginLeft: "auto",
                                      textDecoration: "none",
                                    }}
                                  >
                                    学年マスターを編集
                                  </a>
                                </div>
                                {gExpanded && (
                                  <div
                                    className={styles.hubClassesContainer}
                                  >
                                    {classes.length === 0 ? (
                                      <p className="empty-text">
                                        クラスなし
                                      </p>
                                    ) : (
                                      classes.map((cls) => (
                                        <div
                                          key={cls.id}
                                          className={styles.hubClassRow}
                                        >
                                          <span
                                            className={styles.hubClassName}
                                          >
                                            {cls.name}
                                          </span>
                                          <a
                                            href={buildEditorHref(
                                              school.id,
                                              "class",
                                              {
                                                gradeId: grade.id,
                                                departmentId: dept.id,
                                                classId: cls.id,
                                              }
                                            )}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-sm btn-secondary"
                                            style={{
                                              marginLeft: "auto",
                                              textDecoration: "none",
                                            }}
                                          >
                                            クラスを編集
                                          </a>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SchoolAdminHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolIdParam = searchParams.get("school");
  const { showToast } = useToast();
  const { isAdmin, memberships } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [allowedSchools, setAllowedSchools] = useState<School[]>([]);
  const [currentView, setCurrentView] = useState<SchoolHubViewData | null>(
    null
  );

  const loadSchools = useCallback(async () => {
    try {
      const res = await listSchoolsFn();
      const all = res.data.schools || [];
      const allowedIds = isAdmin
        ? all.map((s) => s.id)
        : memberships
            .filter((m) => m.role === "school_admin")
            .map((m) => m.schoolId);
      return all.filter((s) => allowedIds.includes(s.id));
    } catch {
      return [];
    }
  }, [isAdmin, memberships]);

  const loadSchoolDetail = useCallback(
    async (school: School): Promise<SchoolHubViewData> => {
      const res = await getSchoolDetailFn({ schoolId: school.id });
      const d = res.data;
      return {
        school: {
          ...school,
          hierarchyMode: d.hierarchyMode || "class",
        },
        hierarchyMode: d.hierarchyMode || "class",
        grades: (d.grades || []).sort((a, b) =>
          a.name.localeCompare(b.name, "ja")
        ),
        classesMap: d.classesMap || {},
        departments: d.departments || [],
        gradesByDept: d.gradesByDept || {},
        classesByDeptGrade: d.classesByDeptGrade || {},
      };
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const schools = await loadSchools();
        if (cancelled) return;
        setAllowedSchools(schools);

        if (schoolIdParam) {
          const target = schools.find((s) => s.id === schoolIdParam);
          if (!target) {
            showToast("アクセスできる学校ではありません", "error");
            setCurrentView(null);
          } else {
            const view = await loadSchoolDetail(target);
            if (!cancelled) setCurrentView(view);
          }
        } else if (schools.length === 1) {
          router.replace(`/manage/school-admin?school=${schools[0].id}`);
          return;
        } else {
          setCurrentView(null);
        }
      } catch (err) {
        showToast(
          "データ取得に失敗しました: " + (err as Error).message,
          "error"
        );
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolIdParam, loadSchools, loadSchoolDetail, router, showToast]);

  if (loading) return <Loading message="読み込み中..." />;

  if (allowedSchools.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p className="empty-text">アクセスできる学校がありません</p>
      </div>
    );
  }

  if (!schoolIdParam) {
    return <SchoolPicker schools={allowedSchools} />;
  }

  if (!currentView) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p className="empty-text">この学校にアクセスできません</p>
        <p style={{ marginTop: 16 }}>
          <a href="/manage/school-admin">学校一覧に戻る</a>
        </p>
      </div>
    );
  }

  return <SchoolHubView {...currentView} />;
}
