// hooks/useAuth.ts - Firebase認証状態管理hook

"use client";

import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserClaims, getUserRoleLabel } from "@/lib/auth";
import { getMyMembershipsFn } from "@/lib/firebase-functions";
import type { Claims, Membership } from "@/types/auth";

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
        const userClaims = await getUserClaims(firebaseUser);
        setClaims(userClaims);
        const admin =
          userClaims.admin === true || userClaims.systemRole === "system_admin";
        const claimTeacher =
          userClaims.teacher === true || userClaims.editor === true;

        const mems = await loadMemberships();
        setMemberships(mems);

        const schoolAdmin = mems.some((m) => m.role === "school_admin");
        const teacher = admin || claimTeacher || schoolAdmin;

        setIsAdmin(admin);
        setIsSchoolAdmin(schoolAdmin);
        setIsTeacher(teacher);

        const label = await getUserRoleLabel(firebaseUser);
        setRoleLabel(label);
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
        schoolAdmin
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
