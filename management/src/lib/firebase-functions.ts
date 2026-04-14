// lib/firebase-functions.ts - Cloud Functions呼び出し（型付き）

import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { School, Grade, Class, Device } from "@/types/school";
import type { Membership, UserInfo } from "@/types/auth";

// ========================================
// ユーザー管理
// ========================================

export const listUsersFn = httpsCallable<void, { users: UserInfo[] }>(
  functions,
  "listUsers"
);
export const createAdminUserFn = httpsCallable<
  { email: string; password: string; displayName?: string },
  { success: boolean; uid: string }
>(functions, "createAdminUser");
export const setAdminRoleFn = httpsCallable<
  { uid: string; admin: boolean },
  { success: boolean }
>(functions, "setAdminRole");
export const updateUserFn = httpsCallable<
  { uid: string; displayName?: string; email?: string },
  { success: boolean }
>(functions, "updateUser");
export const deleteUserFn = httpsCallable<
  { uid: string },
  { success: boolean }
>(functions, "deleteUser");
export const toggleUserStatusFn = httpsCallable<
  { uid: string; disabled: boolean },
  { success: boolean }
>(functions, "toggleUserStatus");
export const setEmailVerifiedFn = httpsCallable<
  { uid: string },
  { success: boolean }
>(functions, "setEmailVerified");

// ========================================
// エディター認証
// ========================================

export const loginAsEditorFn = httpsCallable<
  { password: string; schoolId: string },
  { success: boolean; email?: string; schoolId?: string }
>(functions, "loginAsEditor");
export const setEditorPasswordFn = httpsCallable<
  { schoolId: string; password: string },
  { success: boolean }
>(functions, "setEditorPassword");

// ========================================
// 学校管理
// ========================================

export const createSchoolFn = httpsCallable<
  { id: string; name: string },
  { success: boolean }
>(functions, "createSchool");
export const listSchoolsFn = httpsCallable<void, { schools: School[] }>(
  functions,
  "listSchools"
);
export const updateSchoolFn = httpsCallable<
  { id: string; name: string },
  { success: boolean }
>(functions, "updateSchool");
export const deleteSchoolFn = httpsCallable<
  { id: string },
  { success: boolean }
>(functions, "deleteSchool");

// ========================================
// 学年管理
// ========================================

export const createGradeFn = httpsCallable<
  { schoolId: string; name: string; order?: number },
  { success: boolean; gradeId: string }
>(functions, "createGrade");
export const listGradesFn = httpsCallable<
  { schoolId: string },
  { grades: Grade[] }
>(functions, "listGrades");
export const updateGradeFn = httpsCallable<
  { schoolId: string; gradeId: string; name?: string; order?: number },
  { success: boolean }
>(functions, "updateGrade");
export const deleteGradeFn = httpsCallable<
  { schoolId: string; gradeId: string },
  { success: boolean }
>(functions, "deleteGrade");

// ========================================
// クラス管理
// ========================================

export const createClassFn = httpsCallable<
  { schoolId: string; gradeId: string; name: string },
  { success: boolean; classId: string }
>(functions, "createClass");
export const listClassesFn = httpsCallable<
  { schoolId: string; gradeId: string },
  { classes: Class[] }
>(functions, "listClasses");
export const updateClassFn = httpsCallable<
  { schoolId: string; gradeId: string; classId: string; name?: string },
  { success: boolean }
>(functions, "updateClass");
export const deleteClassFn = httpsCallable<
  { schoolId: string; gradeId: string; classId: string },
  { success: boolean }
>(functions, "deleteClass");

// ========================================
// メンバーシップ管理
// ========================================

export const inviteMemberFn = httpsCallable<
  {
    email: string;
    schoolId: string;
    role: string;
    classIds?: string[];
  },
  { success: boolean }
>(functions, "inviteMember");
export const updateMembershipFn = httpsCallable<
  {
    userId: string;
    schoolId: string;
    role?: string;
    classIds?: string[];
  },
  { success: boolean }
>(functions, "updateMembership");
export const removeMemberFn = httpsCallable<
  { userId: string; schoolId: string },
  { success: boolean }
>(functions, "removeMember");
export const listMembersFn = httpsCallable<
  { schoolId: string },
  { members: Membership[] }
>(functions, "listMembers");
export const getMyMembershipsFn = httpsCallable<
  void,
  { memberships: Membership[] }
>(functions, "getMyMemberships");

// ========================================
// デバイス管理
// ========================================

export const registerDeviceFn = httpsCallable<
  {
    schoolId: string;
    gradeId: string;
    classId: string;
    name: string;
  },
  { success: boolean; deviceId: string; token: string }
>(functions, "registerDevice");
export const listDevicesFn = httpsCallable<
  { schoolId: string },
  { devices: Device[] }
>(functions, "listDevices");
export const revokeDeviceTokenFn = httpsCallable<
  { schoolId: string; deviceId: string },
  { success: boolean }
>(functions, "revokeDeviceToken");
export const removeDeviceFn = httpsCallable<
  { schoolId: string; deviceId: string },
  { success: boolean }
>(functions, "removeDevice");

// ========================================
// JSON再生成・マイグレーション・マスター
// ========================================

export const regenerateSignageJsonFn = httpsCallable<
  { schoolId: string; gradeId: string; classId: string },
  { success: boolean }
>(functions, "regenerateSignageJson");
export const migrateToGradeStructureFn = httpsCallable<
  { schoolId: string },
  { success: boolean }
>(functions, "migrateToGradeStructure");
export const copyMasterToClassesFn = httpsCallable<
  {
    schoolId: string;
    gradeId?: string;
    sourceLevel: "school" | "grade";
    contentType: "schedules" | "notices" | "assignments" | "all";
    dateStr: string;
  },
  { success: boolean }
>(functions, "copyMasterToClasses");
