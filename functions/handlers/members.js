/**
 * handlers/members.js
 * メンバーシップ管理
 */

const functions = require('firebase-functions');
const { admin, db } = require('../helpers/paths');
const { verifyAuth, verifySchoolAdmin, withAuth } = require('../helpers/auth');
const { validateRequired, preventSelfAction } = require('../helpers/validation');

exports.inviteMember = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, email, role, classIds } = data;

    if (!['school_admin', 'teacher', 'editor'].includes(role)) {
        throw new functions.https.HttpsError('invalid-argument', '無効なロールです');
    }

    let userRecord;
    try { userRecord = await admin.auth().getUserByEmail(email); }
    catch (e) { throw new functions.https.HttpsError('not-found', `ユーザー ${email} が見つかりません。先にユーザーを作成してください。`); }

    const membershipId = `${userRecord.uid}_${schoolId}`;
    await db.collection('memberships').doc(membershipId).set({
        userId: userRecord.uid, schoolId, role, classIds: classIds || [],
        grantedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, message: `${email} を${role}として追加しました` };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'email', 'role']);
    await verifySchoolAdmin(context, data.schoolId);
}));

exports.updateMembership = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, userId, role, classIds } = data;
    const membershipId = `${userId}_${schoolId}`;
    const u = {};
    if (role) u.role = role;
    if (classIds !== undefined) u.classIds = classIds;
    await db.collection('memberships').doc(membershipId).update(u);
    return { success: true, message: 'メンバーシップを更新しました' };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'userId']);
    await verifySchoolAdmin(context, data.schoolId);
}));

exports.removeMember = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, userId } = data;
    await db.collection('memberships').doc(`${userId}_${schoolId}`).delete();
    return { success: true, message: 'メンバーを除外しました' };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'userId']);
    await verifySchoolAdmin(context, data.schoolId);
    preventSelfAction(data.userId, context.auth.uid, 'メンバーから除外');
}));

exports.listMembers = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId } = data;
    const snap = await db.collection('memberships').where('schoolId', '==', schoolId).get();
    const members = [];
    for (const doc of snap.docs) {
        const m = doc.data();
        try {
            const user = await admin.auth().getUser(m.userId);
            members.push({
                userId: m.userId, email: user.email, displayName: user.displayName || '',
                role: m.role, classIds: m.classIds || [], grantedAt: m.grantedAt,
                disabled: user.disabled, emailVerified: user.emailVerified,
                isAdmin: user.customClaims?.admin === true,
                lastSignInTime: user.metadata.lastSignInTime
            });
        } catch (e) { /* skip deleted users */ }
    }
    return { members };
}, async (context, data) => {
    validateRequired(data, ['schoolId']);
    await verifySchoolAdmin(context, data.schoolId);
}));

exports.getMyMemberships = functions.https.onCall(withAuth(async (data, context) => {
    const snap = await db.collection('memberships').where('userId', '==', context.auth.uid).get();
    const memberships = [];
    for (const doc of snap.docs) {
        const m = doc.data();
        const schoolSnap = await db.collection('schools').doc(m.schoolId).get();
        if (schoolSnap.exists) {
            memberships.push({
                schoolId: m.schoolId, schoolName: schoolSnap.data().name,
                role: m.role, classIds: m.classIds || []
            });
        }
    }
    return { memberships };
}, (context) => verifyAuth(context)));
