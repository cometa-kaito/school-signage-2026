"use client";

import { useState, useEffect } from "react";
import {
  listGradesFn,
  createGradeFn,
  updateGradeFn,
  deleteGradeFn,
  listClassesFn,
  createClassFn,
  updateClassFn,
  deleteClassFn,
  listMembersFn,
  inviteMemberFn,
  updateMembershipFn,
  removeMemberFn,
  listUsersFn,
  createAdminUserFn,
  setAdminRoleFn,
  updateUserFn,
  deleteUserFn,
  toggleUserStatusFn,
  setEditorPasswordFn,
  listDevicesFn,
  registerDeviceFn,
  revokeDeviceTokenFn,
  removeDeviceFn,
} from "@/lib/firebase-functions";
import { getDoc, setDoc } from "firebase/firestore";
import { doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { schoolDocRef } from "@/lib/paths";
import { Modal } from "@/components/ui/Modal";
import { Loading } from "@/components/ui/Loading";
import { useToast } from "@/components/ui/Toast";
import type { Grade, Class, Device } from "@/types/school";
import type { Membership, UserInfo } from "@/types/auth";
import styles from "@/styles/admin.module.css";
import Link from "next/link";

interface SchoolDetailViewProps {
  schoolId: string;
  isSystemAdmin: boolean;
}

export function SchoolDetailView({
  schoolId,
  isSystemAdmin,
}: SchoolDetailViewProps) {
  const { showToast } = useToast();
  const [schoolName, setSchoolName] = useState("");
  const [activeTab, setActiveTab] = useState<
    "grades" | "members" | "devices" | "users" | "settings"
  >("grades");
  const [loading, setLoading] = useState(true);

  // Grades & Classes
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classesMap, setClassesMap] = useState<Record<string, Class[]>>({});
  const [expandedGrade, setExpandedGrade] = useState<string | null>(null);

  // Members
  const [members, setMembers] = useState<Membership[]>([]);

  // Devices
  const [devices, setDevices] = useState<Device[]>([]);

  // Users (system admin only)
  const [users, setUsers] = useState<UserInfo[]>([]);

  // Class URL expansion
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

  // Modals
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [newGradeName, setNewGradeName] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [targetGradeId, setTargetGradeId] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("teacher");

  // Grade/Class editing
  const [editGradeModalOpen, setEditGradeModalOpen] = useState(false);
  const [editGradeId, setEditGradeId] = useState("");
  const [editGradeName, setEditGradeName] = useState("");
  const [editClassModalOpen, setEditClassModalOpen] = useState(false);
  const [editClassGradeId, setEditClassGradeId] = useState("");
  const [editClassId, setEditClassId] = useState("");
  const [editClassName, setEditClassName] = useState("");

  // Device registration
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceGradeId, setNewDeviceGradeId] = useState("");
  const [newDeviceClassId, setNewDeviceClassId] = useState("");
  const [generatedToken, setGeneratedToken] = useState("");

  // User management (system admin)
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserDisplayName, setNewUserDisplayName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);

  // Editor password
  const [editorPassword, setEditorPassword] = useState("");

  // School quiet hours
  const [schoolQuietHours, setSchoolQuietHours] = useState<
    { start: string; end: string }[]
  >([]);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const snap = await getDoc(schoolDocRef(schoolId));
        setSchoolName(snap.exists() ? snap.data().name || schoolId : schoolId);

        const gradeRes = await listGradesFn({ schoolId });
        const gradeList = gradeRes.data.grades || [];
        setGrades(gradeList);

        // Load classes for all grades
        const classMap: Record<string, Class[]> = {};
        await Promise.all(
          gradeList.map(async (g) => {
            try {
              const res = await listClassesFn({ schoolId, gradeId: g.id });
              classMap[g.id] = res.data.classes || [];
            } catch {
              classMap[g.id] = [];
            }
          })
        );
        setClassesMap(classMap);

        const memberRes = await listMembersFn({ schoolId });
        setMembers(memberRes.data.members || []);

        const deviceRes = await listDevicesFn({ schoolId });
        setDevices(deviceRes.data.devices || []);

        if (isSystemAdmin) {
          const userRes = await listUsersFn();
          setUsers(userRes.data.users || []);
        }

        // Load editor password
        try {
          const authSnap = await getDoc(
            doc(db, "schools", schoolId, "config", "editor_auth")
          );
          if (authSnap.exists() && authSnap.data().password) {
            setEditorPassword(authSnap.data().password);
          }
        } catch {
          // ignore
        }

        // Load school quiet hours
        try {
          const configSnap = await getDoc(
            doc(db, "schools", schoolId, "config", "display_settings")
          );
          if (configSnap.exists()) {
            setSchoolQuietHours(configSnap.data().quiet_hours || []);
          }
        } catch {
          // ignore
        }
      } catch (err) {
        showToast(
          "データの読み込みに失敗: " + (err as Error).message,
          "error"
        );
      }
      setLoading(false);
    }
    load();
  }, [schoolId, isSystemAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateGrade = async () => {
    if (!newGradeName.trim()) return;
    setSaving(true);
    try {
      await createGradeFn({ schoolId, name: newGradeName });
      showToast("学年を作成しました", "success");
      setGradeModalOpen(false);
      setNewGradeName("");
      const res = await listGradesFn({ schoolId });
      setGrades(res.data.grades || []);
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  const handleDeleteGrade = async (gradeId: string) => {
    if (!confirm("この学年を削除しますか？")) return;
    try {
      await deleteGradeFn({ schoolId, gradeId });
      showToast("学年を削除しました", "success");
      const res = await listGradesFn({ schoolId });
      setGrades(res.data.grades || []);
    } catch (err) {
      showToast("削除エラー: " + (err as Error).message, "error");
    }
  };

  const handleRenameGrade = async () => {
    if (!editGradeName.trim() || !editGradeId) return;
    setSaving(true);
    try {
      await updateGradeFn({ schoolId, gradeId: editGradeId, name: editGradeName });
      showToast("学年名を変更しました", "success");
      setEditGradeModalOpen(false);
      const res = await listGradesFn({ schoolId });
      setGrades(res.data.grades || []);
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  const handleRenameClass = async () => {
    if (!editClassName.trim() || !editClassGradeId || !editClassId) return;
    setSaving(true);
    try {
      await updateClassFn({
        schoolId,
        gradeId: editClassGradeId,
        classId: editClassId,
        name: editClassName,
      });
      showToast("クラス名を変更しました", "success");
      setEditClassModalOpen(false);
      const res = await listClassesFn({ schoolId, gradeId: editClassGradeId });
      setClassesMap((prev) => ({
        ...prev,
        [editClassGradeId]: res.data.classes || [],
      }));
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  const handleCreateClass = async () => {
    if (!newClassName.trim() || !targetGradeId) return;
    setSaving(true);
    try {
      await createClassFn({
        schoolId,
        gradeId: targetGradeId,
        name: newClassName,
      });
      showToast("クラスを作成しました", "success");
      setClassModalOpen(false);
      setNewClassName("");
      const res = await listClassesFn({
        schoolId,
        gradeId: targetGradeId,
      });
      setClassesMap((prev) => ({
        ...prev,
        [targetGradeId]: res.data.classes || [],
      }));
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  const handleDeleteClass = async (gradeId: string, classId: string) => {
    if (!confirm("このクラスを削除しますか？")) return;
    try {
      await deleteClassFn({ schoolId, gradeId, classId });
      showToast("クラスを削除しました", "success");
      const res = await listClassesFn({ schoolId, gradeId });
      setClassesMap((prev) => ({
        ...prev,
        [gradeId]: res.data.classes || [],
      }));
    } catch (err) {
      showToast("削除エラー: " + (err as Error).message, "error");
    }
  };

  const handleInviteMember = async () => {
    if (!newMemberEmail.trim()) return;
    setSaving(true);
    try {
      await inviteMemberFn({
        email: newMemberEmail,
        schoolId,
        role: newMemberRole,
      });
      showToast("メンバーを招待しました", "success");
      setMemberModalOpen(false);
      setNewMemberEmail("");
      const res = await listMembersFn({ schoolId });
      setMembers(res.data.members || []);
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("このメンバーを削除しますか？")) return;
    try {
      await removeMemberFn({ userId, schoolId });
      showToast("メンバーを削除しました", "success");
      const res = await listMembersFn({ schoolId });
      setMembers(res.data.members || []);
    } catch (err) {
      showToast("削除エラー: " + (err as Error).message, "error");
    }
  };

  // メンバーロール変更
  const handleUpdateMemberRole = async (userId: string, newRole: string) => {
    try {
      await updateMembershipFn({ userId, schoolId, role: newRole });
      showToast("ロールを変更しました", "success");
      const res = await listMembersFn({ schoolId });
      setMembers(res.data.members || []);
    } catch (err) {
      showToast("ロール変更エラー: " + (err as Error).message, "error");
    }
  };

  // 学年並び替え
  const handleMoveGrade = async (gradeIndex: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? gradeIndex - 1 : gradeIndex + 1;
    if (swapIndex < 0 || swapIndex >= grades.length) return;
    const gradeA = grades[gradeIndex];
    const gradeB = grades[swapIndex];
    const orderA = gradeA.order ?? gradeIndex;
    const orderB = gradeB.order ?? swapIndex;
    try {
      await Promise.all([
        updateGradeFn({ schoolId, gradeId: gradeA.id, order: orderB }),
        updateGradeFn({ schoolId, gradeId: gradeB.id, order: orderA }),
      ]);
      const res = await listGradesFn({ schoolId });
      setGrades(res.data.grades || []);
      showToast("並び順を変更しました", "success");
    } catch (err) {
      showToast("並び替えエラー: " + (err as Error).message, "error");
    }
  };

  // ユーザー作成
  const handleCreateUser = async () => {
    if (!newUserEmail.trim() || !newUserPassword.trim()) return;
    setSaving(true);
    try {
      const res = await createAdminUserFn({
        email: newUserEmail,
        password: newUserPassword,
        displayName: newUserDisplayName || undefined,
      });
      if (newUserIsAdmin) {
        await setAdminRoleFn({ uid: res.data.uid, admin: true });
      }
      showToast("ユーザーを作成しました", "success");
      setUserModalOpen(false);
      setNewUserEmail("");
      setNewUserDisplayName("");
      setNewUserPassword("");
      setNewUserIsAdmin(false);
      const userRes = await listUsersFn();
      setUsers(userRes.data.users || []);
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  // ユーザー編集
  const handleUpdateUser = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      await updateUserFn({
        uid: editingUser.uid,
        displayName: newUserDisplayName || undefined,
      });
      const wasAdmin = editingUser.customClaims?.admin ?? false;
      if (wasAdmin !== newUserIsAdmin) {
        await setAdminRoleFn({ uid: editingUser.uid, admin: newUserIsAdmin });
      }
      showToast("ユーザーを更新しました", "success");
      setEditingUser(null);
      const userRes = await listUsersFn();
      setUsers(userRes.data.users || []);
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  // ユーザー有効/無効トグル
  const handleToggleUserStatus = async (uid: string, currentDisabled: boolean) => {
    try {
      await toggleUserStatusFn({ uid, disabled: !currentDisabled });
      showToast(
        currentDisabled ? "ユーザーを有効にしました" : "ユーザーを無効にしました",
        "success"
      );
      const userRes = await listUsersFn();
      setUsers(userRes.data.users || []);
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
  };

  // ユーザー削除
  const handleDeleteUser = async (uid: string) => {
    if (!confirm("このユーザーを完全に削除しますか？この操作は取り消せません。")) return;
    try {
      await deleteUserFn({ uid });
      showToast("ユーザーを削除しました", "success");
      const userRes = await listUsersFn();
      setUsers(userRes.data.users || []);
    } catch (err) {
      showToast("削除エラー: " + (err as Error).message, "error");
    }
  };

  const handleSetEditorPassword = async () => {
    if (!editorPassword.trim()) return;
    if (editorPassword.trim().length < 6) {
      showToast("パスワードは6文字以上で設定してください", "error");
      return;
    }
    setSaving(true);
    try {
      await setEditorPasswordFn({ schoolId, password: editorPassword });
      showToast("エディターパスワードを設定しました", "success");
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  const handleAddQuietHour = () => {
    setSchoolQuietHours([...schoolQuietHours, { start: "08:45", end: "15:30" }]);
  };

  const handleRemoveQuietHour = (index: number) => {
    setSchoolQuietHours(schoolQuietHours.filter((_, i) => i !== index));
  };

  const handleQuietHourChange = (
    index: number,
    field: "start" | "end",
    value: string
  ) => {
    const updated = [...schoolQuietHours];
    updated[index] = { ...updated[index], [field]: value };
    setSchoolQuietHours(updated);
  };

  const handleSaveQuietHours = async () => {
    setSaving(true);
    try {
      const configRef = doc(db, "schools", schoolId, "config", "display_settings");
      await setDoc(configRef, { quiet_hours: schoolQuietHours }, { merge: true });
      showToast("静寂時間を保存しました", "success");
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  const handleRegisterDevice = async () => {
    if (!newDeviceName.trim() || !newDeviceGradeId || !newDeviceClassId) return;
    setSaving(true);
    try {
      const res = await registerDeviceFn({
        schoolId,
        gradeId: newDeviceGradeId,
        classId: newDeviceClassId,
        name: newDeviceName,
      });
      setGeneratedToken(res.data.token);
      showToast("デバイスを登録しました", "success");
      const deviceRes = await listDevicesFn({ schoolId });
      setDevices(deviceRes.data.devices || []);
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm("このデバイスのトークンを失効させますか？")) return;
    try {
      await revokeDeviceTokenFn({ schoolId, deviceId });
      showToast("トークンを失効しました", "success");
      const res = await listDevicesFn({ schoolId });
      setDevices(res.data.devices || []);
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (!confirm("このデバイスを削除しますか？")) return;
    try {
      await removeDeviceFn({ schoolId, deviceId });
      showToast("デバイスを削除しました", "success");
      const res = await listDevicesFn({ schoolId });
      setDevices(res.data.devices || []);
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => showToast("コピーしました", "success"),
      () => showToast("コピーに失敗しました", "error")
    );
  };

  if (loading) return <Loading message="学校情報を読み込み中..." />;

  const tabs = [
    { key: "grades" as const, label: "学年・クラス" },
    { key: "members" as const, label: "メンバー" },
    { key: "devices" as const, label: "端末" },
    ...(isSystemAdmin
      ? [{ key: "users" as const, label: "ユーザー" }]
      : []),
    { key: "settings" as const, label: "設定" },
  ];

  return (
    <div>
      <h2 className={styles.schoolTitle}>{schoolName}</h2>

      <div className={styles.tabBar}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 学年・クラス */}
      {activeTab === "grades" && (
        <div>
          <div className={styles.sectionHeader}>
            <h3>学年・クラス</h3>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setGradeModalOpen(true)}
            >
              + 学年追加
            </button>
          </div>

          {grades.length === 0 ? (
            <p className="empty-text">学年が登録されていません</p>
          ) : (
            grades.map((grade, gradeIndex) => (
              <div key={grade.id} className={styles.gradeCard}>
                <div
                  className={styles.gradeHeader}
                  onClick={() =>
                    setExpandedGrade(
                      expandedGrade === grade.id ? null : grade.id
                    )
                  }
                >
                  <span className={styles.gradeToggle}>
                    {expandedGrade === grade.id ? "▼" : "▶"}
                  </span>
                  <strong>{grade.name}</strong>
                  <span className={styles.classBadge}>
                    {(classesMap[grade.id] || []).length}クラス
                  </span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
                    <button
                      className={styles.orderBtn}
                      disabled={gradeIndex === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveGrade(gradeIndex, "up");
                      }}
                      title="上に移動"
                    >
                      ▲
                    </button>
                    <button
                      className={styles.orderBtn}
                      disabled={gradeIndex === grades.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveGrade(gradeIndex, "down");
                      }}
                      title="下に移動"
                    >
                      ▼
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditGradeId(grade.id);
                        setEditGradeName(grade.name);
                        setEditGradeModalOpen(true);
                      }}
                    >
                      編集
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGrade(grade.id);
                      }}
                    >
                      削除
                    </button>
                  </div>
                </div>

                {expandedGrade === grade.id && (
                  <div className={styles.classesContainer}>
                    {(classesMap[grade.id] || []).map((cls) => {
                      const origin = typeof window !== "undefined" ? window.location.origin : "";
                      const signageUrl = `${origin}/?school=${schoolId}&grade=${grade.id}&class=${cls.id}&kiosk=1`;
                      const editorUrl = `${origin}/manage/editor?school=${schoolId}&grade=${grade.id}&class=${cls.id}`;
                      const mobileEditorUrl = `${origin}/manage/editor-mobile?school=${schoolId}&grade=${grade.id}&class=${cls.id}`;
                      const settingsUrl = `${origin}/manage/class-settings?school=${schoolId}&grade=${grade.id}&class=${cls.id}`;
                      const isExpanded = expandedClassId === cls.id;

                      return (
                        <div key={cls.id}>
                          <div className={styles.classItem}>
                            <span
                              style={{ cursor: "pointer" }}
                              onClick={() =>
                                setExpandedClassId(isExpanded ? null : cls.id)
                              }
                            >
                              {isExpanded ? "▼" : "▶"} {cls.name}
                            </span>
                            <div style={{ display: "flex", gap: "4px" }}>
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => {
                                  setEditClassGradeId(grade.id);
                                  setEditClassId(cls.id);
                                  setEditClassName(cls.name);
                                  setEditClassModalOpen(true);
                                }}
                              >
                                編集
                              </button>
                              <Link
                                href={`/manage/class-settings?school=${schoolId}&grade=${grade.id}&class=${cls.id}`}
                                className="btn btn-sm btn-secondary"
                              >
                                設定
                              </Link>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() =>
                                  handleDeleteClass(grade.id, cls.id)
                                }
                              >
                                削除
                              </button>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className={styles.urlSection}>
                              <div className={styles.urlRow}>
                                <span className={styles.urlLabel}>サイネージ:</span>
                                <input
                                  type="text"
                                  readOnly
                                  value={signageUrl}
                                  className={styles.urlInput}
                                />
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => copyToClipboard(signageUrl)}
                                >
                                  コピー
                                </button>
                              </div>
                              <div className={styles.urlRow}>
                                <span className={styles.urlLabel}>エディター（PC）:</span>
                                <input
                                  type="text"
                                  readOnly
                                  value={editorUrl}
                                  className={styles.urlInput}
                                />
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => copyToClipboard(editorUrl)}
                                >
                                  コピー
                                </button>
                              </div>
                              <div className={styles.urlRow}>
                                <span className={styles.urlLabel}>エディター（スマホ）:</span>
                                <input
                                  type="text"
                                  readOnly
                                  value={mobileEditorUrl}
                                  className={styles.urlInput}
                                />
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => copyToClipboard(mobileEditorUrl)}
                                >
                                  コピー
                                </button>
                              </div>
                              <div className={styles.urlRow}>
                                <span className={styles.urlLabel}>設定:</span>
                                <input
                                  type="text"
                                  readOnly
                                  value={settingsUrl}
                                  className={styles.urlInput}
                                />
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => copyToClipboard(settingsUrl)}
                                >
                                  コピー
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => {
                        setTargetGradeId(grade.id);
                        setClassModalOpen(true);
                      }}
                    >
                      + クラス追加
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* メンバー */}
      {activeTab === "members" && (
        <div>
          <div className={styles.sectionHeader}>
            <h3>メンバー</h3>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setMemberModalOpen(true)}
            >
              + メンバー招待
            </button>
          </div>
          {members.length === 0 ? (
            <p className="empty-text">メンバーがいません</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>メール</th>
                  <th>ロール</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>{m.email || m.userId}</td>
                    <td>
                      <select
                        className={styles.roleSelect}
                        value={m.role}
                        onChange={(e) =>
                          handleUpdateMemberRole(m.userId, e.target.value)
                        }
                      >
                        <option value="school_admin">学校管理者</option>
                        <option value="teacher">教員</option>
                        <option value="editor">エディター</option>
                      </select>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRemoveMember(m.userId)}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 端末管理 */}
      {activeTab === "devices" && (
        <div>
          <div className={styles.sectionHeader}>
            <h3>端末管理</h3>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setDeviceModalOpen(true);
                setGeneratedToken("");
                setNewDeviceName("");
                setNewDeviceGradeId(grades[0]?.id || "");
                setNewDeviceClassId("");
              }}
            >
              + 端末登録
            </button>
          </div>
          {devices.length === 0 ? (
            <p className="empty-text">登録されている端末はありません</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>端末名</th>
                  <th>学年</th>
                  <th>クラス</th>
                  <th>状態</th>
                  <th>最終接続</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => {
                  const gradeName = grades.find((g) => g.id === d.gradeId)?.name || d.gradeId;
                  const className = classesMap[d.gradeId]?.find((c) => c.id === d.classId)?.name || d.classId;
                  return (
                    <tr key={d.id}>
                      <td>{d.name}</td>
                      <td>{gradeName}</td>
                      <td>{className}</td>
                      <td>
                        <span className={`badge ${d.status === "active" ? "badge-active" : "badge-disabled"}`}>
                          {d.status === "active" ? "有効" : "無効"}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "#888" }}>
                        {d.lastSeen || "-"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "4px" }}>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleRevokeDevice(d.id)}
                          >
                            失効
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleRemoveDevice(d.id)}
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ユーザー (system_admin only) */}
      {activeTab === "users" && isSystemAdmin && (
        <div>
          <div className={styles.sectionHeader}>
            <h3>ユーザー管理</h3>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditingUser(null);
                setNewUserEmail("");
                setNewUserDisplayName("");
                setNewUserPassword("");
                setNewUserIsAdmin(false);
                setUserModalOpen(true);
              }}
            >
              + ユーザー追加
            </button>
          </div>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>メール</th>
                <th>表示名</th>
                <th>ロール</th>
                <th>状態</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid}>
                  <td>{u.email}</td>
                  <td>{u.displayName || "-"}</td>
                  <td>
                    {u.customClaims?.admin ? (
                      <span className="badge badge-admin">管理者</span>
                    ) : (
                      <span className="badge badge-user">一般</span>
                    )}
                  </td>
                  <td>
                    <button
                      className={`btn btn-sm ${u.disabled ? "btn-secondary" : ""}`}
                      onClick={() => handleToggleUserStatus(u.uid, !!u.disabled)}
                      style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                    >
                      {u.disabled ? "無効 → 有効にする" : "有効 → 無効にする"}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => {
                          setEditingUser(u);
                          setNewUserDisplayName(u.displayName || "");
                          setNewUserIsAdmin(!!u.customClaims?.admin);
                          setUserModalOpen(true);
                        }}
                      >
                        編集
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteUser(u.uid)}
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 設定 */}
      {activeTab === "settings" && (
        <div>
          <div className={styles.settingCard}>
            <h3>エディターパスワード</h3>
            <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: 12 }}>
              教員・エディターがログインするためのパスワードを設定します。
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="password"
                value={editorPassword}
                onChange={(e) => setEditorPassword(e.target.value)}
                placeholder="新しいパスワード"
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                }}
              />
              <button
                className="btn btn-primary"
                onClick={handleSetEditorPassword}
                disabled={saving}
              >
                設定
              </button>
            </div>
          </div>

          <div className={styles.settingCard} style={{ marginTop: 20 }}>
            <h3>学校マスター静寂時間</h3>
            <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: 12 }}>
              クラス個別に設定がない場合に適用されるデフォルトの静寂時間です。
              静寂時間中は広告が非表示になります。
            </p>
            {schoolQuietHours.map((qh, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <input
                  type="time"
                  value={qh.start}
                  onChange={(e) =>
                    handleQuietHourChange(idx, "start", e.target.value)
                  }
                  style={{
                    padding: "6px 10px",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                  }}
                />
                <span>〜</span>
                <input
                  type="time"
                  value={qh.end}
                  onChange={(e) =>
                    handleQuietHourChange(idx, "end", e.target.value)
                  }
                  style={{
                    padding: "6px 10px",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                  }}
                />
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleRemoveQuietHour(idx)}
                >
                  削除
                </button>
              </div>
            ))}
            <div style={{ display: "flex", gap: "8px", marginTop: 8 }}>
              <button className="btn btn-sm" onClick={handleAddQuietHour}>
                + 時間帯を追加
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveQuietHours}
                disabled={saving}
                style={{ marginLeft: "auto" }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 学年追加モーダル */}
      <Modal
        isOpen={gradeModalOpen}
        onClose={() => setGradeModalOpen(false)}
        title="学年を追加"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setGradeModalOpen(false)}
            >
              キャンセル
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreateGrade}
              disabled={saving}
            >
              作成
            </button>
          </>
        }
      >
        <div className="form-group">
          <label>学年名</label>
          <input
            type="text"
            value={newGradeName}
            onChange={(e) => setNewGradeName(e.target.value)}
            placeholder="例: 電子工学科2年"
          />
        </div>
      </Modal>

      {/* クラス追加モーダル */}
      <Modal
        isOpen={classModalOpen}
        onClose={() => setClassModalOpen(false)}
        title="クラスを追加"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setClassModalOpen(false)}
            >
              キャンセル
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreateClass}
              disabled={saving}
            >
              作成
            </button>
          </>
        }
      >
        <div className="form-group">
          <label>クラス名</label>
          <input
            type="text"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="例: A組"
          />
        </div>
      </Modal>

      {/* 端末登録モーダル */}
      <Modal
        isOpen={deviceModalOpen}
        onClose={() => setDeviceModalOpen(false)}
        title="端末を登録"
        footer={
          generatedToken ? (
            <button
              className="btn btn-primary"
              onClick={() => setDeviceModalOpen(false)}
            >
              閉じる
            </button>
          ) : (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setDeviceModalOpen(false)}
              >
                キャンセル
              </button>
              <button
                className="btn btn-primary"
                onClick={handleRegisterDevice}
                disabled={saving}
              >
                登録
              </button>
            </>
          )
        }
      >
        {generatedToken ? (
          <div>
            <p style={{ marginBottom: 8, fontWeight: 600 }}>
              デバイストークンが生成されました:
            </p>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <input
                type="text"
                readOnly
                value={generatedToken}
                style={{
                  flex: 1,
                  padding: "8px",
                  fontSize: "0.85rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontFamily: "monospace",
                }}
              />
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => copyToClipboard(generatedToken)}
              >
                コピー
              </button>
            </div>
            <p style={{ color: "#e74c3c", fontSize: "0.8rem", marginTop: 8 }}>
              このトークンは一度だけ表示されます。安全な場所に保存してください。
            </p>
          </div>
        ) : (
          <>
            <div className="form-group">
              <label>端末名</label>
              <input
                type="text"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                placeholder="例: 教室ディスプレイ1"
              />
            </div>
            <div className="form-group">
              <label>学年</label>
              <select
                value={newDeviceGradeId}
                onChange={(e) => {
                  setNewDeviceGradeId(e.target.value);
                  setNewDeviceClassId("");
                }}
              >
                <option value="">-- 選択 --</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>クラス</label>
              <select
                value={newDeviceClassId}
                onChange={(e) => setNewDeviceClassId(e.target.value)}
                disabled={!newDeviceGradeId}
              >
                <option value="">-- 選択 --</option>
                {(classesMap[newDeviceGradeId] || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </Modal>

      {/* メンバー招待モーダル */}
      <Modal
        isOpen={memberModalOpen}
        onClose={() => setMemberModalOpen(false)}
        title="メンバーを招待"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setMemberModalOpen(false)}
            >
              キャンセル
            </button>
            <button
              className="btn btn-primary"
              onClick={handleInviteMember}
              disabled={saving}
            >
              招待
            </button>
          </>
        }
      >
        <div className="form-group">
          <label>メールアドレス</label>
          <input
            type="email"
            value={newMemberEmail}
            onChange={(e) => setNewMemberEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </div>
        <div className="form-group">
          <label>ロール</label>
          <select
            value={newMemberRole}
            onChange={(e) => setNewMemberRole(e.target.value)}
          >
            <option value="school_admin">学校管理者</option>
            <option value="teacher">教員</option>
          </select>
        </div>
      </Modal>

      {/* ユーザー作成/編集モーダル */}
      <Modal
        isOpen={userModalOpen}
        onClose={() => {
          setUserModalOpen(false);
          setEditingUser(null);
        }}
        title={editingUser ? "ユーザーを編集" : "ユーザーを追加"}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setUserModalOpen(false);
                setEditingUser(null);
              }}
            >
              キャンセル
            </button>
            <button
              className="btn btn-primary"
              onClick={editingUser ? handleUpdateUser : handleCreateUser}
              disabled={saving}
            >
              {editingUser ? "更新" : "作成"}
            </button>
          </>
        }
      >
        {!editingUser && (
          <div className="form-group">
            <label>メールアドレス</label>
            <input
              type="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
        )}
        {editingUser && (
          <div className="form-group">
            <label>メールアドレス</label>
            <input type="email" value={editingUser.email || ""} readOnly disabled />
          </div>
        )}
        <div className="form-group">
          <label>表示名</label>
          <input
            type="text"
            value={newUserDisplayName}
            onChange={(e) => setNewUserDisplayName(e.target.value)}
            placeholder="表示名（任意）"
          />
        </div>
        {!editingUser && (
          <div className="form-group">
            <label>パスワード</label>
            <input
              type="password"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              placeholder="6文字以上"
            />
          </div>
        )}
        <div className="form-group">
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              checked={newUserIsAdmin}
              onChange={(e) => setNewUserIsAdmin(e.target.checked)}
            />
            システム管理者権限を付与
          </label>
        </div>
      </Modal>

      {/* 学年名編集モーダル */}
      <Modal
        isOpen={editGradeModalOpen}
        onClose={() => setEditGradeModalOpen(false)}
        title="学年名を編集"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setEditGradeModalOpen(false)}
            >
              キャンセル
            </button>
            <button
              className="btn btn-primary"
              onClick={handleRenameGrade}
              disabled={saving}
            >
              保存
            </button>
          </>
        }
      >
        <div className="form-group">
          <label>学年名</label>
          <input
            type="text"
            value={editGradeName}
            onChange={(e) => setEditGradeName(e.target.value)}
            placeholder="例: 電子工学科2年"
          />
        </div>
      </Modal>

      {/* クラス名編集モーダル */}
      <Modal
        isOpen={editClassModalOpen}
        onClose={() => setEditClassModalOpen(false)}
        title="クラス名を編集"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setEditClassModalOpen(false)}
            >
              キャンセル
            </button>
            <button
              className="btn btn-primary"
              onClick={handleRenameClass}
              disabled={saving}
            >
              保存
            </button>
          </>
        }
      >
        <div className="form-group">
          <label>クラス名</label>
          <input
            type="text"
            value={editClassName}
            onChange={(e) => setEditClassName(e.target.value)}
            placeholder="例: A組"
          />
        </div>
      </Modal>
    </div>
  );
}
