// config.js - Firebase設定と認証ヘルパー

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { 
    getAuth, 
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut, 
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

// ========================================
// Firebase設定
// ========================================

export const firebaseConfig = {
    apiKey: "AIzaSyAp7saZyxtWOtaus2dL_QN5jiJjdwRd1pg",
    authDomain: "school-signage-2026.firebaseapp.com",
    projectId: "school-signage-2026",
    storageBucket: "school-signage-2026.firebasestorage.app",
    messagingSenderId: "1068967206228",
    appId: "1:1068967206228:web:14d24f8881a5cd1a0b3cc1"
};

// Firebase初期化
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);

// 認証プロバイダ
const googleProvider = new GoogleAuthProvider();

// 定数
export const SCHOOL_ID = "gn_tech";

// ========================================
// Cloud Functions参照
// ========================================

export const listUsersFn = httpsCallable(functions, 'listUsers');
export const createAdminUserFn = httpsCallable(functions, 'createAdminUser');
export const setAdminRoleFn = httpsCallable(functions, 'setAdminRole');
export const updateUserFn = httpsCallable(functions, 'updateUser');
export const deleteUserFn = httpsCallable(functions, 'deleteUser');
export const toggleUserStatusFn = httpsCallable(functions, 'toggleUserStatus');
export const setEmailVerifiedFn = httpsCallable(functions, 'setEmailVerified');

// ========================================
// エラーメッセージ定義
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

/**
 * エラーコードを日本語メッセージに変換
 * @param {string} errorCode 
 * @returns {string}
 */
function getAuthErrorMessage(errorCode) {
    return AUTH_ERROR_MESSAGES[errorCode] || `認証エラー: ${errorCode}`;
}

// ========================================
// 認証関数
// ========================================

/**
 * メールとパスワードでログイン
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
export async function login(email, password) {
    try {
        await setPersistence(auth, browserLocalPersistence);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error("ログインエラー:", error);
        return { success: false, error: getAuthErrorMessage(error.code) };
    }
}

/**
 * Googleアカウントでログイン
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
export async function loginWithGoogle() {
    try {
        await setPersistence(auth, browserLocalPersistence);
        const result = await signInWithPopup(auth, googleProvider);
        return { success: true, user: result.user };
    } catch (error) {
        console.error("Googleログインエラー:", error);
        return { success: false, error: getAuthErrorMessage(error.code) };
    }
}

/**
 * ログアウト
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function logout() {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        console.error("ログアウトエラー:", error);
        return { success: false, error: error.message };
    }
}

/**
 * 現在のユーザーを取得
 * @returns {object|null}
 */
export function getCurrentUser() {
    return auth.currentUser;
}

/**
 * 認証状態の監視
 * @param {Function} callback 
 * @returns {Function} unsubscribe関数
 */
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

/**
 * ユーザーが管理者かどうかを確認
 * @param {object} user 
 * @returns {Promise<boolean>}
 */
export async function isUserAdmin(user) {
    if (!user) return false;
    
    try {
        const idTokenResult = await user.getIdTokenResult();
        return idTokenResult.claims.admin === true;
    } catch (error) {
        console.error("管理者確認エラー:", error);
        return false;
    }
}

/**
 * IDトークンを取得
 * @returns {Promise<string|null>}
 */
export async function getIdToken() {
    const user = auth.currentUser;
    if (!user) return null;
    
    try {
        return await user.getIdToken();
    } catch (error) {
        console.error("トークン取得エラー:", error);
        return null;
    }
}