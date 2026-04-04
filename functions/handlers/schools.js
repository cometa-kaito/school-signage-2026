/**
 * handlers/schools.js
 * 学校管理
 */

const functions = require('firebase-functions');
const { admin, db } = require('../helpers/paths');
const { verifyAuth, verifyAdmin, verifySchoolAdmin, withAuth } = require('../helpers/auth');
const { validateRequired } = require('../helpers/validation');

exports.createSchool = functions.https.onCall(withAuth(async (data, context) => {
    const { name, plan } = data;
    validateRequired(data, ['name']);

    const schoolId = data.schoolId || name.toLowerCase()
        .replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_')
        .slice(0, 30) + '_' + Date.now().toString(36);

    await db.collection('schools').doc(schoolId).set({
        name, plan: plan || 'free', ownerId: context.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const membershipId = `${context.auth.uid}_${schoolId}`;
    await db.collection('memberships').doc(membershipId).set({
        userId: context.auth.uid, schoolId, role: 'school_admin',
        classIds: [], grantedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, schoolId, message: `学校「${name}」を作成しました` };
}, (context) => verifyAdmin(context)));

exports.listSchools = functions.https.onCall(withAuth(async (data, context) => {
    if (context.auth.token.admin || context.auth.token.systemRole === 'system_admin') {
        const snap = await db.collection('schools').get();
        const schools = [];
        snap.forEach(doc => schools.push({ id: doc.id, ...doc.data() }));
        return { schools };
    }
    const membershipsSnap = await db.collection('memberships')
        .where('userId', '==', context.auth.uid).get();
    const schools = [];
    for (const memberDoc of membershipsSnap.docs) {
        const { schoolId, role, classIds } = memberDoc.data();
        const schoolSnap = await db.collection('schools').doc(schoolId).get();
        if (schoolSnap.exists) {
            schools.push({ id: schoolSnap.id, ...schoolSnap.data(), myRole: role, myClassIds: classIds || [] });
        }
    }
    return { schools };
}, (context) => verifyAuth(context)));

exports.updateSchool = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, name, plan } = data;
    validateRequired(data, ['schoolId']);
    const u = {};
    if (name) u.name = name;
    if (plan) u.plan = plan;
    await db.collection('schools').doc(schoolId).update(u);
    return { success: true, message: '学校情報を更新しました' };
}, async (context, data) => {
    validateRequired(data, ['schoolId']);
    await verifySchoolAdmin(context, data.schoolId);
}));

exports.deleteSchool = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId } = data;
    validateRequired(data, ['schoolId']);
    await db.collection('schools').doc(schoolId).update({
        deletedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, message: '学校を削除しました' };
}, (context) => verifyAdmin(context)));
