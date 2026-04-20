// lib/firebase.ts - Firebase初期化シングルトン

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import {
  getAuth,
  type Auth,
} from "firebase/auth";
import { getFunctions, type Functions } from "firebase/functions";

// Firebase Web 設定 — 環境変数優先、ビルド時に埋め込まれる
// Web API キーは公開可能（実際の保護は Firestore/Storage rules で行う）。
// 値を差し替えるときは management/.env.local で NEXT_PUBLIC_FIREBASE_* を設定。
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyAp7saZyxtWOtaus2dL_QN5jiJjdwRd1pg",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "school-signage-2026.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "school-signage-2026",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "school-signage-2026.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "1068967206228",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:1068967206228:web:14d24f8881a5cd1a0b3cc1",
};

function getOrInitApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  return initializeApp(firebaseConfig);
}

export const app: FirebaseApp = getOrInitApp();
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export const auth: Auth = getAuth(app);
export const functions: Functions = getFunctions(app, "asia-northeast1");

export const DEFAULT_SCHOOL_ID = "gn_tech";
