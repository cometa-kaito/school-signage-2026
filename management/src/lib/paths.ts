// lib/paths.ts - Firestoreパス構築
//   クラスモード: schools/{s}/grades/{g}/classes/{c}
//   学科モード:   schools/{s}/departments/{d}/grades/{g}/classes/{c}

import { db } from "./firebase";
import {
  doc,
  collection,
  type DocumentReference,
  type CollectionReference,
} from "firebase/firestore";

/** 学校ドキュメント */
export function schoolDocRef(schoolId: string): DocumentReference {
  return doc(db, "schools", schoolId);
}

export function schoolConfigRef(
  schoolId: string,
  configName: string
): DocumentReference {
  return doc(db, "schools", schoolId, "config", configName);
}

/** 学科コンフィグ（display_settings 等） */
export function departmentConfigRef(
  schoolId: string,
  departmentId: string,
  configName: string
): DocumentReference {
  return doc(
    db,
    "schools",
    schoolId,
    "departments",
    departmentId,
    "config",
    configName
  );
}

/** 学年コンフィグ（display_settings 等） */
export function gradeConfigRef(
  schoolId: string,
  gradeId: string,
  configName: string,
  departmentId?: string | null
): DocumentReference {
  if (departmentId) {
    return doc(
      db,
      "schools",
      schoolId,
      "departments",
      departmentId,
      "grades",
      gradeId,
      "config",
      configName
    );
  }
  return doc(
    db,
    "schools",
    schoolId,
    "grades",
    gradeId,
    "config",
    configName
  );
}

/** 学校マスター */
export function schoolMasterDailyDataDocRef(
  schoolId: string,
  dateStr: string
): DocumentReference {
  return doc(db, "schools", schoolId, "master_daily_data", dateStr);
}

export function schoolMasterDailyDataCollectionRef(
  schoolId: string
): CollectionReference {
  return collection(db, "schools", schoolId, "master_daily_data");
}

/** 学科ドキュメント（学科モード） */
export function departmentDocRef(
  schoolId: string,
  departmentId: string
): DocumentReference {
  return doc(db, "schools", schoolId, "departments", departmentId);
}

/** 学科マスター */
export function departmentMasterDailyDataDocRef(
  schoolId: string,
  departmentId: string,
  dateStr: string
): DocumentReference {
  return doc(
    db,
    "schools",
    schoolId,
    "departments",
    departmentId,
    "master_daily_data",
    dateStr
  );
}

export function departmentMasterDailyDataCollectionRef(
  schoolId: string,
  departmentId: string
): CollectionReference {
  return collection(
    db,
    "schools",
    schoolId,
    "departments",
    departmentId,
    "master_daily_data"
  );
}

/**
 * 学年ドキュメント
 *   クラスモード: schools/{s}/grades/{g}
 *   学科モード:   schools/{s}/departments/{d}/grades/{g}
 */
export function gradeDocRef(
  schoolId: string,
  gradeId: string,
  departmentId?: string | null
): DocumentReference {
  if (departmentId) {
    return doc(
      db,
      "schools",
      schoolId,
      "departments",
      departmentId,
      "grades",
      gradeId
    );
  }
  return doc(db, "schools", schoolId, "grades", gradeId);
}

/** 学年マスター */
export function gradeMasterDailyDataDocRef(
  schoolId: string,
  gradeId: string,
  dateStr: string,
  departmentId?: string | null
): DocumentReference {
  if (departmentId) {
    return doc(
      db,
      "schools",
      schoolId,
      "departments",
      departmentId,
      "grades",
      gradeId,
      "master_daily_data",
      dateStr
    );
  }
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

export function gradeMasterDailyDataCollectionRef(
  schoolId: string,
  gradeId: string,
  departmentId?: string | null
): CollectionReference {
  if (departmentId) {
    return collection(
      db,
      "schools",
      schoolId,
      "departments",
      departmentId,
      "grades",
      gradeId,
      "master_daily_data"
    );
  }
  return collection(
    db,
    "schools",
    schoolId,
    "grades",
    gradeId,
    "master_daily_data"
  );
}

/** クラスドキュメント */
export function classDocRef(
  schoolId: string,
  gradeId: string,
  classId: string,
  departmentId?: string | null
): DocumentReference {
  if (departmentId) {
    return doc(
      db,
      "schools",
      schoolId,
      "departments",
      departmentId,
      "grades",
      gradeId,
      "classes",
      classId
    );
  }
  return doc(db, "schools", schoolId, "grades", gradeId, "classes", classId);
}

/** クラス日次データ */
export function dailyDataDocRef(
  schoolId: string,
  gradeId: string,
  classId: string,
  dateStr: string,
  departmentId?: string | null
): DocumentReference {
  if (departmentId) {
    return doc(
      db,
      "schools",
      schoolId,
      "departments",
      departmentId,
      "grades",
      gradeId,
      "classes",
      classId,
      "daily_data",
      dateStr
    );
  }
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

export function dailyDataCollectionRef(
  schoolId: string,
  gradeId: string,
  classId: string,
  departmentId?: string | null
): CollectionReference {
  if (departmentId) {
    return collection(
      db,
      "schools",
      schoolId,
      "departments",
      departmentId,
      "grades",
      gradeId,
      "classes",
      classId,
      "daily_data"
    );
  }
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
