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

function formatDate(d) {
    return d.toISOString().split('T')[0];
}

// ---- クラスモード ----
function classPath(schoolId, gradeId, classId) {
    return db.collection('schools').doc(schoolId)
        .collection('grades').doc(gradeId)
        .collection('classes').doc(classId);
}

function dailyDataPath(schoolId, gradeId, classId) {
    return classPath(schoolId, gradeId, classId).collection('daily_data');
}

function schoolMasterDailyDataPath(schoolId) {
    return db.collection('schools').doc(schoolId).collection('master_daily_data');
}

function gradeMasterDailyDataPath(schoolId, gradeId) {
    return db.collection('schools').doc(schoolId)
        .collection('grades').doc(gradeId)
        .collection('master_daily_data');
}

// ---- 学科モード ----
function departmentPath(schoolId, departmentId) {
    return db.collection('schools').doc(schoolId)
        .collection('departments').doc(departmentId);
}

function departmentMasterDailyDataPath(schoolId, departmentId) {
    return departmentPath(schoolId, departmentId).collection('master_daily_data');
}

// 学科モードの学年: schools/{s}/departments/{d}/grades/{g}
function deptGradePath(schoolId, departmentId, gradeId) {
    return departmentPath(schoolId, departmentId)
        .collection('grades').doc(gradeId);
}

// 学科モードの学年マスター日次
function deptGradeMasterDailyDataPath(schoolId, departmentId, gradeId) {
    return deptGradePath(schoolId, departmentId, gradeId)
        .collection('master_daily_data');
}

// 学科モードのクラス: schools/{s}/departments/{d}/grades/{g}/classes/{c}
function deptClassPath(schoolId, departmentId, gradeId, classId) {
    return deptGradePath(schoolId, departmentId, gradeId)
        .collection('classes').doc(classId);
}

function deptDailyDataPath(schoolId, departmentId, gradeId, classId) {
    return deptClassPath(schoolId, departmentId, gradeId, classId)
        .collection('daily_data');
}

// ---- モードに応じた統一パス ----
function classPathFor(schoolId, gradeId, classId, departmentId) {
    return departmentId
        ? deptClassPath(schoolId, departmentId, gradeId, classId)
        : classPath(schoolId, gradeId, classId);
}

function dailyDataPathFor(schoolId, gradeId, classId, departmentId) {
    return classPathFor(schoolId, gradeId, classId, departmentId).collection('daily_data');
}

function gradePathFor(schoolId, gradeId, departmentId) {
    return departmentId
        ? deptGradePath(schoolId, departmentId, gradeId)
        : db.collection('schools').doc(schoolId).collection('grades').doc(gradeId);
}

function gradeMasterDailyDataPathFor(schoolId, gradeId, departmentId) {
    return departmentId
        ? deptGradeMasterDailyDataPath(schoolId, departmentId, gradeId)
        : gradeMasterDailyDataPath(schoolId, gradeId);
}

function gradesCollectionFor(schoolId, departmentId) {
    if (departmentId) {
        return departmentPath(schoolId, departmentId).collection('grades');
    }
    return db.collection('schools').doc(schoolId).collection('grades');
}

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
