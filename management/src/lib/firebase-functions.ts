// lib/firebase-functions.ts - Cloud Functions呼び出し（型付き）

import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type {
  School,
  Grade,
  Department,
  Class,
  HierarchyMode,
} from "@/types/school";
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
  { id?: string; schoolId?: string; name: string; hierarchyMode?: HierarchyMode },
  { success: boolean; schoolId: string }
>(functions, "createSchool");
export const listSchoolsFn = httpsCallable<void, { schools: School[] }>(
  functions,
  "listSchools"
);
export const listSchoolsPublicFn = httpsCallable<
  void,
  {
    schools: {
      id: string;
      name: string;
      hierarchyMode: HierarchyMode;
    }[];
  }
>(functions, "listSchoolsPublic");
export const updateSchoolFn = httpsCallable<
  { schoolId?: string; id?: string; name?: string },
  { success: boolean }
>(functions, "updateSchool");
export const deleteSchoolFn = httpsCallable<
  { schoolId?: string; id?: string },
  { success: boolean }
>(functions, "deleteSchool");
export const setSchoolHierarchyModeFn = httpsCallable<
  { schoolId: string; mode: HierarchyMode },
  {
    success: boolean;
    message: string;
    mode: HierarchyMode;
  }
>(functions, "setSchoolHierarchyMode");

// ========================================
// 学年管理
// ========================================

export const createGradeFn = httpsCallable<
  {
    schoolId: string;
    departmentId?: string | null;
    name: string;
    order?: number;
  },
  { success: boolean; gradeId: string }
>(functions, "createGrade");
export const listGradesFn = httpsCallable<
  { schoolId: string; departmentId?: string | null },
  { grades: Grade[] }
>(functions, "listGrades");
export const updateGradeFn = httpsCallable<
  {
    schoolId: string;
    gradeId: string;
    departmentId?: string | null;
    name?: string;
    order?: number;
    hasClasses?: boolean;
  },
  { success: boolean }
>(functions, "updateGrade");
export const deleteGradeFn = httpsCallable<
  {
    schoolId: string;
    gradeId: string;
    departmentId?: string | null;
  },
  { success: boolean }
>(functions, "deleteGrade");

// ========================================
// 学科管理（学科モード: schools/{sId}/departments/{dId}）
// ========================================

export const createDepartmentFn = httpsCallable<
  { schoolId: string; name: string; order?: number },
  { success: boolean; departmentId: string }
>(functions, "createDepartment");
export const listDepartmentsFn = httpsCallable<
  { schoolId: string },
  { departments: Department[] }
>(functions, "listDepartments");
export const updateDepartmentFn = httpsCallable<
  {
    schoolId: string;
    departmentId: string;
    name?: string;
    order?: number;
  },
  { success: boolean }
>(functions, "updateDepartment");
export const deleteDepartmentFn = httpsCallable<
  { schoolId: string; departmentId: string },
  { success: boolean }
>(functions, "deleteDepartment");

// ========================================
// クラス管理
// ========================================

export const createClassFn = httpsCallable<
  {
    schoolId: string;
    gradeId: string;
    departmentId?: string | null;
    name: string;
  },
  { success: boolean; classId: string }
>(functions, "createClass");
export const listClassesFn = httpsCallable<
  { schoolId: string; gradeId: string; departmentId?: string | null },
  { classes: Class[] }
>(functions, "listClasses");
export const updateClassFn = httpsCallable<
  {
    schoolId: string;
    gradeId: string;
    departmentId?: string | null;
    classId: string;
    name?: string;
  },
  { success: boolean }
>(functions, "updateClass");
export const deleteClassFn = httpsCallable<
  {
    schoolId: string;
    gradeId: string;
    departmentId?: string | null;
    classId: string;
  },
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

// ========================================
// 学校詳細一括取得
// ========================================

export const getSchoolDetailFn = httpsCallable<
  { schoolId: string; includeUsers?: boolean },
  {
    schoolName: string;
    hierarchyMode: HierarchyMode;
    /** クラスモード時のみ */
    grades: Grade[];
    classesMap: Record<string, Class[]>;
    /** 学科モード時のみ */
    departments: Department[];
    gradesByDept: Record<string, Grade[]>;
    classesByDeptGrade: Record<string, Record<string, Class[]>>;
    members: Membership[];
    editorPassword: string;
    quietHours: { start: string; end: string }[];
    users: UserInfo[];
  }
>(functions, "getSchoolDetail");

// ========================================
// 管理者ダッシュボード一括取得
// ========================================

export const getAdminOverviewFn = httpsCallable<
  void,
  {
    schools: School[];
    users: UserInfo[];
    membershipsMap: Record<string, { schoolId: string; schoolName: string; role: string }[]>;
  }
>(functions, "getAdminOverview");

// ========================================
// フィードバック
// ========================================

export interface FeedbackItem {
  id: string;
  schoolId: string;
  classroomLabel: string;
  studentReaction: number;
  studentEpisode: string;
  teacherUtility: number;
  improvement: string;
  submitterUid: string | null;
  submitterEmail: string | null;
  createdAt: string | null;
}

export const submitFeedbackFn = httpsCallable<
  {
    schoolId: string;
    classroomLabel: string;
    studentReaction: number;
    studentEpisode?: string;
    teacherUtility: number;
    improvement?: string;
  },
  { success: boolean; feedbackId: string }
>(functions, "submitFeedback");

export const listFeedbackFn = httpsCallable<
  { limit?: number },
  { items: FeedbackItem[] }
>(functions, "listFeedback");
