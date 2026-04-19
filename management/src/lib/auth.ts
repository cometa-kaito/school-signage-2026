// lib/auth.ts - 認証ヘルパー関数

import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  setPersistence,
  browserLocalPersistence,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";
import { loginAsEditorFn, getMyMembershipsFn } from "./firebase-functions";
import type { AuthResult, Claims } from "@/types/auth";

const googleProvider = new GoogleAuthProvider();

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-email": "メールアドレスの形式が正しくありません",
  "auth/user-disabled": "このアカウントは無効化されています",
  "auth/user-not-found": "アカウントが見つかりません",
  "auth/wrong-password": "パスワードが間違っています",
  "auth/invalid-credential": "メールアドレスまたはパスワードが間違っています",
  "auth/too-many-requests": "ログイン試行回数が多すぎます",
  "auth/network-request-failed": "ネットワークエラーが発生しました",
  "auth/email-already-in-use": "このメールアドレスは既に使用されています",
  "auth/weak-password": "パスワードは6文字以上にしてください",
  "auth/popup-closed-by-user": "ログインがキャンセルされました",
  "auth/cancelled-popup-request": "ログインがキャンセルされました",
  "auth/popup-blocked": "ポップアップがブロックされました。許可してください",
  "auth/account-exists-with-different-credential":
    "このメールは別の方法で登録済みです",
};

function getAuthErrorMessage(errorCode: string): string {
  return AUTH_ERROR_MESSAGES[errorCode] || `認証エラー: ${errorCode}`;
}

/** メール/パスワードでログイン */
export async function login(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    await setPersistence(auth, browserLocalPersistence);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: cred.user };
  } catch (error: unknown) {
    const code = (error as { code?: string }).code || "";
    return { success: false, error: getAuthErrorMessage(code) };
  }
}

/** Googleでログイン */
export async function loginWithGoogle(): Promise<AuthResult> {
  try {
    await setPersistence(auth, browserLocalPersistence);
    const result = await signInWithPopup(auth, googleProvider);
    return { success: true, user: result.user };
  } catch (error: unknown) {
    const code = (error as { code?: string }).code || "";
    return { success: false, error: getAuthErrorMessage(code) };
  }
}

/** ログアウト */
export async function logout(): Promise<{ success: boolean; error?: string }> {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/** エディターパスワードでログイン */
export async function loginAsEditor(
  password: string,
  schoolId: string
): Promise<AuthResult> {
  try {
    const result = await loginAsEditorFn({ password, schoolId });
    if (result.data.success && result.data.email) {
      await setPersistence(auth, browserLocalPersistence);
      const cred = await signInWithEmailAndPassword(
        auth,
        result.data.email,
        password
      );
      return { success: true, user: cred.user };
    }
    return { success: false, error: "ログインに失敗しました" };
  } catch (error: unknown) {
    return {
      success: false,
      error: (error as Error).message || "パスワードが間違っています",
    };
  }
}

/** ユーザーのカスタムクレームを取得 */
export async function getUserClaims(
  user: User,
  forceRefresh = false
): Promise<Claims> {
  try {
    const result = await user.getIdTokenResult(forceRefresh);
    return result.claims as Claims;
  } catch {
    return {};
  }
}

/** 管理者かどうか */
export async function isUserAdmin(user: User | null): Promise<boolean> {
  if (!user) return false;
  const claims = await getUserClaims(user);
  return claims.admin === true || claims.systemRole === "system_admin";
}

/** 教員/エディターかどうか */
export async function isUserTeacher(user: User | null): Promise<boolean> {
  if (!user) return false;
  const claims = await getUserClaims(user);
  return (
    claims.teacher === true ||
    claims.editor === true ||
    claims.admin === true ||
    claims.systemRole === "system_admin"
  );
}

/** 何らかのアクセス権があるか */
export async function hasAnyAccess(user: User | null): Promise<boolean> {
  if (!user) return false;
  if (await isUserAdmin(user)) return true;
  if (await isUserTeacher(user)) return true;
  try {
    const result = await getMyMembershipsFn();
    const memberships = result.data.memberships || [];
    return memberships.length > 0;
  } catch {
    return false;
  }
}

/** ロールのラベルを取得 */
export async function getUserRoleLabel(user: User | null): Promise<string> {
  if (!user) return "";
  const claims = await getUserClaims(user);
  if (claims.admin === true || claims.systemRole === "system_admin")
    return "システム管理者";
  if (claims.teacher === true || claims.editor === true) return "教員";
  try {
    const result = await getMyMembershipsFn();
    const memberships = result.data.memberships || [];
    if (memberships.some((m) => m.role === "school_admin")) return "学校管理者";
    if (memberships.some((m) => m.role === "teacher")) return "教員";
  } catch {
    /* ignore */
  }
  return "";
}
