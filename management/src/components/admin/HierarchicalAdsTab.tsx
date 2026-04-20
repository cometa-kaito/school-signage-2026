"use client";

import { useCallback, useEffect, useState } from "react";
import { getDoc, onSnapshot } from "firebase/firestore";
import {
  schoolDocRef,
  gradeDocRef,
  departmentDocRef,
  classDocRef,
} from "@/lib/paths";
import { AdManager, type AdItem } from "@/components/class-settings/AdManager";
import type {
  Grade,
  Department,
  Class,
  HierarchyMode,
} from "@/types/school";
import styles from "@/styles/admin.module.css";

interface HierarchicalAdsTabProps {
  schoolId: string;
  hierarchyMode: HierarchyMode;
  /** クラスモード用 */
  grades: Grade[];
  classesMap: Record<string, Class[]>;
  /** 学科モード用 */
  departments: Department[];
  gradesByDept: Record<string, Grade[]>;
  classesByDeptGrade: Record<string, Record<string, Class[]>>;
}

function AdCountBadge({ count }: { count: number }) {
  return (
    <span
      className="badge"
      style={{
        background: count > 0 ? "#e3f2fd" : "#eee",
        color: count > 0 ? "#1565c0" : "#888",
        marginLeft: 8,
      }}
    >
      {count}件
    </span>
  );
}

