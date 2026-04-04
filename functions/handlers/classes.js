/**
 * handlers/classes.js
 * クラス管理 (school_admin 以上)
 * パス: schools/{schoolId}/grades/{gradeId}/classes/{classId}
 */

const functions = require('firebase-functions');
const { admin, db, classPath } = require('../helpers/paths');
const { verifyAuth, verifySchoolAdmin, withAuth } = require('../helpers/auth');
const { validateRequired } = require('../helpers/validation');

exports.createClass = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, gradeId, name } = data;
    const ref = db.collection('schools').doc(schoolId)
        .collection('grades').doc(gradeId)
        .collection('classes').doc();
    await ref.set({
        name,
        displaySettings: { ads: [], quietHours: [] },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, classId: ref.id, message: `クラス「${name}」を作成しました` };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'gradeId', 'name']);
    await verifySchoolAdmin(context, data.schoolId);
}));

exports.listClasses = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, gradeId } = data;
    const snap = await db.collection('schools').doc(schoolId)
        .collection('grades').doc(gradeId)
        .collection('classes').get();
    const classes = [];
    snap.forEach(doc => classes.push({ id: doc.id, ...doc.data() }));

    if (!context.auth.token.admin && context.auth.token.systemRole !== 'system_admin') {
        const membershipId = `${context.auth.uid}_${schoolId}`;
        const mSnap = await db.collection('memberships').doc(membershipId).get();
        if (mSnap.exists && mSnap.data().role !== 'school_admin') {
            const allowed = mSnap.data().classIds || [];
            return { classes: classes.filter(c => allowed.includes(c.id)) };
        }
    }
    return { classes };
}, (context, data) => {
    validateRequired(data, ['schoolId', 'gradeId']);
    verifyAuth(context);
}));

exports.updateClass = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, gradeId, classId, name, displaySettings } = data;
    const u = {};
    if (name) u.name = name;
    if (displaySettings) u.displaySettings = displaySettings;
    await classPath(schoolId, gradeId, classId).update(u);
    return { success: true, message: 'クラス情報を更新しました' };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'gradeId', 'classId']);
    await verifySchoolAdmin(context, data.schoolId);
}));

exports.deleteClass = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, gradeId, classId } = data;
    await classPath(schoolId, gradeId, classId).delete();
    return { success: true, message: 'クラスを削除しました' };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'gradeId', 'classId']);
    await verifySchoolAdmin(context, data.schoolId);
}));
