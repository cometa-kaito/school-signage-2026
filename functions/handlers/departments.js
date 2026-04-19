/**
 * handlers/departments.js
 * 学科管理（学科モード: schools/{s}/departments/{d}）
 *   - 学科は学校直下の学年横断エンティティ
 *   - 学科配下に学年 (grades) がぶら下がる
 */

const { functions, admin, db, departmentPath } = require('../helpers/paths');
const { verifyAuth, verifySchoolAdmin, withAuth } = require('../helpers/auth');
const { validateRequired } = require('../helpers/validation');

exports.createDepartment = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, name, order } = data;
    const ref = db.collection('schools').doc(schoolId)
        .collection('departments').doc();
    await ref.set({
        name,
        order: order || 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, departmentId: ref.id, message: `学科「${name}」を作成しました` };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'name']);
    await verifySchoolAdmin(context, data.schoolId);
}));

exports.listDepartments = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId } = data;
    const snap = await db.collection('schools').doc(schoolId)
        .collection('departments').orderBy('order', 'asc').get();
    const departments = [];
    snap.forEach(doc => departments.push({ id: doc.id, ...doc.data() }));
    return { departments };
}, (context, data) => {
    validateRequired(data, ['schoolId']);
    verifyAuth(context);
}));

exports.updateDepartment = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, departmentId, name, order } = data;
    const u = {};
    if (name) u.name = name;
    if (order !== undefined) u.order = order;
    await departmentPath(schoolId, departmentId).update(u);
    return { success: true, message: '学科情報を更新しました' };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'departmentId']);
    await verifySchoolAdmin(context, data.schoolId);
}));

exports.deleteDepartment = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, departmentId } = data;
    // 配下に学年が残っていたら拒否（学年配下のクラスも含めて整理を促す）
    const gradesSnap = await departmentPath(schoolId, departmentId)
        .collection('grades').limit(1).get();
    if (!gradesSnap.empty) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            '学科配下に学年が残っています。先に学年を削除してください。'
        );
    }
    await departmentPath(schoolId, departmentId).delete();
    return { success: true, message: '学科を削除しました' };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'departmentId']);
    await verifySchoolAdmin(context, data.schoolId);
}));
