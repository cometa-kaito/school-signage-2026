/**
 * handlers/grades.js
 * 学年管理 (school_admin 以上)
 */

const functions = require('firebase-functions');
const { admin, db } = require('../helpers/paths');
const { verifyAuth, verifySchoolAdmin, withAuth } = require('../helpers/auth');
const { validateRequired } = require('../helpers/validation');

exports.createGrade = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, name, order } = data;
    const ref = db.collection('schools').doc(schoolId).collection('grades').doc();
    await ref.set({
        name, order: order || 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, gradeId: ref.id, message: `学年「${name}」を作成しました` };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'name']);
    await verifySchoolAdmin(context, data.schoolId);
}));

exports.listGrades = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId } = data;
    const snap = await db.collection('schools').doc(schoolId)
        .collection('grades').orderBy('order', 'asc').get();
    const grades = [];
    snap.forEach(doc => grades.push({ id: doc.id, ...doc.data() }));
    return { grades };
}, (context, data) => {
    validateRequired(data, ['schoolId']);
    verifyAuth(context);
}));

exports.updateGrade = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, gradeId, name, order } = data;
    const u = {};
    if (name) u.name = name;
    if (order !== undefined) u.order = order;
    await db.collection('schools').doc(schoolId).collection('grades').doc(gradeId).update(u);
    return { success: true, message: '学年情報を更新しました' };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'gradeId']);
    await verifySchoolAdmin(context, data.schoolId);
}));

exports.deleteGrade = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, gradeId } = data;
    await db.collection('schools').doc(schoolId).collection('grades').doc(gradeId).delete();
    return { success: true, message: '学年を削除しました' };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'gradeId']);
    await verifySchoolAdmin(context, data.schoolId);
}));
