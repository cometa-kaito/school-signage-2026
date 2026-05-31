/**
 * handlers/classes.js
 * クラス管理 (school_admin 以上)
 *   クラスモード: schools/{s}/grades/{g}/classes/{c}
 *   学科モード: schools/{s}/departments/{d}/grades/{g}/classes/{c}
 */

const {
    functions, hotFunctions, admin, db, classPathFor, classesCollectionFor
} = require('../helpers/paths');
const { verifyAuth, verifySchoolAdmin, withAuth } = require('../helpers/auth');
const { validateRequired } = require('../helpers/validation');

exports.createClass = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, gradeId, departmentId, name } = data;
    const ref = classesCollectionFor(schoolId, gradeId, departmentId || null).doc();
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

exports.listClasses = hotFunctions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, gradeId, departmentId } = data;
    const snap = await classesCollectionFor(schoolId, gradeId, departmentId || null)
        .orderBy('name', 'asc').get();
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
    const { schoolId, gradeId, classId, departmentId, name, displaySettings } = data;
    const u = {};
    if (name) u.name = name;
    if (displaySettings) u.displaySettings = displaySettings;
    await classPathFor(schoolId, gradeId, classId, departmentId || null).update(u);
    return { success: true, message: 'クラス情報を更新しました' };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'gradeId', 'classId']);
    await verifySchoolAdmin(context, data.schoolId);
}));

exports.deleteClass = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, gradeId, classId, departmentId } = data;
    await classPathFor(schoolId, gradeId, classId, departmentId || null).delete();
    return { success: true, message: 'クラスを削除しました' };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'gradeId', 'classId']);
    await verifySchoolAdmin(context, data.schoolId);
}));
