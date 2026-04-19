"use client";

import { useState, useEffect } from "react";
import {
  getAdminOverviewFn,
  listSchoolsFn,
  createSchoolFn,
  updateSchoolFn,
  deleteSchoolFn,
  setSchoolHierarchyModeFn,
  listUsersFn,
  listMembersFn,
  deleteUserFn,
  createAdminUserFn,
  setAdminRoleFn,
  updateUserFn,
  toggleUserStatusFn,
  inviteMemberFn,
  removeMemberFn,
} from "@/lib/firebase-functions";
import { Modal } from "@/components/ui/Modal";
import { Loading } from "@/components/ui/Loading";
import { EditIconButton } from "@/components/ui/EditIconButton";
import { useToast } from "@/components/ui/Toast";
import type { School, HierarchyMode } from "@/types/school";
import type { UserInfo, Membership } from "@/types/auth";
import styles from "@/styles/admin.module.css";
import { useRouter } from "next/navigation";

interface SchoolMembership {
  schoolId: string;
  schoolName: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  school_admin: "学校管理者",
  teacher: "教員",
  editor: "エディター",
};

export function SchoolListView() {
  const router = useRouter();
  const { showToast } = useToast();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [formName, setFormName] = useState("");
  const [formMode, setFormMode] = useState<HierarchyMode>("class");
  const [saving, setSaving] = useState(false);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [busyItems, setBusyItems] = useState<Record<string, string>>({}); // key -> message

  const runBusy = async <T,>(
    message: string,
    fn: () => Promise<T>,
    itemKey?: string
  ): Promise<T> => {
    setBusyMessage(message);
    if (itemKey) {
      setBusyItems((prev) => ({ ...prev, [itemKey]: message }));
    }
    try {
      return await fn();
    } finally {
      setBusyMessage(null);
      if (itemKey) {
        setBusyItems((prev) => {
          const next = { ...prev };
          delete next[itemKey];
          return next;
        });
      }
    }
  };

  // Global user management
  const [globalUsers, setGlobalUsers] = useState<UserInfo[]>([]);
  const [membershipsMap, setMembershipsMap] = useState<Record<string, SchoolMembership[]>>({});
  const [usersLoading, setUsersLoading] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserDisplayName, setNewUserDisplayName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const [newUserMembership, setNewUserMembership] = useState(""); // "schoolId:role" or ""

  const loadAll = async () => {
    setLoading(true);
    setUsersLoading(true);
    try {
      const res = await getAdminOverviewFn();
      const d = res.data;
      setSchools(d.schools || []);
      setGlobalUsers(d.users || []);
      setMembershipsMap(d.membershipsMap || {});
    } catch {
      showToast("データの取得に失敗しました", "error");
    }
    setLoading(false);
    setUsersLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreateModal = () => {
    setEditingSchool(null);
    setFormName("");
    setFormMode("class");
    setModalOpen(true);
  };

  const openEditModal = (school: School) => {
    setEditingSchool(school);
    setFormName(school.name);
    setFormMode(school.hierarchyMode || "class");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      await runBusy(editingSchool ? "学校を更新中..." : "学校を作成中...", async () => {
        if (editingSchool) {
          await updateSchoolFn({ schoolId: editingSchool.id, name: formName });
          const currentMode = editingSchool.hierarchyMode || "class";
          if (currentMode !== formMode) {
            await setSchoolHierarchyModeFn({
              schoolId: editingSchool.id,
              mode: formMode,
            });
          }
          showToast("学校を更新しました", "success");
        } else {
          await createSchoolFn({
            name: formName,
            hierarchyMode: formMode,
          });
          showToast("学校を作成しました", "success");
        }
        setModalOpen(false);
        await loadAll();
      });
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  const handleDelete = async (school: School) => {
    if (!confirm(`「${school.name}」を削除しますか？`)) return;
    try {
      await runBusy(
        "学校を削除中...",
        async () => {
          await deleteSchoolFn({ schoolId: school.id });
          showToast("学校を削除しました", "success");
          await loadAll();
        },
        `school:${school.id}`
      );
    } catch (err) {
      showToast("削除エラー: " + (err as Error).message, "error");
    }
  };


  const syncMembership = async (
    uid: string,
    email: string,
    existing: SchoolMembership[],
    selection: string
  ) => {
    // 既存の所属を全削除
    for (const m of existing) {
      await removeMemberFn({ schoolId: m.schoolId, userId: uid });
    }
    // 新しい所属を追加
    if (selection) {
      const [schoolId, role] = selection.split(":");
      if (schoolId && role) {
        await inviteMemberFn({ schoolId, email, role });
      }
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail.trim() || !newUserPassword.trim()) return;
    setSaving(true);
    try {
      await runBusy("ユーザーを作成中...", async () => {
        const res = await createAdminUserFn({
          email: newUserEmail,
          password: newUserPassword,
          displayName: newUserDisplayName || undefined,
        });
        if (newUserIsAdmin) {
          await setAdminRoleFn({ uid: res.data.uid, admin: true });
        }
        if (newUserMembership) {
          await syncMembership(res.data.uid, newUserEmail, [], newUserMembership);
        }
        showToast("ユーザーを作成しました", "success");
        setUserModalOpen(false);
        resetUserForm();
        await loadAll();
      });
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  const handleUpdateGlobalUser = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      await runBusy("ユーザーを更新中...", async () => {
        await updateUserFn({
          uid: editingUser.uid,
          displayName: newUserDisplayName || undefined,
        });
        const wasAdmin = editingUser.isAdmin ?? false;
        if (wasAdmin !== newUserIsAdmin) {
          await setAdminRoleFn({ uid: editingUser.uid, admin: newUserIsAdmin });
        }
        const existing = membershipsMap[editingUser.uid] || [];
        const currentSelection =
          existing.length > 0 ? `${existing[0].schoolId}:${existing[0].role}` : "";
        if (currentSelection !== newUserMembership) {
          await syncMembership(
            editingUser.uid,
            editingUser.email || "",
            existing,
            newUserMembership
          );
        }
        showToast("ユーザーを更新しました", "success");
        setUserModalOpen(false);
        setEditingUser(null);
        await loadAll();
      });
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  const handleDeleteGlobalUser = async (uid: string) => {
    if (!confirm("このユーザーを完全に削除しますか？この操作は取り消せません。"))
      return;
    try {
      await runBusy(
        "ユーザーを削除中...",
        async () => {
          await deleteUserFn({ uid });
          showToast("ユーザーを削除しました", "success");
          await loadAll();
        },
        `user:${uid}`
      );
    } catch (err) {
      showToast("削除エラー: " + (err as Error).message, "error");
    }
  };

  const handleToggleGlobalUserStatus = async (uid: string, currentDisabled: boolean) => {
    try {
      await runBusy(
        currentDisabled ? "ユーザーを有効化中..." : "ユーザーを無効化中...",
        async () => {
          await toggleUserStatusFn({ uid, disabled: !currentDisabled });
          showToast(
            currentDisabled ? "ユーザーを有効にしました" : "ユーザーを無効にしました",
            "success"
          );
          await loadAll();
        },
        `user:${uid}`
      );
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
  };

  const resetUserForm = () => {
    setNewUserEmail("");
    setNewUserDisplayName("");
    setNewUserPassword("");
    setNewUserIsAdmin(false);
    setNewUserMembership("");
    setEditingUser(null);
  };

  if (loading) return <Loading message="学校一覧を読み込み中..." />;

  return (
    <div>
      {busyMessage && <Loading overlay message={busyMessage} />}
      <div className={styles.sectionHeader}>
        <h2>学校一覧</h2>
        <button className="btn btn-primary" onClick={openCreateModal}>
          + 学校を追加
        </button>
      </div>

      {schools.length === 0 ? (
        <p className="empty-text">学校が登録されていません</p>
      ) : (
        <div className={styles.cardList}>
          {schools.map((school) => (
            <div key={school.id} className={styles.card}>
              {busyItems[`school:${school.id}`] && (
                <Loading itemOverlay message={busyItems[`school:${school.id}`]} />
              )}
              <div className={styles.cardBody}>
                <h3>
                  {school.name}
                  <EditIconButton
                    onClick={() => openEditModal(school)}
                    label="学校名・モードを編集"
                  />
                  <span
                    className="badge"
                    style={{
                      marginLeft: 8,
                      fontSize: "0.7rem",
                      background:
                        (school.hierarchyMode || "class") === "department"
                          ? "#f0e8ff"
                          : "#e3f2fd",
                      color:
                        (school.hierarchyMode || "class") === "department"
                          ? "#5a2ea6"
                          : "#1565c0",
                    }}
                  >
                    {(school.hierarchyMode || "class") === "department"
                      ? "学科モード"
                      : "クラスモード"}
                  </span>
                </h3>
                <p className={styles.cardSubtext}>ID: {school.id}</p>
              </div>
              <div className={styles.cardActions}>
                <a
                  href={`/manage/admin.html?school=${school.id}`}
                  className="btn btn-sm btn-primary"
                >
                  管理
                </a>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDelete(school)}
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 全ユーザー管理 */}
      <div style={{ marginTop: 40 }}>
        <div className={styles.sectionHeader}>
          <h2>全ユーザー管理</h2>
          <button
            className="btn btn-primary"
            onClick={() => {
              resetUserForm();
              setUserModalOpen(true);
            }}
          >
            + ユーザー追加
          </button>
        </div>

        {usersLoading ? (
          <Loading message="ユーザーを読み込み中..." />
        ) : globalUsers.length === 0 ? (
          <p className="empty-text">ユーザーがいません</p>
        ) : (
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>メール</th>
                <th>表示名</th>
                <th>所属</th>
                <th>状態</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {globalUsers.map((u) => {
                const memberships = membershipsMap[u.uid] || [];
                const userBusy = busyItems[`user:${u.uid}`];
                return (
                  <tr
                    key={u.uid}
                    style={
                      userBusy
                        ? { opacity: 0.5, pointerEvents: "none" }
                        : undefined
                    }
                  >
                    <td>{u.email}</td>
                    <td>{u.displayName || "-"}</td>
                    <td>
                      {u.isAdmin ? (
                        <span className="badge badge-admin">
                          システム管理者
                        </span>
                      ) : memberships.length > 0 ? (
                        memberships.map((m, i) => (
                          <span
                            key={i}
                            className="badge"
                            style={{
                              background: "#e3f2fd",
                              color: "#1565c0",
                              margin: 2,
                            }}
                          >
                            {m.schoolName} ({ROLE_LABELS[m.role] || m.role})
                          </span>
                        ))
                      ) : (
                        <span style={{ color: "#999" }}>未所属</span>
                      )}
                    </td>
                    <td>
                      {userBusy && (
                        <span style={{ marginRight: 6 }}>
                          <Loading inline message={userBusy} />
                        </span>
                      )}
                      {/* 色のみに依存しない: アイコン(●/○)+テキストで状態を伝える */}
                      <span
                        style={{
                          marginRight: "6px",
                          fontSize: "var(--fs-xs)",
                          color: u.disabled ? "var(--color-alert)" : "var(--color-text)",
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span aria-hidden="true">{u.disabled ? "●" : "○"}</span>
                        {u.disabled ? "停止中" : "有効"}
                      </span>
                      <button
                        className={`btn btn-sm ${u.disabled ? "btn-success" : "btn-danger"}`}
                        onClick={() =>
                          handleToggleGlobalUserStatus(u.uid, !!u.disabled)
                        }
                        style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                      >
                        {u.disabled ? "有効にする" : "無効にする"}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setEditingUser(u);
                            setNewUserDisplayName(u.displayName || "");
                            setNewUserIsAdmin(!!u.isAdmin);
                            const ms = membershipsMap[u.uid] || [];
                            setNewUserMembership(
                              ms.length > 0 ? `${ms[0].schoolId}:${ms[0].role}` : ""
                            );
                            setUserModalOpen(true);
                          }}
                        >
                          編集
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteGlobalUser(u.uid)}
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

      {/* 権限構造ガイド */}
      <div style={{ marginTop: 40 }}>
        <h2>権限構造ガイド</h2>
        <table className={styles.dataTable} style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>ロール</th>
              <th>できること</th>
              <th>アクセスページ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="badge badge-admin">システム管理者</span></td>
              <td>全学校の作成・編集・削除、全ユーザー管理、全クラスのコンテンツ編集</td>
              <td>管理画面、エディター</td>
            </tr>
            <tr>
              <td><span className="badge" style={{ background: "#e3f2fd", color: "#1565c0" }}>学校管理者</span></td>
              <td>自校の学年・クラス管理、メンバー管理、広告・授業時間設定、コンテンツ編集</td>
              <td>管理画面（自校）、エディター</td>
            </tr>
            <tr>
              <td><span className="badge" style={{ background: "#e8f5e9", color: "#2e7d32" }}>教員</span></td>
              <td>自校の全クラスのコンテンツ編集、学校パスワードでもログイン可能</td>
              <td>エディター</td>
            </tr>
            <tr>
              <td><span className="badge" style={{ background: "#fff3e0", color: "#e65100" }}>エディター</span></td>
              <td>担当クラスのコンテンツ編集（簡易ログイン）</td>
              <td>エディター</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 学校作成/編集モーダル */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSchool ? "学校を編集" : "学校を追加"}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setModalOpen(false)}
            >
              キャンセル
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </>
        }
      >
        {!editingSchool && (
          <p style={{ color: "#888", fontSize: "0.8rem", marginBottom: 12 }}>
            学校IDは自動で発行されます。
          </p>
        )}
        <div className="form-group">
          <label>学校名</label>
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="例: 技能短期大学校"
          />
        </div>
        <div className="form-group">
          <label>階層モード</label>
          <select
            value={formMode}
            onChange={(e) => setFormMode(e.target.value as HierarchyMode)}
          >
            <option value="class">クラスモード（学年 &gt; クラス）</option>
            <option value="department">
              学科モード（学年 &gt; 学科 &gt; クラス）
            </option>
          </select>
          <p style={{ color: "#888", fontSize: "0.8rem", marginTop: 4 }}>
            {editingSchool
              ? "切替には学校直下の学年・クラスを整理する必要があります。"
              : "階層モードの切替はシステム管理者のみ、この画面から行えます。"}
          </p>
        </div>
      </Modal>

      {/* ユーザー作成/編集モーダル */}
      <Modal
        isOpen={userModalOpen}
        onClose={() => {
          setUserModalOpen(false);
          resetUserForm();
        }}
        title={editingUser ? "ユーザーを編集" : "ユーザーを追加"}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setUserModalOpen(false);
                resetUserForm();
              }}
            >
              キャンセル
            </button>
            <button
              className="btn btn-primary"
              onClick={editingUser ? handleUpdateGlobalUser : handleCreateUser}
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
          <label>所属</label>
          <select
            value={newUserMembership}
            onChange={(e) => setNewUserMembership(e.target.value)}
            disabled={newUserIsAdmin}
          >
            <option value="">未所属</option>
            {schools.flatMap((s) =>
              Object.entries(ROLE_LABELS).map(([role, label]) => (
                <option key={`${s.id}:${role}`} value={`${s.id}:${role}`}>
                  {s.name} / {label}
                </option>
              ))
            )}
          </select>
          {newUserIsAdmin && (
            <p style={{ color: "#888", fontSize: "0.8rem", marginTop: 4 }}>
              システム管理者は所属設定の対象外です。
            </p>
          )}
        </div>
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
    </div>
  );
}
