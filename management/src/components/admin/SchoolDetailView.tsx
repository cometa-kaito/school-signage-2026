"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getSchoolDetailFn,
  listGradesFn,
  createGradeFn,
  updateGradeFn,
  deleteGradeFn,
  listClassesFn,
  createClassFn,
  updateClassFn,
  deleteClassFn,
  createDepartmentFn,
  listDepartmentsFn,
  updateDepartmentFn,
  deleteDepartmentFn,
  setSchoolHierarchyModeFn,
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
import { schoolDocRef, classDocRef } from "@/lib/paths";
import { AdManager } from "@/components/class-settings/AdManager";
import { QuietHoursConfig } from "@/components/class-settings/QuietHoursConfig";
import { QuietHoursEditor } from "@/components/admin/QuietHoursEditor";
import { EditIconButton } from "@/components/ui/EditIconButton";
import {
  departmentConfigRef,
  gradeConfigRef,
} from "@/lib/paths";
import { HierarchicalAdsTab } from "./HierarchicalAdsTab";
import { Modal } from "@/components/ui/Modal";
import { Loading } from "@/components/ui/Loading";
import { useToast } from "@/components/ui/Toast";
import type {
  Grade,
  Class,
  Department,
  Device,
  HierarchyMode,
} from "@/types/school";
import type { Membership, UserInfo } from "@/types/auth";
import styles from "@/styles/admin.module.css";
import { useRouter } from "next/navigation";

interface SchoolDetailViewProps {
  schoolId: string;
  isSystemAdmin: boolean;
}

