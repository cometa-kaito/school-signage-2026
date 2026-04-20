// functions/types.d.ts
// Cloud Functions 全体で共有する型定義。
// JavaScript ファイルからは JSDoc `@type { import('./types').X }` で参照する。

import type {
    CallableContext,
    HttpsError,
} from 'firebase-functions/v1/https';
import type { DocumentReference, CollectionReference } from 'firebase-admin/firestore';

// ---- ロール・権限 -----------------------------------------------------

export type UserRole =
    | 'system_admin'
    | 'school_admin'
    | 'teacher'
    | 'editor';

export interface Membership {
    role: UserRole;
    classIds?: string[];
    displayName?: string;
    email?: string;
    createdAt?: FirebaseFirestore.Timestamp;
}

export interface AuthTokenClaims {
    admin?: boolean;
    systemRole?: string;
    teacher?: boolean;
    editor?: boolean;
    schoolId?: string;
    [key: string]: unknown;
}

/** Cloud Function onCall の context — firebase-functions の CallableContext に準拠 */
export type CallContext = CallableContext;

// ---- データモデル -----------------------------------------------------

export interface ScheduleItem {
    period: number;
    subject: string;
    teacher?: string;
    classroom?: string;
    note?: string;
    display_start?: string;   // YYYY-MM-DD
    display_end?: string;     // YYYY-MM-DD
}

export interface NoticeItem {
    id: string;
    title: string;
    body?: string;
    author?: string;
    importance?: 'low' | 'normal' | 'high';
    display_start?: string;
    display_end?: string;
    createdAt?: FirebaseFirestore.Timestamp;
}

export interface AssignmentItem {
    id: string;
    subject: string;
    title: string;
    deadline: string;         // YYYY-MM-DD
    submitter?: string;
    display_start?: string;
    display_end?: string;
}

export interface DailyData {
    schedule?: ScheduleItem[];
    notices?: NoticeItem[];
    assignments?: AssignmentItem[];
}

export interface AdItem {
    id: string;
    type: 'image' | 'video';
    url: string;
    duration?: number;
    order?: number;
}

export interface QuietHours {
    enabled: boolean;
    periods?: Array<{ start: string; end: string; days?: number[] }>;
}

export interface DisplaySettings {
    ads?: AdItem[];
    quietHours?: QuietHours;
    theme?: string;
}

// ---- API レスポンス --------------------------------------------------

export interface SuccessResult {
    success: true;
    [key: string]: unknown;
}

export interface LoginAsEditorResult {
    success: boolean;
    email?: string;
    error?: string;
}

export interface MembershipListResult {
    memberships: Array<Membership & { id: string; schoolId: string }>;
}

// ---- ヘルパー関数シグネチャ ------------------------------------------

export type AuthCheckFn = (
    context: CallContext,
    data?: unknown
) => void | Promise<void>;

export type HandlerFn<TData = unknown, TResult = unknown> = (
    data: TData,
    context: CallContext
) => Promise<TResult>;
