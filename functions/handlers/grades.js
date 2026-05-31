/**
 * handlers/grades.js
 * 学年管理 (school_admin 以上)
 *   クラスモード: schools/{s}/grades/{g}
 *   学科モード: schools/{s}/departments/{d}/grades/{g}
 */

const {
    functions, hotFunctions, admin, db, gradePathFor, gradesCollectionFor
} = require('../helpers/paths');
const { verifyAuth, verifySchoolAdmin, withAuth } = require('../helpers/auth');
const { validateRequired } = require('../helpers/validation');

exports.createGrade = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, departmentId, name, order } = data;
    const ref = gradesCollectionFor(schoolId, departmentId || null).doc();
    await ref.set({
        name, order: order || 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, gradeId: ref.id, message: `学年「${name}」を作成しました` };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'name']);
    await verifySchoolAdmin(context, data.schoolId);
}));

exports.listGrades = hotFunctions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, departmentId } = data;
    const snap = await gradesCollectionFor(schoolId, departmentId || null)
        .orderBy('order', 'asc').get();
    const grades = [];
    snap.forEach(doc => grades.push({ id: doc.id, ...doc.data() }));
    return { grades };
}, (context, data) => {
    validateRequired(data, ['schoolId']);
    verifyAuth(context);
}));

exports.updateGrade = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, gradeId, departmentId, name, order, hasClasses } = data;
    const u = {};
    if (name) u.name = name;
    if (order !== undefined) u.order = order;
    if (hasClasses !== undefined) u.hasClasses = !!hasClasses;
    await gradePathFor(schoolId, gradeId, departmentId || null).update(u);
    return { success: true, message: '学年情報を更新しました' };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'gradeId']);
    await verifySchoolAdmin(context, data.schoolId);
}));

exports.deleteGrade = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, gradeId, departmentId } = data;
    await gradePathFor(schoolId, gradeId, departmentId || null).delete();
    return { success: true, message: '学年を削除しました' };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'gradeId']);
    await verifySchoolAdmin(context, data.schoolId);
}));