function ReadOnlyAdList({ title, ads }: { title: string; ads: AdItem[] }) {
  if (ads.length === 0) return null;
  return (
    <div className={styles.adsTabInherited}>
      <strong>{title}</strong>（ここからは編集できません）:
      <ul className={styles.adsTabInheritedList}>
        {ads.map((ad, i) => (
          <li key={ad.id || i}>
            {ad.type === "video" ? "🎬" : "🖼"}{" "}
            {ad.link_url ? (
              <a
                href={ad.link_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#1565c0" }}
              >
                {ad.link_url}
              </a>
            ) : (
              <span style={{ color: "#666" }}>リンクなし</span>
            )}{" "}
            <span style={{ color: "#999" }}>
              ({ad.duration_sec || 10}秒)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HierarchicalAdsTab({
  schoolId,
  hierarchyMode,
  grades,
  classesMap,
  departments,
  gradesByDept,
  classesByDeptGrade,
}: HierarchicalAdsTabProps) {
  const isDeptMode = hierarchyMode === "department";

  const [schoolAds, setSchoolAds] = useState<AdItem[]>([]);
  /** クラスモード: {gradeId: AdItem[]} / 学科モード: {deptId:gradeId: AdItem[]} */
  const [gradeAds, setGradeAds] = useState<Record<string, AdItem[]>>({});
  /** 学科モード: {deptId: AdItem[]} */
  const [deptAds, setDeptAds] = useState<Record<string, AdItem[]>>({});
  /** クラス広告のキャッシュ */
  const [classAds, setClassAds] = useState<Record<string, AdItem[]>>({});

  const [expandedSection, setExpandedSection] = useState<
    "school" | "department" | "grade" | "class" | null
  >("school");
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedGradeId, setSelectedGradeId] = useState<string | null>(null);
  /** クラス別セクションで現在開いている行のキー（dept:grade:class / grade:class） */
  const [openClassRowKey, setOpenClassRowKey] = useState<string | null>(null);
  /** 学科モード: 学年マスターを学年名単位で扱うための選択状態 */
  const [selectedGradeName, setSelectedGradeName] = useState<string | null>(
    null
  );

  // 学校全体広告
  useEffect(() => {
    const unsub = onSnapshot(schoolDocRef(schoolId), (snap) => {
      setSchoolAds(snap.exists() ? snap.data().displaySettings?.ads || [] : []);
    });
    return () => unsub();
  }, [schoolId]);

  const gradeKey = (gradeId: string, departmentId: string | null) =>
    departmentId ? `${departmentId}:${gradeId}` : gradeId;

  const loadGradeAds = useCallback(
    async (gradeId: string, departmentId: string | null) => {
      const snap = await getDoc(gradeDocRef(schoolId, gradeId, departmentId));
      const key = gradeKey(gradeId, departmentId);
      setGradeAds((prev) => ({
        ...prev,
        [key]: snap.exists() ? snap.data().displaySettings?.ads || [] : [],
      }));
    },
    [schoolId]
  );

  const loadDeptAds = useCallback(
    async (deptId: string) => {
      const snap = await getDoc(departmentDocRef(schoolId, deptId));
      setDeptAds((prev) => ({
        ...prev,
        [deptId]: snap.exists() ? snap.data().displaySettings?.ads || [] : [],
      }));
    },
    [schoolId]
  );

  const loadClassAds = useCallback(
    async (
      gradeId: string,
      classId: string,
      departmentId: string | null
    ) => {
      const snap = await getDoc(
        classDocRef(schoolId, gradeId, classId, departmentId)
      );
      const key = departmentId
        ? `${departmentId}:${gradeId}:${classId}`
        : `${gradeId}:${classId}`;
      setClassAds((prev) => ({
        ...prev,
        [key]: snap.exists() ? snap.data().displaySettings?.ads || [] : [],
      }));
    },
    [schoolId]
  );

  // 学科広告ロード（load* は async、setState は await 後の継続で実行される＝実質コールバック）
  useEffect(() => {
    if (selectedDeptId && deptAds[selectedDeptId] === undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadDeptAds(selectedDeptId);
    }
  }, [selectedDeptId, deptAds, loadDeptAds]);

  // 学年広告ロード
  useEffect(() => {
    if (selectedGradeId) {
      const key = gradeKey(selectedGradeId, isDeptMode ? selectedDeptId : null);
      if (gradeAds[key] === undefined) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadGradeAds(selectedGradeId, isDeptMode ? selectedDeptId : null);
      }
    }
  }, [selectedGradeId, selectedDeptId, gradeAds, loadGradeAds, isDeptMode]);

  // 学科モード: 学年名グルーピング時のプライマリ広告ロード
  useEffect(() => {
    if (!isDeptMode || !selectedGradeName) return;
    const primary = departments
      .flatMap((d) =>
        (gradesByDept[d.id] || [])
          .filter((g) => g.name === selectedGradeName)
          .map((g) => ({ departmentId: d.id, gradeId: g.id }))
      )[0];
    if (!primary) return;
    const key = gradeKey(primary.gradeId, primary.departmentId);
    if (gradeAds[key] === undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadGradeAds(primary.gradeId, primary.departmentId);
    }
  }, [
    isDeptMode,
    selectedGradeName,
    departments,
    gradesByDept,
    gradeAds,
    loadGradeAds,
  ]);

  const gradeAdsTotal = Object.values(gradeAds).reduce(
    (s, a) => s + a.length,
    0
  );
  const deptAdsTotal = Object.values(deptAds).reduce(
    (s, a) => s + a.length,
    0
  );

  return (
    <div>
      <p className={styles.sectionLead}>
        {isDeptMode
          ? "学科モード: 学校 / 学科 / 学年 / クラスの4階層で広告を設定できます。サイネージ表示時は上位の広告も連結して表示されます。"
          : "クラスモード: 学校 / 学年 / クラスの3階層で広告を設定できます。"}
      </p>

      {/* 学校全体 */}
      <div className={styles.adsTabSection}>
        <div
          className={styles.adsTabSectionHeader}
          onClick={() =>
            setExpandedSection(expandedSection === "school" ? null : "school")
          }
          style={{ cursor: "pointer" }}
        >
          <span>{expandedSection === "school" ? "▼" : "▶"}</span>
          <span>学校全体の広告</span>
          <AdCountBadge count={schoolAds.length} />
          <span
            style={{ marginLeft: "auto", fontSize: "0.8rem", color: "#666" }}
          >
            全クラスに表示
          </span>
        </div>
        {expandedSection === "school" && (
          <AdManager
            docRef={schoolDocRef(schoolId)}
            ads={schoolAds}
            onAdsChange={setSchoolAds}
            title="学校全体の広告"
            description="この学校の全クラスに表示される広告です。"
          />
        )}
      </div>

      {/* 学科別（学科モードのみ） */}
      {isDeptMode && (
        <div className={styles.adsTabSection}>
          <div
            className={styles.adsTabSectionHeader}
            onClick={() =>
              setExpandedSection(
                expandedSection === "department" ? null : "department"
              )
            }
            style={{ cursor: "pointer" }}
          >
            <span>{expandedSection === "department" ? "▼" : "▶"}</span>
            <span>学科別の広告</span>
            <AdCountBadge count={deptAdsTotal} />
            <span
              style={{
                marginLeft: "auto",
                fontSize: "0.8rem",
                color: "#666",
              }}
            >
              学科全体（全学年横断）に表示
            </span>
          </div>
          {expandedSection === "department" && (
            <div style={{ padding: "12px 14px 0" }}>
              {departments.length === 0 ? (
                <p className="empty-text">学科が登録されていません</p>
              ) : (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ marginRight: 8, fontWeight: 600 }}>
                      対象学科:
                    </label>
                    <select
                      value={selectedDeptId || ""}
                      onChange={(e) => {
                        setSelectedDeptId(e.target.value || null);
                        setSelectedGradeId(null);
                      }}
                    >
                      <option value="">-- 学科を選択 --</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedDeptId && (
                    <>
                      <ReadOnlyAdList
                        title="学校全体の広告（継承）"
                        ads={schoolAds}
                      />
                      <AdManager
                        docRef={departmentDocRef(schoolId, selectedDeptId)}
                        ads={deptAds[selectedDeptId] || []}
                        onAdsChange={(ads) =>
                          setDeptAds((prev) => ({
                            ...prev,
                            [selectedDeptId]: ads,
                          }))
                        }
                        title={`学科広告 — ${departments.find((d) => d.id === selectedDeptId)?.name || ""}`}
                        description="この学科に属する全学年・全クラスに表示される広告です。"
                      />
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* 学年別 */}
      <div className={styles.adsTabSection}>
        <div
          className={styles.adsTabSectionHeader}
          onClick={() =>
            setExpandedSection(expandedSection === "grade" ? null : "grade")
          }
          style={{ cursor: "pointer" }}
        >
          <span>{expandedSection === "grade" ? "▼" : "▶"}</span>
          <span>学年別の広告</span>
          <AdCountBadge count={gradeAdsTotal} />
          <span
            style={{ marginLeft: "auto", fontSize: "0.8rem", color: "#666" }}
          >
            {isDeptMode
              ? "学科×学年の全クラスに表示"
              : "学年の全クラスに表示"}
          </span>
        </div>
        {expandedSection === "grade" && (
          <div style={{ padding: "12px 14px 0" }}>
            {isDeptMode ? (
              (() => {
                const nameSet = new Set<string>();
                departments.forEach((d) =>
                  (gradesByDept[d.id] || []).forEach((g) => nameSet.add(g.name))
                );
                const names = [...nameSet].sort((a, b) =>
                  a.localeCompare(b, "ja")
                );
                const pairsForName = (name: string) =>
                  departments.flatMap((d) =>
                    (gradesByDept[d.id] || [])
                      .filter((g) => g.name === name)
                      .map((g) => ({ departmentId: d.id, gradeId: g.id }))
                  );
                return (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ marginRight: 8, fontWeight: 600 }}>
                        対象学年:
                      </label>
                      <select
                        value={selectedGradeName || ""}
                        onChange={(e) =>
                          setSelectedGradeName(e.target.value || null)
                        }
                      >
                        <option value="">-- 学年を選択 --</option>
                        {names.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedGradeName &&
                      (() => {
                        const pairs = pairsForName(selectedGradeName);
                        if (pairs.length === 0) return null;
                        const primary = pairs[0];
                        const primaryKey = gradeKey(
                          primary.gradeId,
                          primary.departmentId
                        );
                        const extraRefs = pairs
                          .slice(1)
                          .map((p) =>
                            gradeDocRef(schoolId, p.gradeId, p.departmentId)
                          );
                        return (
                          <>
                            <ReadOnlyAdList
                              title="学校全体の広告（継承）"
                              ads={schoolAds}
                            />
                            <AdManager
                              docRef={gradeDocRef(
                                schoolId,
                                primary.gradeId,
                                primary.departmentId
                              )}
                              extraDocRefs={extraRefs}
                              ads={gradeAds[primaryKey] || []}
                              onAdsChange={(ads) =>
                                setGradeAds((prev) => {
                                  const next = { ...prev };
                                  pairs.forEach((p) => {
                                    next[gradeKey(p.gradeId, p.departmentId)] =
                                      ads;
                                  });
                                  return next;
                                })
                              }
                              title={`学年広告 — ${selectedGradeName}`}
                              description={`全学科の「${selectedGradeName}」の全クラスに表示されます。`}
                            />
                          </>
                        );
                      })()}
                  </>
                );
              })()
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ marginRight: 8, fontWeight: 600 }}>
                    対象学年:
                  </label>
                  <select
                    value={selectedGradeId || ""}
                    onChange={(e) =>
                      setSelectedGradeId(e.target.value || null)
                    }
                  >
                    <option value="">-- 学年を選択 --</option>
                    {grades.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedGradeId &&
                  (() => {
                    const key = gradeKey(selectedGradeId, null);
                    const gradeName =
                      grades.find((g) => g.id === selectedGradeId)?.name || "";
                    return (
                      <>
                        <ReadOnlyAdList
                          title="学校全体の広告（継承）"
                          ads={schoolAds}
                        />
                        <AdManager
                          docRef={gradeDocRef(schoolId, selectedGradeId, null)}
                          ads={gradeAds[key] || []}
                          onAdsChange={(ads) =>
                            setGradeAds((prev) => ({ ...prev, [key]: ads }))
                          }
                          title={`学年広告 — ${gradeName}`}
                          description="この学年の全クラスに表示される広告です。"
                        />
                      </>
                    );
                  })()}
              </>
            )}
          </div>
        )}
      </div>

      {/* クラス別 */}
      <div className={styles.adsTabSection}>
        <div
          className={styles.adsTabSectionHeader}
          onClick={() =>
            setExpandedSection(expandedSection === "class" ? null : "class")
          }
          style={{ cursor: "pointer" }}
        >
          <span>{expandedSection === "class" ? "▼" : "▶"}</span>
          <span>クラス別の広告</span>
          <span
            style={{ marginLeft: "auto", fontSize: "0.8rem", color: "#666" }}
          >
            そのクラスのみに表示
          </span>
        </div>
        {expandedSection === "class" && (() => {
          type ClassRow = {
            key: string;
            title: string;
            gradeId: string;
            classId: string;
            departmentId: string | null;
          };
          const rows: ClassRow[] = [];
          if (isDeptMode) {
            departments.forEach((d) => {
              (gradesByDept[d.id] || []).forEach((g) => {
                (classesByDeptGrade[d.id]?.[g.id] || []).forEach((c) => {
                  rows.push({
                    key: `${d.id}:${g.id}:${c.id}`,
                    title: `${d.name} / ${g.name} / ${c.name}`,
                    gradeId: g.id,
                    classId: c.id,
                    departmentId: d.id,
                  });
                });
              });
            });
          } else {
            grades.forEach((g) => {
              (classesMap[g.id] || []).forEach((c) => {
                rows.push({
                  key: `${g.id}:${c.id}`,
                  title:
                    g.hasClasses === false ? g.name : `${g.name} / ${c.name}`,
                  gradeId: g.id,
                  classId: c.id,
                  departmentId: null,
                });
              });
            });
          }
          if (rows.length === 0) {
            return (
              <div style={{ padding: "12px 14px" }}>
                <p className="empty-text">クラスが登録されていません</p>
              </div>
            );
          }
          return (
            <div
              style={{
                padding: "12px 14px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {rows.map((row) => {
                const open = openClassRowKey === row.key;
                const gKey = gradeKey(row.gradeId, row.departmentId);
                const clsCacheKey = row.departmentId
                  ? `${row.departmentId}:${row.gradeId}:${row.classId}`
                  : `${row.gradeId}:${row.classId}`;
                return (
                  <div
                    key={row.key}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 6,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (open) {
                          setOpenClassRowKey(null);
                          return;
                        }
                        setOpenClassRowKey(row.key);
                        if (
                          row.departmentId &&
                          deptAds[row.departmentId] === undefined
                        ) {
                          loadDeptAds(row.departmentId);
                        }
                        if (gradeAds[gKey] === undefined) {
                          loadGradeAds(row.gradeId, row.departmentId);
                        }
                        if (classAds[clsCacheKey] === undefined) {
                          loadClassAds(
                            row.gradeId,
                            row.classId,
                            row.departmentId
                          );
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        padding: "8px 12px",
                        background: open ? "#f5faff" : "#fafafa",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        fontWeight: 500,
                        fontSize: "0.9rem",
                        borderRadius: 6,
                      }}
                    >
                      <span>{open ? "▼" : "▶"}</span>
                      <span>{row.title}</span>
                      <AdCountBadge
                        count={(classAds[clsCacheKey] || []).length}
                      />
                    </button>
                    {open && (
                      <div
                        style={{
                          padding: "10px 14px 12px",
                          borderTop: "1px solid #eee",
                        }}
                      >
                        <ReadOnlyAdList
                          title="学校全体の広告（継承）"
                          ads={schoolAds}
                        />
                        {row.departmentId && (
                          <ReadOnlyAdList
                            title="学科全体の広告（継承）"
                            ads={deptAds[row.departmentId] || []}
                          />
                        )}
                        <ReadOnlyAdList
                          title="学年全体の広告（継承）"
                          ads={gradeAds[gKey] || []}
                        />
                        <AdManager
                          docRef={classDocRef(
                            schoolId,
                            row.gradeId,
                            row.classId,
                            row.departmentId
                          )}
                          ads={classAds[clsCacheKey] || []}
                          onAdsChange={(ads) =>
                            setClassAds((prev) => ({
                              ...prev,
                              [clsCacheKey]: ads,
                            }))
                          }
                          title={`クラス広告 — ${row.title}`}
                          description="このクラスのサイネージにのみ表示される広告です。"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
