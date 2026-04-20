/**
 * helpers/paths.js
 * Firebase参照・Firestoreパスヘルパー
 *
 * 階層:
 *   クラスモード: schools/{s}/grades/{g}/classes/{c}
 *   学科モード:   schools/{s}/departments/{d}/grades/{g}/classes/{c}
 */

const admin = require('firebase-admin');
const functions = require('firebase-functions');

const REGION = 'asia-northeast1';
const regionalFunctions = functions.region(REGION);

const db = admin.firestore();
const bucket = admin.storage().bucket();

const DEFAULT_SCHOOL_ID = 'gn_tech';

/**
 * Date を YYYY-MM-DD 形式に整形。
 * @param {Date} d
 * @returns {string}
 */
function formatDate(d) {
    return d.toISOString().split('T')[0];
}

// ---- クラスモード ----

/**
 * @param {string} schoolId
 * @param {string} gradeId
 * @param {string} classId
 * @returns {FirebaseFirestore.DocumentReference}
 */
function classPath(schoolId, gradeId, classId) {
    return db.collection('schools').doc(schoolId)
        .collection('grades').doc(gradeId)
        .collection('classes').doc(classId);
}

/**
 * @param {string} schoolId
 * @param {string} gradeId
 * @param {string} classId
 * @returns {FirebaseFirestore.CollectionReference}
 */
function dailyDataPath(schoolId, gradeId, classId) {
    return classPath(schoolId, gradeId, classId).collection('daily_data');
}

/**
 * @param {string} schoolId
 * @returns {FirebaseFirestore.CollectionReference}
 */
function schoolMasterDailyDataPath(schoolId) {
    return db.collection('schools').doc(schoolId).collection('master_daily_data');
}

/**
 * @param {string} schoolId
 * @param {string} gradeId
 * @returns {FirebaseFirestore.CollectionReference}
 */
function gradeMasterDailyDataPath(schoolId, gradeId) {
    return db.collection('schools').doc(schoolId)
        .collection('grades').doc(gradeId)
        .collection('master_daily_data');
}

// ---- 学科モード ----

/**
 * @param {string} schoolId
 * @param {string} departmentId
 * @returns {FirebaseFirestore.DocumentReference}
 */
function departmentPath(schoolId, departmentId) {
    return db.collection('schools').doc(schoolId)
        .collection('departments').doc(departmentId);
}

/**
 * @param {string} schoolId
 * @param {string} departmentId
 * @returns {FirebaseFirestore.CollectionReference}
 */
function departmentMasterDailyDataPath(schoolId, departmentId) {
    return departmentPath(schoolId, departmentId).collection('master_daily_data');
}

/**
 * 学科配下の学年: schools/{s}/departments/{d}/grades/{g}
 * @param {string} schoolId
 * @param {string} departmentId
 * @param {string} gradeId
 * @returns {FirebaseFirestore.DocumentReference}
 */
function deptGradePath(schoolId, departmentId, gradeId) {
    return departmentPath(schoolId, departmentId)
        .collection('grades').doc(gradeId);
}

/**
 * 学科モードの学年マスター日次
 * @param {string} schoolId
 * @param {string} departmentId
 * @param {string} gradeId
 * @returns {FirebaseFirestore.CollectionReference}
 */
function deptGradeMasterDailyDataPath(schoolId, departmentId, gradeId) {
    return deptGradePath(schoolId, departmentId, gradeId)
        .collection('master_daily_data');
}

/**
 * 学科モードのクラス: schools/{s}/departments/{d}/grades/{g}/classes/{c}
 * @param {string} schoolId
 * @param {string} departmentId
 * @param {string} gradeId
 * @param {string} classId
 * @returns {FirebaseFirestore.DocumentReference}
 */
function deptClassPath(schoolId, departmentId, gradeId, classId) {
    return deptGradePath(schoolId, departmentId, gradeId)
        .collection('classes').doc(classId);
}

/**
 * @param {string} schoolId
 * @param {string} departmentId
 * @param {string} gradeId
 * @param {string} classId
 * @returns {FirebaseFirestore.CollectionReference}
 */
function deptDailyDataPath(schoolId, departmentId, gradeId, classId) {
    return deptClassPath(schoolId, departmentId, gradeId, classId)
        .collection('daily_data');
}

// ---- モードに応じた統一パス ----

/**
 * departmentId の有無で学科/クラスモードを自動判定する。
 * @param {string} schoolId
 * @param {string} gradeId
 * @param {string} classId
 * @param {string|null|undefined} [departmentId]
 * @returns {FirebaseFirestore.DocumentReference}
 */
function classPathFor(schoolId, gradeId, classId, departmentId) {
    return departmentId
        ? deptClassPath(schoolId, departmentId, gradeId, classId)
        : classPath(schoolId, gradeId, classId);
}

/**
 * @param {string} schoolId
 * @param {string} gradeId
 * @param {string} classId
 * @param {string|null|undefined} [departmentId]
 * @returns {FirebaseFirestore.CollectionReference}
 */
function dailyDataPathFor(schoolId, gradeId, classId, departmentId) {
    return classPathFor(schoolId, gradeId, classId, departmentId).collection('daily_data');
}

/**
 * @param {string} schoolId
 * @param {string} gradeId
 * @param {string|null|undefined} [departmentId]
 * @returns {FirebaseFirestore.DocumentReference}
 */
function gradePathFor(schoolId, gradeId, departmentId) {
    return departmentId
        ? deptGradePath(schoolId, departmentId, gradeId)
        : db.collection('schools').doc(schoolId).collection('grades').doc(gradeId);
}

/**
 * @param {string} schoolId
 * @param {string} gradeId
 * @param {string|null|undefined} [departmentId]
 * @returns {FirebaseFirestore.CollectionReference}
 */
function gradeMasterDailyDataPathFor(schoolId, gradeId, departmentId) {
    return departmentId
        ? deptGradeMasterDailyDataPath(schoolId, departmentId, gradeId)
        : gradeMasterDailyDataPath(schoolId, gradeId);
}

/**
 * @param {string} schoolId
 * @param {string|null|undefined} [departmentId]
 * @returns {FirebaseFirestore.CollectionReference}
 */
function gradesCollectionFor(schoolId, departmentId) {
    if (departmentId) {
        return departmentPath(schoolId, departmentId).collection('grades');
    }
    return db.collection('schools').doc(schoolId).collection('grades');
}

/**
 * @param {string} schoolId
 * @param {string} gradeId
 * @param {string|null|undefined} [departmentId]
 * @returns {FirebaseFirestore.CollectionReference}
 */
function classesCollectionFor(schoolId, gradeId, departmentId) {
    return gradePathFor(schoolId, gradeId, departmentId).collection('classes');
}

module.exports = {
    admin,
    functions: regionalFunctions,
    db,
    bucket,
    DEFAULT_SCHOOL_ID,
    formatDate,
    // クラスモード互換
    classPath,
    dailyDataPath,
    schoolMasterDailyDataPath,
    gradeMasterDailyDataPath,
    // 学科モード
    departmentPath,
    departmentMasterDailyDataPath,
    deptGradePath,
    deptGradeMasterDailyDataPath,
    deptClassPath,
    deptDailyDataPath,
    // モード共通
    classPathFor,
    dailyDataPathFor,
    gradePathFor,
    gradeMasterDailyDataPathFor,
    gradesCollectionFor,
    classesCollectionFor,
};
