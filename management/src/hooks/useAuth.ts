// hooks/useAuth.ts - Firebase認証状態管理hook

"use client";

import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserClaims, getUserRoleLabel } from "@/lib/auth";
import type { Claims } from "@/types/auth";

export interface AuthState {
  user: User | null;
  claims: Claims;
  roleLabel: string;
  loading: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<Claims>({});
  const [roleLabel, setRoleLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);

  const updateUserState = useCallback(async (firebaseUser: User | null) => {
    setUser(firebaseUser);
    if (firebaseUser) {
      const userClaims = await getUserClaims(firebaseUser);
      setClaims(userClaims);
      const admin =
        userClaims.admin === true ||
        userClaims.systemRole === "system_admin";
      const teacher =
        admin ||
        userClaims.teacher === true ||
        userClaims.editor === true;
      setIsAdmin(admin);
      setIsTeacher(teacher);
      const label = await getUserRoleLabel(firebaseUser);
      setRoleLabel(label);
    } else {
      setClaims({});
      setRoleLabel("");
      setIsAdmin(false);
      setIsTeacher(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, updateUserState);
    return () => unsubscribe();
  }, [updateUserState]);

  return { user, claims, roleLabel, loading, isAdmin, isTeacher };
}
