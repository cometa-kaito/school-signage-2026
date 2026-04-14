"use client";

import { useState, useEffect } from "react";
import {
  listSchoolsFn,
  createSchoolFn,
  updateSchoolFn,
  deleteSchoolFn,
  listUsersFn,
  listMembersFn,
  deleteUserFn,
  createAdminUserFn,
  setAdminRoleFn,
  updateUserFn,
  toggleUserStatusFn,
} from "@/lib/firebase-functions";
import { Modal } from "@/components/ui/Modal";
import { Loading } from "@/components/ui/Loading";
import { useToast } from "@/components/ui/Toast";
import type { School } from "@/types/school";
import type { UserInfo, Membership } from "@/types/auth";
import styles from "@/styles/admin.module.css";
import Link from "next/link";

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
  const { showToast } = useToast();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [saving, setSaving] = useState(false);

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

  const loadSchools = async () => {
    setLoading(true);
    try {
      const res = await listSchoolsFn();
      setSchools(res.data.schools || []);
    } catch {
      showToast("学校一覧の取得に失敗しました", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSchools();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreateModal = () => {
    setEditingSchool(null);
    setFormId("");
    setFormName("");
    setModalOpen(true);
  };

  const openEditModal = (school: School) => {
    setEditingSchool(school);
    setFormId(school.id);
    setFormName(school.name);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formId.trim() || !formName.trim()) return;
    setSaving(true);
    try {
      if (editingSchool) {
        await updateSchoolFn({ id: editingSchool.id, name: formName });
        showToast("学校を更新しました", "success");
      } else {
        await createSchoolFn({ id: formId, name: formName });
        showToast("学校を作成しました", "success");
      }
      setModalOpen(false);
      loadSchools();
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  const handleDelete = async (school: School) => {
    if (!confirm(`「${school.name}」を削除しますか？`)) return;
    try {
      await deleteSchoolFn({ id: school.id });
      showToast("学校を削除しました", "success");
      loadSchools();
    } catch (err) {
      showToast("削除エラー: " + (err as Error).message, "error");
    }
  };

  // Load global users
  const loadGlobalUsers = async (schoolList: School[]) => {
    setUsersLoading(true);
    try {
      const usersRes = await listUsersFn();
      const allUsers = (usersRes.data.users || []).filter(
        (u) => !u.email?.endsWith("@signage.local")
      );
      setGlobalUsers(allUsers);

      const msMap: Record<string, SchoolMembership[]> = {};
      await Promise.all(
        schoolList.map(async (school) => {
          try {
            const r = await listMembersFn({ schoolId: school.id });
            const members = r.data.members || [];
            members.forEach((m) => {
              if (!msMap[m.userId]) msMap[m.userId] = [];
              msMap[m.userId].push({
                schoolId: school.id,
                schoolName: school.name || school.id,
                role: m.role,
              });
            });
          } catch {
            // ignore
          }
        })
      );
      setMembershipsMap(msMap);
    } catch (err) {
      showToast("ユーザー読み込みエラー: " + (err as Error).message, "error");
    }
    setUsersLoading(false);
  };

  useEffect(() => {
    if (schools.length > 0) {
      loadGlobalUsers(schools);
    }
  }, [schools]); // eslint-disable-line react-hooks/exhaustive-deps

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
      resetUserForm();
      loadGlobalUsers(schools);
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  const handleUpdateGlobalUser = async () => {
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
      setUserModalOpen(false);
      setEditingUser(null);
      loadGlobalUsers(schools);
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  const handleDeleteGlobalUser = async (uid: string) => {
    if (!confirm("このユーザーを完全に削除しますか？この操作は取り消せません。"))
      return;
    try {
      await deleteUserFn({ uid });
      showToast("ユーザーを削除しました", "success");
      loadGlobalUsers(schools);
    } catch (err) {
      showToast("削除エラー: " + (err as Error).message, "error");
    }
  };

  const handleToggleGlobalUserStatus = async (uid: string, currentDisabled: boolean) => {
    try {
      await toggleUserStatusFn({ uid, disabled: !currentDisabled });
      showToast(
        currentDisabled ? "ユーザーを有効にしました" : "ユーザーを無効にしました",
        "success"
      );
      loadGlobalUsers(schools);
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
  };

  const resetUserForm = () => {
    setNewUserEmail("");
    setNewUserDisplayName("");
    setNewUserPassword("");
    setNewUserIsAdmin(false);
    setEditingUser(null);
  };

  if (loading) return <Loading message="学校一覧を読み込み中..." />;

  return (
    <div>
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
              <div className={styles.cardBody}>
                <h3>{school.name}</h3>
                <p className={styles.cardSubtext}>ID: {school.id}</p>
              </div>
              <div className={styles.cardActions}>
                <Link
                  href={`/manage/admin?school=${school.id}`}
                  className="btn btn-sm btn-primary"
                >
                  管理
                </Link>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => openEditModal(school)}
                >
                  編集
                </button>
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
                return (
                  <tr key={u.uid}>
                    <td>{u.email}</td>
                    <td>{u.displayName || "-"}</td>
                    <td>
                      {u.customClaims?.admin ? (
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
                      <button
                        className={`btn btn-sm ${u.disabled ? "btn-secondary" : ""}`}
                        onClick={() =>
                          handleToggleGlobalUserStatus(u.uid, !!u.disabled)
                        }
                        style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                      >
                        {u.disabled ? "無効 → 有効" : "有効 → 無効"}
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
          <div className="form-group">
            <label>学校ID</label>
            <input
              type="text"
              value={formId}
              onChange={(e) => setFormId(e.target.value)}
              placeholder="例: gn_tech"
            />
          </div>
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