export function SchoolDetailView({
  schoolId,
  isSystemAdmin,
}: SchoolDetailViewProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [schoolName, setSchoolName] = useState("");
  const [hierarchyMode, setHierarchyMode] = useState<HierarchyMode>("class");
  const [activeTab, setActiveTab] = useState<
    "grades" | "departments" | "devices" | "users" | "ads" | "settings"
  >("grades");
  const [loading, setLoading] = useState(true);

  // クラスモード: { [gradeId]: Class[] }
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classesMap, setClassesMap] = useState<Record<string, Class[]>>({});
  // 学科モード: 学校直下 departments, { [deptId]: Grade[] }, { [deptId]: { [gradeId]: Class[] } }
  const [departments, setDepartments] = useState<Department[]>([]);
  const [gradesByDept, setGradesByDept] = useState<
    Record<string, Grade[]>
  >({});
  const [classesByDeptGrade, setClassesByDeptGrade] = useState<
    Record<string, Record<string, Class[]>>
  >({});

  const [expandedGrade, setExpandedGrade] = useState<string | null>(null);
  const [expandedDepartment, setExpandedDepartment] = useState<string | null>(
    null
  );
  const [expandedDeptGrade, setExpandedDeptGrade] = useState<string | null>(
    null
  );

  // Departments modal
  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(
    null
  );
  const [newDepartmentName, setNewDepartmentName] = useState("");

  // モード切替モーダル
  const [modeModalOpen, setModeModalOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<HierarchyMode>("class");
  const [modeSwitchBlockers, setModeSwitchBlockers] = useState<
    Array<{
      gradeName?: string;
      departmentName?: string;
      className?: string;
    }>
  >([]);

  // クラス編集/作成時の context
  const [targetDepartmentIdForClass, setTargetDepartmentIdForClass] =
    useState<string | null>(null);
  const [targetDepartmentIdForGrade, setTargetDepartmentIdForGrade] =
    useState<string | null>(null);

  // Members
  const [members, setMembers] = useState<Membership[]>([]);

  // Devices
  const [devices, setDevices] = useState<Device[]>([]);

  // Users (system admin only)
  const [users, setUsers] = useState<UserInfo[]>([]);

  // Class URL expansion
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

  // Inline class settings
  const [settingsClassKey, setSettingsClassKey] = useState<string | null>(null); // "gradeId:classId"
  const [settingsAds, setSettingsAds] = useState<{ id: string; type: "image" | "video"; url: string; link_url?: string; duration_sec?: number }[]>([]);
  const [settingsQuietHours, setSettingsQuietHours] = useState<{ start: string; end: string }[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(false);

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
  const [editClassDepartmentId, setEditClassDepartmentId] = useState<
    string | null
  >(null);
  const [editClassId, setEditClassId] = useState("");
  const [editClassName, setEditClassName] = useState("");
  const [targetDepartmentId, setTargetDepartmentId] = useState<string | null>(
    null
  );

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

  const sortGrades = (list: Grade[]) =>
    [...list].sort((a, b) => a.name.localeCompare(b.name, "ja"));

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await getSchoolDetailFn({ schoolId, includeUsers: isSystemAdmin });
        const d = res.data;
        setSchoolName(d.schoolName);
        setHierarchyMode(d.hierarchyMode || "class");
        setGrades(sortGrades(d.grades || []));
        setClassesMap(d.classesMap || {});
        setDepartments(d.departments || []);
        setGradesByDept(d.gradesByDept || {});
        setClassesByDeptGrade(d.classesByDeptGrade || {});
        setMembers(d.members || []);
        if (isSystemAdmin) {
          setUsers(d.users || []);
        }
        if (d.editorPassword) {
          setEditorPassword(d.editorPassword);
        }
        if (d.quietHours) {
          setSchoolQuietHours(d.quietHours);
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
      await createGradeFn({
        schoolId,
        departmentId: targetDepartmentIdForGrade,
        name: newGradeName,
      });
      showToast("学年を作成しました", "success");
      setGradeModalOpen(false);
      setNewGradeName("");
      if (targetDepartmentIdForGrade) {
        await refreshGradesInDept(targetDepartmentIdForGrade);
      } else {
        const res = await listGradesFn({ schoolId });
        setGrades(sortGrades(res.data.grades || []));
      }
      setTargetDepartmentIdForGrade(null);
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  const handleDeleteGrade = async (
    gradeId: string,
    departmentId: string | null = null
  ) => {
    if (!confirm("この学年を削除しますか？")) return;
    try {
      await deleteGradeFn({ schoolId, gradeId, departmentId });
      showToast("学年を削除しました", "success");
      if (departmentId) {
        await refreshGradesInDept(departmentId);
      } else {
        const res = await listGradesFn({ schoolId });
        setGrades(sortGrades(res.data.grades || []));
      }
    } catch (err) {
      showToast("削除エラー: " + (err as Error).message, "error");
    }
  };

  const handleRenameGrade = async () => {
    if (!editGradeName.trim() || !editGradeId) return;
    setSaving(true);
    try {
      await updateGradeFn({
        schoolId,
        gradeId: editGradeId,
        departmentId: targetDepartmentIdForClass,
        name: editGradeName,
      });
      showToast("学年名を変更しました", "success");
      setEditGradeModalOpen(false);
      if (targetDepartmentIdForClass) {
        await refreshGradesInDept(targetDepartmentIdForClass);
      } else {
        const res = await listGradesFn({ schoolId });
        setGrades(sortGrades(res.data.grades || []));
      }
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
        departmentId: editClassDepartmentId,
        classId: editClassId,
        name: editClassName,
      });
      showToast("クラス名を変更しました", "success");
      setEditClassModalOpen(false);
      if (editClassDepartmentId) {
        await refreshClassesInDeptGrade(editClassDepartmentId!, editClassGradeId);
      } else {
        const res = await listClassesFn({
          schoolId,
          gradeId: editClassGradeId,
        });
        setClassesMap((prev) => ({
          ...prev,
          [editClassGradeId]: res.data.classes || [],
        }));
      }
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
        departmentId: targetDepartmentId,
        name: newClassName,
      });
      showToast("クラスを作成しました", "success");
      setClassModalOpen(false);
      setNewClassName("");
      if (targetDepartmentId) {
        await refreshClassesInDeptGrade(targetDepartmentId!, targetGradeId);
      } else {
        const res = await listClassesFn({
          schoolId,
          gradeId: targetGradeId,
        });
        setClassesMap((prev) => ({
          ...prev,
          [targetGradeId]: res.data.classes || [],
        }));
      }
      setTargetDepartmentId(null);
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  const refreshDepartments = async () => {
    const res = await listDepartmentsFn({ schoolId });
    setDepartments(res.data.departments || []);
  };

  const refreshGradesInDept = async (departmentId: string) => {
    const r = await listGradesFn({ schoolId, departmentId });
    setGradesByDept((prev) => ({
      ...prev,
      [departmentId]: r.data.grades || [],
    }));
  };

  const refreshClassesInDeptGrade = async (
    departmentId: string,
    gradeId: string
  ) => {
    const r = await listClassesFn({ schoolId, gradeId, departmentId });
    setClassesByDeptGrade((prev) => ({
      ...prev,
      [departmentId]: {
        ...(prev[departmentId] || {}),
        [gradeId]: r.data.classes || [],
      },
    }));
  };

  const handleSaveDepartment = async () => {
    if (!newDepartmentName.trim()) return;
    setSaving(true);
    try {
      if (editingDepartmentId) {
        await updateDepartmentFn({
          schoolId,
          departmentId: editingDepartmentId,
          name: newDepartmentName,
        });
        showToast("学科を更新しました", "success");
      } else {
        await createDepartmentFn({
          schoolId,
          name: newDepartmentName,
          order: departments.length,
        });
        showToast("学科を作成しました", "success");
      }
      setDepartmentModalOpen(false);
      setNewDepartmentName("");
      setEditingDepartmentId(null);
      await refreshDepartments();
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
    }
    setSaving(false);
  };

  const handleDeleteDepartment = async (departmentId: string) => {
    if (!confirm("この学科を削除しますか？配下に学年が残っている場合は拒否されます。"))
      return;
    try {
      await deleteDepartmentFn({ schoolId, departmentId });
      showToast("学科を削除しました", "success");
      await refreshDepartments();
    } catch (err) {
      showToast("削除エラー: " + (err as Error).message, "error");
    }
  };

  const openModeModal = (target: HierarchyMode) => {
    setPendingMode(target);
    setModeSwitchBlockers([]);
    setModeModalOpen(true);
  };

  const handleConfirmModeSwitch = async () => {
    setSaving(true);
    try {
      const res = await setSchoolHierarchyModeFn({
        schoolId,
        mode: pendingMode,
      });
      showToast(res.data.message, "success");
      setModeModalOpen(false);
      setHierarchyMode(res.data.mode);
      // データ再取得
      const d = (await getSchoolDetailFn({ schoolId, includeUsers: isSystemAdmin })).data;
      setGrades(sortGrades(d.grades || []));
      setClassesMap(d.classesMap || {});
      setDepartments(d.departments || []);
      setGradesByDept(d.gradesByDept || {});
      setClassesByDeptGrade(d.classesByDeptGrade || {});
    } catch (err) {
      const e = err as { details?: { blockers?: typeof modeSwitchBlockers }; message?: string };
      if (e.details && e.details.blockers) {
        setModeSwitchBlockers(e.details.blockers);
      }
      showToast("切替エラー: " + (e.message || ""), "error");
    }
    setSaving(false);
  };

  const handleDeleteClass = async (
    gradeId: string,
    classId: string,
    departmentId: string | null = null
  ) => {
    if (!confirm("このクラスを削除しますか？")) return;
    try {
      await deleteClassFn({ schoolId, gradeId, classId, departmentId });
      showToast("クラスを削除しました", "success");
      if (departmentId) {
        await refreshClassesInDeptGrade(departmentId, gradeId);
        return;
      }
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

  // メンバーロール変更（既存メンバーのロール更新）
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

  // ユーザーに対してこの学校でのロールを設定（未所属なら招待、既存なら更新、"none"なら削除）
  const handleSetUserRole = async (
    user: UserInfo,
    existingMembership: Membership | undefined,
    newRole: string
  ) => {
    try {
      if (newRole === "none") {
        if (!existingMembership) return;
        await removeMemberFn({ userId: user.uid, schoolId });
        showToast("この学校から外しました", "success");
      } else if (existingMembership) {
        await updateMembershipFn({
          userId: user.uid,
          schoolId,
          role: newRole,
        });
        showToast("ロールを変更しました", "success");
      } else {
        if (!user.email) {
          showToast("メールアドレスがありません", "error");
          return;
        }
        await inviteMemberFn({
          email: user.email,
          schoolId,
          role: newRole,
        });
        showToast("この学校に追加しました", "success");
      }
      const res = await listMembersFn({ schoolId });
      setMembers(res.data.members || []);
    } catch (err) {
      showToast("エラー: " + (err as Error).message, "error");
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
      setGrades(sortGrades(res.data.grades || []));
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
      const wasAdmin = editingUser.isAdmin ?? false;
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
      showToast("音声オフ設定を保存しました", "success");
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

  const toggleClassSettings = useCallback(async (
    gradeId: string,
    classId: string,
    departmentId: string | null = null
  ) => {
    const key = departmentId
      ? `${gradeId}:${departmentId}:${classId}`
      : `${gradeId}:${classId}`;
    if (settingsClassKey === key) {
      setSettingsClassKey(null);
      return;
    }
    setSettingsClassKey(key);
    setSettingsLoading(true);
    try {
      const classSnap = await getDoc(
        classDocRef(schoolId, gradeId, classId, departmentId)
      );
      if (classSnap.exists()) {
        const settings = classSnap.data().displaySettings || {};
        setSettingsAds(settings.ads || []);
        setSettingsQuietHours(settings.quiet_hours || []);
      } else {
        setSettingsAds([]);
        setSettingsQuietHours([]);
      }
    } catch (err) {
      showToast("設定の読み込みに失敗: " + (err as Error).message, "error");
      setSettingsClassKey(null);
    }
    setSettingsLoading(false);
  }, [schoolId, settingsClassKey, showToast]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => showToast("コピーしました", "success"),
      () => showToast("コピーに失敗しました", "error")
    );
  };

  if (loading) return <Loading message="学校情報を読み込み中..." />;

  const isDeptMode = hierarchyMode === "department";

  const tabs = [
    {
      key: "grades" as const,
      label: isDeptMode ? "学年・学科・クラス" : "学年・クラス",
    },
    ...(isDeptMode
      ? [{ key: "departments" as const, label: "学科" }]
      : []),
    { key: "users" as const, label: "ユーザー" },
    { key: "ads" as const, label: "広告" },
    // { key: "devices" as const, label: "端末" },
    { key: "settings" as const, label: "設定" },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h2 className={styles.schoolTitle} style={{ margin: 0 }}>
          {schoolName}
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className="badge"
            style={{
              background: isDeptMode ? "#f0e8ff" : "#e3f2fd",
              color: isDeptMode ? "#5a2ea6" : "#1565c0",
            }}
          >
            階層モード: {isDeptMode ? "学科モード" : "クラスモード"}
          </span>
        </div>
      </div>

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
      {activeTab === "grades" && (() => {
        const renderClassCard = (
          gradeId: string,
          cls: Class,
          departmentId: string | null
        ) => {
          const origin =
            typeof window !== "undefined" ? window.location.origin : "";
          const deptParam = departmentId ? `&department=${departmentId}` : "";
          const signageUrl = `${origin}/?school=${schoolId}&grade=${gradeId}${deptParam}&class=${cls.id}&kiosk=1`;
          const editorUrl = `${origin}/manage/editor?school=${schoolId}&grade=${gradeId}${deptParam}&class=${cls.id}`;
          const mobileEditorUrl = `${origin}/manage/editor-mobile?school=${schoolId}&grade=${gradeId}${deptParam}&class=${cls.id}`;
          const settingsUrl = `${origin}/manage/class-settings?school=${schoolId}&grade=${gradeId}${deptParam}&class=${cls.id}`;
          const settingsKey = departmentId
            ? `${departmentId}:${gradeId}:${cls.id}`
            : `${gradeId}:${cls.id}`;
          const isExpanded = expandedClassId === settingsKey;
          return (
            <div key={settingsKey} className={styles.classCard}>
              <div className={styles.classItem}>
                <span
                  className={styles.className}
                  style={{ display: "inline-flex", alignItems: "center" }}
                >
                  <span
                    onClick={() =>
                      setExpandedClassId(isExpanded ? null : settingsKey)
                    }
                    style={{ cursor: "pointer" }}
                  >
                    {isExpanded ? "▼" : "▶"} {cls.name}
                  </span>
                  <EditIconButton
                    onClick={() => {
                      setEditClassGradeId(gradeId);
                      setEditClassDepartmentId(departmentId);
                      setEditClassId(cls.id);
                      setEditClassName(cls.name);
                      setEditClassModalOpen(true);
                    }}
                    label="クラス名を変更"
                  />
                </span>
                <div className={styles.classActions}>
                  <div className={styles.classLinks}>
                    <a
                      href={signageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${styles.linkBtn} ${styles.linkSignage}`}
                    >
                      サイネージ
                    </a>
                    <a
                      href={editorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${styles.linkBtn} ${styles.linkEditor}`}
                    >
                      PC編集
                    </a>
                    <a
                      href={mobileEditorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${styles.linkBtn} ${styles.linkMobile}`}
                    >
                      スマホ編集
                    </a>
                    <button
                      className={`${styles.linkBtn} ${styles.linkSettings} ${settingsClassKey === settingsKey ? styles.linkSettingsActive : ""}`}
                      onClick={() =>
                        toggleClassSettings(gradeId, cls.id, departmentId)
                      }
                    >
                      {settingsClassKey === settingsKey ? "▼ 設定" : "設定"}
                    </button>
                  </div>
                  <div className={styles.classManage}>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() =>
                        handleDeleteClass(gradeId, cls.id, departmentId)
                      }
                    >
                      削除
                    </button>
                  </div>
                </div>
              </div>
              {isExpanded && (
                <div className={styles.urlSection}>
                  {[
                    { label: "サイネージ", url: signageUrl },
                    { label: "PC編集", url: editorUrl },
                    { label: "スマホ編集", url: mobileEditorUrl },
                    { label: "設定", url: settingsUrl },
                  ].map((row) => (
                    <div key={row.label} className={styles.urlRow}>
                      <span className={styles.urlLabel}>{row.label}:</span>
                      <input
                        type="text"
                        readOnly
                        value={row.url}
                        className={styles.urlInput}
                      />
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                      >
                        開く
                      </a>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => copyToClipboard(row.url)}
                      >
                        コピー
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {settingsClassKey === settingsKey && (
                <div className={styles.inlineSettings}>
                  {settingsLoading ? (
                    <Loading message="設定を読み込み中..." />
                  ) : (
                    <>
                      <AdManager
                        docRef={classDocRef(
                          schoolId,
                          gradeId,
                          cls.id,
                          departmentId
                        )}
                        ads={settingsAds}
                        onAdsChange={setSettingsAds}
                      />
                      <QuietHoursConfig
                        schoolId={schoolId}
                        gradeId={gradeId}
                        classId={cls.id}
                        quietHours={settingsQuietHours}
                        onQuietHoursChange={setSettingsQuietHours}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          );
        };

        const renderGradeCard = (
          grade: Grade,
          departmentId: string | null,
          classes: Class[]
        ) => {
          const gKey = departmentId ? `${departmentId}:${grade.id}` : grade.id;
          const expanded = departmentId
            ? expandedDeptGrade === gKey
            : expandedGrade === grade.id;
          const toggle = () => {
            if (departmentId) setExpandedDeptGrade(expanded ? null : gKey);
            else setExpandedGrade(expanded ? null : grade.id);
          };
          return (
            <div
              key={gKey}
              className={styles.gradeCard}
              style={departmentId ? { margin: "6px 0" } : undefined}
            >
              <div
                className={styles.gradeHeader}
                onClick={toggle}
                style={departmentId ? { background: "#f0f8ff" } : undefined}
              >
                <span className={styles.gradeToggle}>
                  {expanded ? "▼" : "▶"}
                </span>
                <strong>{grade.name}</strong>
                <EditIconButton
                  onClick={() => {
                    setEditGradeId(grade.id);
                    setEditGradeName(grade.name);
                    setEditGradeModalOpen(true);
                    setTargetDepartmentIdForClass(departmentId);
                  }}
                  label="学年名を変更"
                />
                <span className={styles.classBadge}>
                  {classes.length}クラス
                </span>
                <div
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    gap: "4px",
                  }}
                >
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteGrade(grade.id, departmentId);
                    }}
                  >
                    削除
                  </button>
                </div>
              </div>
              {expanded && (
                <div className={styles.classesContainer}>
                  {classes.map((cls) =>
                    renderClassCard(grade.id, cls, departmentId)
                  )}
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      setTargetGradeId(grade.id);
                      setTargetDepartmentId(departmentId);
                      setClassModalOpen(true);
                    }}
                  >
                    + クラス追加
                  </button>
                </div>
              )}
            </div>
          );
        };

        return (
          <div>
            <div className={styles.sectionHeader}>
              <h3>
                {isDeptMode ? "学科 > 学年 > クラス" : "学年・クラス"}
              </h3>
              {!isDeptMode && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setTargetDepartmentIdForGrade(null);
                    setGradeModalOpen(true);
                  }}
                >
                  + 学年追加
                </button>
              )}
              {isDeptMode && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setEditingDepartmentId(null);
                    setNewDepartmentName("");
                    setDepartmentModalOpen(true);
                  }}
                >
                  + 学科追加
                </button>
              )}
            </div>

            {!isDeptMode && (
              <>
                {grades.length === 0 ? (
                  <p className="empty-text">学年が登録されていません</p>
                ) : (
                  grades.map((grade) =>
                    renderGradeCard(grade, null, classesMap[grade.id] || [])
                  )
                )}
              </>
            )}

            {isDeptMode && (
              <>
                {departments.length === 0 ? (
                  <p className="empty-text">
                    学科が登録されていません。「+ 学科追加」で作成してください。
                  </p>
                ) : (
                  departments.map((dept) => {
                    const dExpanded = expandedDepartment === dept.id;
                    const dGrades = gradesByDept[dept.id] || [];
                    return (
                      <div key={dept.id} className={styles.gradeCard}>
                        <div
                          className={styles.gradeHeader}
                          style={{ background: "#faf5ff" }}
                          onClick={() =>
                            setExpandedDepartment(dExpanded ? null : dept.id)
                          }
                        >
                          <span className={styles.gradeToggle}>
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
                          <div
                            style={{
                              marginLeft: "auto",
                              display: "flex",
                              gap: "4px",
                            }}
                          >
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingDepartmentId(dept.id);
                                setNewDepartmentName(dept.name);
                                setDepartmentModalOpen(true);
                              }}
                            >
                              編集
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDepartment(dept.id);
                              }}
                            >
                              削除
                            </button>
                          </div>
                        </div>
                        {dExpanded && (
                          <div className={styles.classesContainer}>
                            {dGrades.length === 0 ? (
                              <p className="empty-text">学年がありません。</p>
                            ) : (
                              dGrades.map((grade) =>
                                renderGradeCard(
                                  grade,
                                  dept.id,
                                  classesByDeptGrade[dept.id]?.[grade.id] ||
                                    []
                                )
                              )
                            )}
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => {
                                setTargetDepartmentIdForGrade(dept.id);
                                setGradeModalOpen(true);
                              }}
                            >
                              + 学年追加
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        );
      })()}


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

      {/* 学科 */}
      {activeTab === "departments" && isDeptMode && (
        <div>
          <div className={styles.sectionHeader}>
            <h3>学科一覧</h3>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditingDepartmentId(null);
                setNewDepartmentName("");
                setDepartmentModalOpen(true);
              }}
            >
              + 学科追加
            </button>
          </div>
          <p className={styles.sectionLead}>
            学科マスターで追加したコンテンツ・広告は、その学科配下の全学年・全クラスに自動反映されます。
          </p>
          {departments.length === 0 ? (
            <p className="empty-text">学科が登録されていません</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>学科名</th>
                  <th>学年数</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => {
                  const g = gradesByDept[d.id] || [];
                  return (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.name}</strong>
                        <EditIconButton
                          onClick={() => {
                            setEditingDepartmentId(d.id);
                            setNewDepartmentName(d.name);
                            setDepartmentModalOpen(true);
                          }}
                          label="学科名を変更"
                        />
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{ background: "#f0e8ff", color: "#5a2ea6" }}
                        >
                          {g.length}学年
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteDepartment(d.id)}
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ユーザー（ロール管理統合） */}
      {activeTab === "users" && (() => {
        const membershipByUid: Record<string, Membership> = {};
        members.forEach((m) => {
          if (m.userId) membershipByUid[m.userId] = m;
        });

        // system_admin: 全ユーザー表示 / 非system_admin: この学校のメンバーのみ表示
        const filteredUsers = isSystemAdmin
          ? users.filter((u) => !(u.email || "").endsWith("@signage.local"))
          : users.filter(
              (u) =>
                !(u.email || "").endsWith("@signage.local") &&
                membershipByUid[u.uid]
            );
        // listUsers が system_admin 専用なので、非system_admin のときは members から作る
        const displayRows = isSystemAdmin
          ? filteredUsers.map((u) => ({
              uid: u.uid,
              email: u.email,
              displayName: u.displayName,
              disabled: u.disabled,
              isAdmin: u.isAdmin,
              membership: membershipByUid[u.uid],
            }))
          : members
              .filter(
                (m) =>
                  !(m.email || "").endsWith("@signage.local") &&
                  !m.isAdmin
              )
              .map((m) => ({
                uid: m.userId,
                email: m.email || null,
                displayName: m.displayName || null,
                disabled: false,
                isAdmin: false,
                membership: m,
              }));

        return (
          <div>
            <div className={styles.sectionHeader}>
              <h3>ユーザー</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setNewMemberEmail("");
                    setNewMemberRole("teacher");
                    setMemberModalOpen(true);
                  }}
                >
                  + メールで招待
                </button>
                {isSystemAdmin && (
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
                )}
              </div>
            </div>
            {displayRows.length === 0 ? (
              <p className="empty-text">
                {isSystemAdmin
                  ? "ユーザーがいません"
                  : "メンバーがいません"}
              </p>
            ) : (
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>メール</th>
                    <th>表示名</th>
                    <th>この学校のロール</th>
                    {isSystemAdmin && <th>全体</th>}
                    {isSystemAdmin && <th>状態</th>}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => {
                    const m = row.membership;
                    const currentRole = m ? m.role : "none";
                    return (
                      <tr key={row.uid}>
                        <td>{row.email || row.uid}</td>
                        <td>{row.displayName || "-"}</td>
                        <td>
                          {row.isAdmin ? (
                            <span
                              className="badge"
                              style={{ background: "#f0e8ff", color: "#5a2ea6" }}
                              title="システム管理者は全学校にアクセス可能"
                            >
                              —（システム管理者）
                            </span>
                          ) : (
                            <select
                              className={styles.roleSelect}
                              value={currentRole}
                              onChange={(e) => {
                                if (isSystemAdmin) {
                                  handleSetUserRole(
                                    {
                                      uid: row.uid,
                                      email: row.email,
                                      displayName: row.displayName,
                                      disabled: row.disabled,
                                      isAdmin: row.isAdmin,
                                    },
                                    m,
                                    e.target.value
                                  );
                                } else {
                                  // school_admin: メンバーのロール更新のみ
                                  if (e.target.value === "none") {
                                    handleRemoveMember(row.uid);
                                  } else {
                                    handleUpdateMemberRole(
                                      row.uid,
                                      e.target.value
                                    );
                                  }
                                }
                              }}
                            >
                              <option value="none">未所属</option>
                              <option value="school_admin">学校管理者</option>
                              <option value="teacher">教員</option>
                              <option value="editor">エディター</option>
                            </select>
                          )}
                        </td>
                        {isSystemAdmin && (
                          <td>
                            {row.isAdmin ? (
                              <span className="badge badge-admin">管理者</span>
                            ) : (
                              <span className="badge badge-user">一般</span>
                            )}
                          </td>
                        )}
                        {isSystemAdmin && (
                          <td>
                            <span
                              style={{
                                marginRight: "6px",
                                fontSize: "0.75rem",
                                color: row.disabled ? "#dc3545" : "#28a745",
                              }}
                            >
                              {row.disabled ? "無効" : "有効"}
                            </span>
                            <button
                              className={`btn btn-sm ${row.disabled ? "btn-success" : "btn-danger"}`}
                              onClick={() =>
                                handleToggleUserStatus(row.uid, !!row.disabled)
                              }
                              style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                            >
                              {row.disabled ? "有効にする" : "無効にする"}
                            </button>
                          </td>
                        )}
                        <td>
                          <div style={{ display: "flex", gap: "4px" }}>
                            {isSystemAdmin && (
                              <>
                                <button
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => {
                                    setEditingUser({
                                      uid: row.uid,
                                      email: row.email,
                                      displayName: row.displayName,
                                      disabled: row.disabled,
                                      isAdmin: row.isAdmin,
                                    });
                                    setNewUserDisplayName(row.displayName || "");
                                    setNewUserIsAdmin(!!row.isAdmin);
                                    setUserModalOpen(true);
                                  }}
                                >
                                  編集
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleDeleteUser(row.uid)}
                                >
                                  削除
                                </button>
                              </>
                            )}
                            {!isSystemAdmin && m && (
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleRemoveMember(row.uid)}
                              >
                                外す
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })()}

      {/* 広告 */}
      {activeTab === "ads" && (
        <HierarchicalAdsTab
          schoolId={schoolId}
          hierarchyMode={hierarchyMode}
          grades={grades}
          classesMap={classesMap}
          departments={departments}
          gradesByDept={gradesByDept}
          classesByDeptGrade={classesByDeptGrade}
        />
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
            <h3>学校マスター 音声オフ</h3>
            <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: 12 }}>
              クラス・学年・学科のいずれにも個別設定がない場合に適用されるデフォルト設定です。
              この時間帯は広告が非表示になります。
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

          {isDeptMode && departments.length > 0 && (
            <div className={styles.settingCard} style={{ marginTop: 20 }}>
              <h3>学科マスター 音声オフ</h3>
              <p
                style={{
                  color: "#888",
                  fontSize: "0.85rem",
                  marginBottom: 12,
                }}
              >
                学科ごとのマスター設定。学年・クラスに設定がないときに適用されます。
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {departments.map((d) => (
                  <QuietHoursEditor
                    key={d.id}
                    docRef={departmentConfigRef(
                      schoolId,
                      d.id,
                      "display_settings"
                    )}
                    title={d.name}
                  />
                ))}
              </div>
            </div>
          )}

          {((isDeptMode &&
            departments.some(
              (d) => (gradesByDept[d.id] || []).length > 0
            )) ||
            (!isDeptMode && grades.length > 0)) && (
            <div className={styles.settingCard} style={{ marginTop: 20 }}>
              <h3>学年マスター 音声オフ</h3>
              <p
                style={{
                  color: "#888",
                  fontSize: "0.85rem",
                  marginBottom: 12,
                }}
              >
                学年ごとのマスター設定。クラスに設定がないときに適用されます。
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {isDeptMode
                  ? departments.flatMap((d) =>
                      (gradesByDept[d.id] || []).map((g) => (
                        <QuietHoursEditor
                          key={`${d.id}:${g.id}`}
                          docRef={gradeConfigRef(
                            schoolId,
                            g.id,
                            "display_settings",
                            d.id
                          )}
                          title={`${d.name} / ${g.name}`}
                        />
                      ))
                    )
                  : grades.map((g) => (
                      <QuietHoursEditor
                        key={g.id}
                        docRef={gradeConfigRef(
                          schoolId,
                          g.id,
                          "display_settings"
                        )}
                        title={g.name}
                      />
                    ))}
              </div>
            </div>
          )}
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

      {/* モード切替モーダル */}
      <Modal
        isOpen={modeModalOpen}
        onClose={() => setModeModalOpen(false)}
        title="階層モードを切替"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setModeModalOpen(false)}
            >
              キャンセル
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConfirmModeSwitch}
              disabled={saving}
            >
              切替を実行
            </button>
          </>
        }
      >
        <p>
          現在のモード: <strong>{isDeptMode ? "学科モード" : "クラスモード"}</strong>
        </p>
        <p>
          切替先: <strong>{pendingMode === "department" ? "学科モード" : "クラスモード"}</strong>
        </p>
        <p style={{ fontSize: "0.85rem", color: "#666" }}>
          {pendingMode === "department"
            ? "既存クラスがすべて学科配下にある場合のみ切替できます。学年直下のクラスが残っている場合はエラーになります。"
            : "学科配下のクラスがすべて学年直下に整理されている場合のみ切替できます。"}
        </p>
        {modeSwitchBlockers.length > 0 && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              background: "#fff4f4",
              border: "1px solid #f5c2c2",
              borderRadius: 6,
              fontSize: "0.85rem",
            }}
          >
            <strong>移行が必要な項目:</strong>
            <ul style={{ marginTop: 6 }}>
              {modeSwitchBlockers.map((b, i) => (
                <li key={i}>
                  {b.gradeName}
                  {b.departmentName ? ` / ${b.departmentName}` : ""} /{" "}
                  {b.className}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>

      {/* 学科追加/編集モーダル */}
      <Modal
        isOpen={departmentModalOpen}
        onClose={() => {
          setDepartmentModalOpen(false);
          setEditingDepartmentId(null);
        }}
        title={editingDepartmentId ? "学科を編集" : "学科を追加"}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setDepartmentModalOpen(false);
                setEditingDepartmentId(null);
              }}
            >
              キャンセル
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSaveDepartment}
              disabled={saving}
            >
              {editingDepartmentId ? "保存" : "作成"}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label>学科名</label>
          <input
            type="text"
            value={newDepartmentName}
            onChange={(e) => setNewDepartmentName(e.target.value)}
            placeholder="例: 電子工学科"
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
