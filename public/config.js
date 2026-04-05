// config.js - Firebase設定と認証ヘルパー（学校 > 学年 > クラス対応）

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import {
    getAuth, signInWithEmailAndPassword, signInWithPopup,
    GoogleAuthProvider, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

// ========================================
// 定数
// ========================================

export const firebaseConfig = {
    apiKey: "AIzaSyAp7saZyxtWOtaus2dL_QN5jiJjdwRd1pg",
    authDomain: "school-signage-2026.firebaseapp.com",
    projectId: "school-signage-2026",
    storageBucket: "school-signage-2026.firebasestorage.app",
    messagingSenderId: "1068967206228",
    appId: "1:1068967206228:web:14d24f8881a5cd1a0b3cc1"
};

export const DEFAULT_SCHOOL_ID = "gn_tech";

// ========================================
// コンテキスト管理（学校 > 学年 > クラス）
// ========================================

function resolveContext() {
    const params = new URLSearchParams(window.location.search);
    return {
        schoolId: params.get('school') || localStorage.getItem('selectedSchoolId') || DEFAULT_SCHOOL_ID,
        gradeId: params.get('grade') || localStorage.getItem('selectedGradeId') || null,
        classId: params.get('class') || localStorage.getItem('selectedClassId') || null
    };
}

const ctx = resolveContext();
export let SCHOOL_ID = ctx.schoolId;
export let GRADE_ID = ctx.gradeId;
export let CLASS_ID = ctx.classId;

export function setSchoolContext(schoolId, gradeId, classId) {
    SCHOOL_ID = schoolId;
    GRADE_ID = gradeId;
    CLASS_ID = classId;
    localStorage.setItem('selectedSchoolId', schoolId);
    if (gradeId) { localStorage.setItem('selectedGradeId', gradeId); }
    else { localStorage.removeItem('selectedGradeId'); }
    if (classId) { localStorage.setItem('selectedClassId', classId); }
    else { localStorage.removeItem('selectedClassId'); }
}

export function getStaticJsonUrl(schoolId, gradeId, classId) {
    return `https://storage.googleapis.com/${firebaseConfig.storageBucket}/signage-data/${schoolId}/${gradeId}/${classId}/data.json`;
}

// ========================================
// Firebase初期化
// ========================================

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);

const googleProvider = new GoogleAuthProvider();

// ========================================
// Cloud Functions参照
// ========================================

// ユーザー管理
export const listUsersFn = httpsCallable(functions, 'listUsers');
export const createAdminUserFn = httpsCallable(functions, 'createAdminUser');
export const setAdminRoleFn = httpsCallable(functions, 'setAdminRole');
export const updateUserFn = httpsCallable(functions, 'updateUser');
export const deleteUserFn = httpsCallable(functions, 'deleteUser');
export const toggleUserStatusFn = httpsCallable(functions, 'toggleUserStatus');
export const setEmailVerifiedFn = httpsCallable(functions, 'setEmailVerified');
export const loginAsEditorFn = httpsCallable(functions, 'loginAsEditor');
export const setEditorPasswordFn = httpsCallable(functions, 'setEditorPassword');

// 学校管理
export const createSchoolFn = httpsCallable(functions, 'createSchool');
export const listSchoolsFn = httpsCallable(functions, 'listSchools');
export const updateSchoolFn = httpsCallable(functions, 'updateSchool');
export const deleteSchoolFn = httpsCallable(functions, 'deleteSchool');

// 学年管理
export const createGradeFn = httpsCallable(functions, 'createGrade');
export const listGradesFn = httpsCallable(functions, 'listGrades');
export const updateGradeFn = httpsCallable(functions, 'updateGrade');
export const deleteGradeFn = httpsCallable(functions, 'deleteGrade');

// クラス管理
export const createClassFn = httpsCallable(functions, 'createClass');
export const listClassesFn = httpsCallable(functions, 'listClasses');
export const updateClassFn = httpsCallable(functions, 'updateClass');
export const deleteClassFn = httpsCallable(functions, 'deleteClass');

// メンバーシップ管理
export const inviteMemberFn = httpsCallable(functions, 'inviteMember');
export const updateMembershipFn = httpsCallable(functions, 'updateMembership');
export const removeMemberFn = httpsCallable(functions, 'removeMember');
export const listMembersFn = httpsCallable(functions, 'listMembers');
export const getMyMembershipsFn = httpsCallable(functions, 'getMyMemberships');

// JSON再生成・マイグレーション
export const regenerateSignageJsonFn = httpsCallable(functions, 'regenerateSignageJson');
export const migrateToGradeStructureFn = httpsCallable(functions, 'migrateToGradeStructure');

