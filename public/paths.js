// paths.js - Firestoreドキュメントパス構築の一元化

import { db } from './config.js';
import {
    doc,
    collection
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * クラスドキュメントの参照を取得
 * schools/{schoolId}/grades/{gradeId}/classes/{classId}
 */
export function classDocRef(schoolId, gradeId, classId) {
    return doc(db, "schools", schoolId, "grades", gradeId, "classes", classId);
}

/**
 * 日次データドキュメントの参照を取得
 * schools/{schoolId}/grades/{gradeId}/classes/{classId}/daily_data/{dateStr}
 */
export function dailyDataDocRef(schoolId, gradeId, classId, dateStr) {
    return doc(db, "schools", schoolId, "grades", gradeId, "classes", classId, "daily_data", dateStr);
}

/**
 * 日次データコレクションの参照を取得
 * schools/{schoolId}/grades/{gradeId}/classes/{classId}/daily_data
 */
export function dailyDataCollectionRef(schoolId, gradeId, classId) {
    return collection(db, "schools", schoolId, "grades", gradeId, "classes", classId, "daily_data");
}

/**
 * 学校設定ドキュメントの参照を取得
 * schools/{schoolId}/config/{configName}
 */
export function schoolConfigRef(schoolId, configName) {
    return doc(db, "schools", schoolId, "config", configName);
}

/**
 * 学校ドキュメントの参照を取得
 * schools/{schoolId}
 */
export function schoolDocRef(schoolId) {
    return doc(db, "schools", schoolId);
}

/**
 * 旧形式（学年なし）の日次データドキュメント参照
 * schools/{schoolId}/daily_data/{dateStr}
 */
export function legacyDailyDataDocRef(schoolId, dateStr) {
    return doc(db, "schools", schoolId, "daily_data", dateStr);
}

// ========================================
// マスター日次データ（学校・学年レベル）
// ========================================

/**
 * 学校マスター日次データドキュメントの参照
 * schools/{schoolId}/master_daily_data/{dateStr}
 */
export function schoolMasterDailyDataDocRef(schoolId, dateStr) {
    return doc(db, "schools", schoolId, "master_daily_data", dateStr);
}

/**
 * 学校マスター日次データコレクションの参照
 * schools/{schoolId}/master_daily_data
 */
export function schoolMasterDailyDataCollectionRef(schoolId) {
    return collection(db, "schools", schoolId, "master_daily_data");
}

/**
 * 学年マスター日次データドキュメントの参照
 * schools/{schoolId}/grades/{gradeId}/master_daily_data/{dateStr}
 */
export function gradeMasterDailyDataDocRef(schoolId, gradeId, dateStr) {
    return doc(db, "schools", schoolId, "grades", gradeId, "master_daily_data", dateStr);
}

/**
 * 学年マスター日次データコレクションの参照
 * schools/{schoolId}/grades/{gradeId}/master_daily_data
 */
export function gradeMasterDailyDataCollectionRef(schoolId, gradeId) {
    return collection(db, "schools", schoolId, "grades", gradeId, "master_daily_data");
}
