// types/auth.ts - 認証・ロール関連の型定義

export type UserRole =
  | "system_admin"
  | "school_admin"
  | "teacher"
  | "editor"
  | "device";

export interface Claims {
  admin?: boolean;
  systemRole?: string;
  teacher?: boolean;
  editor?: boolean;
  schoolId?: string;
  [key: string]: unknown;
}

export interface Membership {
  id: string;
  userId: string;
  schoolId: string;
  role: UserRole;
  classIds?: string[];
  displayName?: string;
  email?: string;
}

export interface AuthResult {
  success: boolean;
  user?: import("firebase/auth").User;
  error?: string;
}

export interface UserInfo {
  uid: string;
  email: string | null;
  displayName: string | null;
  disabled?: boolean;
  customClaims?: Claims;
}
