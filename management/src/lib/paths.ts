// lib/paths.ts - Firestoreパス構築（paths.jsの移植）

import { db } from "./firebase";
import {
  doc,
  collection,
  type DocumentReference,
  type CollectionReference,
} from "firebase/firestore";

/** クラスドキュメント: schools/{schoolId}/grades/{gradeId}/classes/{classId} */
export function classDocRef(
  schoolId: string,
  gradeId: string,
  classId: string
): DocumentReference {
  return doc(db, "schools", schoolId, "grades", gradeId, "classes", classId);
}

/** 日次データドキュメント: schools/{schoolId}/grades/{gradeId}/classes/{classId}/daily_data/{dateStr} */
export function dailyDataDocRef(
  schoolId: string,
  gradeId: string,
  classId: string,
  dateStr: string
): DocumentReference {
  return doc(
    db,
    "schools",
    schoolId,
    "grades",
    gradeId,
    "classes",
    classId,
    "daily_data",
    dateStr
  );
}

/** 日次データコレクション: schools/{schoolId}/grades/{gradeId}/classes/{classId}/daily_data */
export function dailyDataCollectionRef(
  schoolId: string,
  gradeId: string,
  classId: string
): CollectionReference {
  return collection(
    db,
    "schools",
    schoolId,
    "grades",
    gradeId,
    "classes",
    classId,
    "daily_data"
  );
}

/** 学校設定: schools/{schoolId}/config/{configName} */
export function schoolConfigRef(
  schoolId: string,
  configName: string
): DocumentReference {
  return doc(db, "schools", schoolId, "config", configName);
}

/** 学校ドキュメント: schools/{schoolId} */
export function schoolDocRef(schoolId: string): DocumentReference {
  return doc(db, "schools", schoolId);
}

/** 学校マスター日次データドキュメント: schools/{schoolId}/master_daily_data/{dateStr} */
export function schoolMasterDailyDataDocRef(
  schoolId: string,
  dateStr: string
): DocumentReference {
  return doc(db, "schools", schoolId, "master_daily_data", dateStr);
}

/** 学校マスター日次データコレクション: schools/{schoolId}/master_daily_data */
export function schoolMasterDailyDataCollectionRef(
  schoolId: string
): CollectionReference {
  return collection(db, "schools", schoolId, "master_daily_data");
}

/** 学年マスター日次データドキュメント: schools/{schoolId}/grades/{gradeId}/master_daily_data/{dateStr} */
export function gradeMasterDailyDataDocRef(
  schoolId: string,
  gradeId: string,
  dateStr: string
): DocumentReference {
  return doc(
    db,
    "schools",
    schoolId,
    "grades",
    gradeId,
    "master_daily_data",
    dateStr
  );
}

/** 学年マスター日次データコレクション: schools/{schoolId}/grades/{gradeId}/master_daily_data */
export function gradeMasterDailyDataCollectionRef(
  schoolId: string,
  gradeId: string
): CollectionReference {
  return collection(
    db,
    "schools",
    schoolId,
    "grades",
    gradeId,
    "master_daily_data"
  );
}