// マスターコンテンツ
export const copyMasterToClassesFn = httpsCallable(functions, 'copyMasterToClasses');

// ========================================
// エラーメッセージ
// ========================================

const AUTH_ERROR_MESSAGES = {
    'auth/invalid-email': 'メールアドレスの形式が正しくありません',
    'auth/user-disabled': 'このアカウントは無効化されています',
    'auth/user-not-found': 'アカウントが見つかりません',
    'auth/wrong-password': 'パスワードが間違っています',
    'auth/invalid-credential': 'メールアドレスまたはパスワードが間違っています',
    'auth/too-many-requests': 'ログイン試行回数が多すぎます',
    'auth/network-request-failed': 'ネットワークエラーが発生しました',
    'auth/email-already-in-use': 'このメールアドレスは既に使用されています',
    'auth/weak-password': 'パスワードは6文字以上にしてください',
    'auth/popup-closed-by-user': 'ログインがキャンセルされました',
    'auth/cancelled-popup-request': 'ログインがキャンセルされました',
    'auth/popup-blocked': 'ポップアップがブロックされました。許可してください',
    'auth/account-exists-with-different-credential': 'このメールは別の方法で登録済みです',
};

function getAuthErrorMessage(errorCode) {
    return AUTH_ERROR_MESSAGES[errorCode] || `認証エラー: ${errorCode}`;
}

// ========================================
// 認証関数
// ========================================

export async function login(email, password) {
    try {
        await setPersistence(auth, browserLocalPersistence);
        const cred = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: cred.user };
    } catch (error) {
        return { success: false, error: getAuthErrorMessage(error.code) };
    }
}

export async function loginWithGoogle() {
    try {
        await setPersistence(auth, browserLocalPersistence);
        const result = await signInWithPopup(auth, googleProvider);
        return { success: true, user: result.user };
    } catch (error) {
        return { success: false, error: getAuthErrorMessage(error.code) };
    }
}

export async function logout() {
    try { await signOut(auth); return { success: true }; }
    catch (error) { return { success: false, error: error.message }; }
}

export function getCurrentUser() { return auth.currentUser; }
export function onAuthChange(callback) { return onAuthStateChanged(auth, callback); }

export async function isUserAdmin(user) {
    if (!user) return false;
    try {
        const result = await user.getIdTokenResult();
        return result.claims.admin === true || result.claims.systemRole === 'system_admin';
    } catch { return false; }
}

export async function isUserTeacher(user) {
    if (!user) return false;
    try {
        const result = await user.getIdTokenResult();
        return result.claims.teacher === true || result.claims.editor === true || result.claims.admin === true || result.claims.systemRole === 'system_admin';
    } catch { return false; }
}

export async function hasAnyAccess(user) {
    if (!user) return false;
    if (await isUserAdmin(user)) return true;
    if (await isUserTeacher(user)) return true;
    try {
        const result = await getMyMembershipsFn();
        const memberships = result.data.memberships || [];
        return memberships.length > 0;
    } catch { return false; }
}

export async function getUserClaims(user) {
    if (!user) return {};
    try { return (await user.getIdTokenResult()).claims; }
    catch { return {}; }
}

export async function getUserRoleLabel(user) {
    if (!user) return '';
    const claims = await getUserClaims(user);
    if (claims.admin === true || claims.systemRole === 'system_admin') return 'システム管理者';
    if (claims.teacher === true || claims.editor === true) return '教員';
    try {
        const result = await getMyMembershipsFn();
        const memberships = result.data.memberships || [];
        if (memberships.some(m => m.role === 'school_admin')) return '学校管理者';
        if (memberships.some(m => m.role === 'teacher')) return '教員';
    } catch { /* ignore */ }
    return '';
}

export async function loginAsEditor(password, schoolId) {
    try {
        const targetSchoolId = schoolId || SCHOOL_ID;
        // Cloud Functionでパスワード検証 + Authユーザー作成/更新
        const result = await loginAsEditorFn({ password, schoolId: targetSchoolId });
        if (result.data.success && result.data.email) {
            await setPersistence(auth, browserLocalPersistence);
            const cred = await signInWithEmailAndPassword(auth, result.data.email, password);
            if (result.data.schoolId) setSchoolContext(result.data.schoolId, GRADE_ID, CLASS_ID);
            return { success: true, user: cred.user };
        }
        return { success: false, error: 'ログインに失敗しました' };
    } catch (error) {
        return { success: false, error: error.message || 'パスワードが間違っています' };
    }
}

export async function getIdToken() {
    const user = auth.currentUser;
    if (!user) return null;
    try { return await user.getIdToken(); }
    catch { return null; }
}
