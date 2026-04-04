/**
 * helpers/paths.js
 * Firebase参照・Firestoreパスヘルパー
 */

const admin = require('firebase-admin');

const db = admin.firestore();
const bucket = admin.storage().bucket();

const DEFAULT_SCHOOL_ID = 'gn_tech';

function formatDate(d) {
    return d.toISOString().split('T')[0];
}

function classPath(schoolId, gradeId, classId) {
    return db.collection('schools').doc(schoolId)
        .collection('grades').doc(gradeId)
        .collection('classes').doc(classId);
}

function dailyDataPath(schoolId, gradeId, classId) {
    return classPath(schoolId, gradeId, classId).collection('daily_data');
}

module.exports = {
    admin,
    db,
    bucket,
    DEFAULT_SCHOOL_ID,
    formatDate,
    classPath,
    dailyDataPath,
};
