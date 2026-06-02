// hooks/useAuth.ts - Firebase認証状態管理hook

"use client";

import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserClaims } from "@/lib/auth";
import { getMyMembershipsFn } from "@/lib/firebase-functions";
import type { Claims, Membership } from "@/types/auth";

/**
 * 取得済みの claims / memberships からロールラベルを算出する。
 * 以前は getUserRoleLabel() を呼んでいたが、その中で getMyMemberships を
 * 再取得しており、ログインのたびに同じ Cloud Function を二重に叩いていた。
 * 既に取得済みの値から同じ判定を行うことで往復を 1 回削減する。
 * 判定順序は従来の getUserRoleLabel と一致させる（claim teacher を membership より優先）。
 */
function computeRoleLabel(claims: Claims, mems: Membership[]): string {
  if (claims.admin === true || claims.systemRole === "system_admin")
    return "システム管理者";
  if (claims.teacher === true || claims.editor === true) return "教員";
  if (mems.some((m) => m.role === "school_admin")) return "学校管理者";
  if (mems.some((m) => m.role === "teacher")) return "教員";
  return "";
}

export interface AuthState {
  user: User | null;
  claims: Claims;
  roleLabel: string;
  loading: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  isSchoolAdmin: boolean;
  memberships: Membership[];
  refreshMemberships: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<Claims>({});
  const [roleLabel, setRoleLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [isSchoolAdmin, setIsSchoolAdmin] = useState(false);
  const [memberships, setMemberships] = useState<Membership[]>([]);

  const loadMemberships = useCallback(async (): Promise<Membership[]> => {
    try {
      const res = await getMyMembershipsFn();
      return res.data.memberships || [];
    } catch {
      return [];
    }
  }, []);

  const updateUserState = useCallback(
    async (firebaseUser: User | null) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // claims の取得（ローカルのトークン復号）と memberships の取得
        // （Cloud Function 呼び出し）は互いに独立なので並列化して待ち時間を縮める。
        const [userClaims, mems] = await Promise.all([
          getUserClaims(firebaseUser),
          loadMemberships(),
        ]);
        setClaims(userClaims);
        setMemberships(mems);

        const admin =
          userClaims.admin === true || userClaims.systemRole === "system_admin";
        const claimTeacher =
          userClaims.teacher === true || userClaims.editor === true;
        const schoolAdmin = mems.some((m) => m.role === "school_admin");
        // claim だけでなく membership の role が teacher / editor のユーザーも
        // 編集権限ありとして扱う（membership 付与のエディターが編集画面で
        // 「エディター以上の権限が必要です」と弾かれる不具合の修正）。
        const membershipEditor = mems.some(
          (m) => m.role === "teacher" || m.role === "editor"
        );
        const teacher = admin || claimTeacher || schoolAdmin || membershipEditor;

        setIsAdmin(admin);
        setIsSchoolAdmin(schoolAdmin);
        setIsTeacher(teacher);

        // roleLabel は取得済みの claims/mems から算出する（getMyMemberships の
        // 二重呼び出しを排除。従来は getUserRoleLabel が内部で再取得していた）。
        setRoleLabel(computeRoleLabel(userClaims, mems));
      } else {
        setClaims({});
        setRoleLabel("");
        setIsAdmin(false);
        setIsTeacher(false);
        setIsSchoolAdmin(false);
        setMemberships([]);
      }
      setLoading(false);
    },
    [loadMemberships]
  );

  const refreshMemberships = useCallback(async () => {
    if (!user) return;
    const freshClaims = await getUserClaims(user, true);
    setClaims(freshClaims);
    const admin =
      freshClaims.admin === true || freshClaims.systemRole === "system_admin";
    setIsAdmin(admin);

    const mems = await loadMemberships();
    setMemberships(mems);
    const schoolAdmin = mems.some((m) => m.role === "school_admin");
    setIsSchoolAdmin(schoolAdmin);
    setIsTeacher(
      admin ||
        freshClaims.teacher === true ||
        freshClaims.editor === true ||
        schoolAdmin ||
        mems.some((m) => m.role === "teacher" || m.role === "editor")
    );
  }, [user, loadMemberships]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, updateUserState);
    return () => unsubscribe();
  }, [updateUserState]);

  return {
    user,
    claims,
    roleLabel,
    loading,
    isAdmin,
    isTeacher,
    isSchoolAdmin,
    memberships,
    refreshMemberships,
  };
}
