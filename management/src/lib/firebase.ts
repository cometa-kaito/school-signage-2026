// lib/firebase.ts - Firebase初期化シングルトン

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import {
  getAuth,
  type Auth,
} from "firebase/auth";
import { getFunctions, type Functions } from "firebase/functions";

export const firebaseConfig = {
  apiKey: "AIzaSyAp7saZyxtWOtaus2dL_QN5jiJjdwRd1pg",
  authDomain: "school-signage-2026.firebaseapp.com",
  projectId: "school-signage-2026",
  storageBucket: "school-signage-2026.firebasestorage.app",
  messagingSenderId: "1068967206228",
  appId: "1:1068967206228:web:14d24f8881a5cd1a0b3cc1",
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
