/**
 * handlers/users.js
 * ユーザー管理
 */

const functions = require('firebase-functions');
const { admin, db } = require('../helpers/paths');
const { verifyAdmin, withAuth } = require('../helpers/auth');
const { validateRequired, preventSelfAction, getErrorMessage } = require('../helpers/validation');

exports.listUsers = functions.https.onCall(withAuth(async (data, context) => {
    const listResult = await admin.auth().listUsers(100);
    const users = listResult.users.map(user => ({
        uid: user.uid, email: user.email, displayName: user.displayName || '',
        emailVerified: user.emailVerified, disabled: user.disabled,
        isAdmin: user.customClaims?.admin === true,
        systemRole: user.customClaims?.systemRole || null,
        creationTime: user.metadata.creationTime,
        lastSignInTime: user.metadata.lastSignInTime
    }));
    return { users };
}, (context) => verifyAdmin(context)));

exports.createAdminUser = functions.https.onCall(withAuth(async (data, context) => {
    const { email, password, displayName, setAsAdmin } = data;
    validateRequired(data, ['email', 'password']);
    if (password.length < 6) throw new functions.https.HttpsError('invalid-argument', 'パスワードは6文字以上必要です');

    try {
        const userRecord = await admin.auth().createUser({
            email, password, displayName: displayName || '', emailVerified: true
        });
        if (setAsAdmin) {
            await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true, systemRole: 'system_admin' });
        }
        return { success: true, message: `ユーザー ${email} を作成しました`, uid: userRecord.uid };
    } catch (error) {
        throw new functions.https.HttpsError('internal', getErrorMessage(error));
    }
}, (context) => verifyAdmin(context)));

exports.setAdminRole = functions.https.onCall(withAuth(async (data, context) => {
    const { uid, isAdmin } = data;
    validateRequired(data, ['uid']);
    if (!isAdmin) preventSelfAction(uid, context.auth.uid, '管理者権限を削除');

    const user = await admin.auth().getUser(uid);
    const currentClaims = user.customClaims || {};
    if (isAdmin) {
        await admin.auth().setCustomUserClaims(uid, { ...currentClaims, admin: true, systemRole: 'system_admin' });
    } else {
        const { admin: _, systemRole, ...rest } = currentClaims;
        await admin.auth().setCustomUserClaims(uid, rest);
    }
    return { success: true, message: `${user.email} の管理者権限を${isAdmin ? '付与' : '削除'}しました` };
}, (context) => verifyAdmin(context)));

exports.updateUser = functions.https.onCall(withAuth(async (data, context) => {
    const { uid, email, displayName, password } = data;
    validateRequired(data, ['uid']);
    try {
        const u = {};
        if (email) u.email = email;
        if (displayName !== undefined) u.displayName = displayName;
        if (password && password.length >= 6) u.password = password;
        if (Object.keys(u).length === 0) throw new functions.https.HttpsError('invalid-argument', '更新するデータがありません');
        await admin.auth().updateUser(uid, u);
        return { success: true, message: 'ユーザー情報を更新しました' };
    } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', getErrorMessage(error));
    }
}, (context) => verifyAdmin(context)));

exports.deleteUser = functions.https.onCall(withAuth(async (data, context) => {
    const { uid } = data;
    validateRequired(data, ['uid']);
    preventSelfAction(uid, context.auth.uid, '削除');

    const user = await admin.auth().getUser(uid);
    const membershipsSnap = await db.collection('memberships').where('userId', '==', uid).get();
    const batch = db.batch();
    membershipsSnap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    await admin.auth().deleteUser(uid);
    return { success: true, message: `ユーザー ${user.email} を削除しました` };
}, (context) => verifyAdmin(context)));

exports.toggleUserStatus = functions.https.onCall(withAuth(async (data, context) => {
    const { uid, disabled } = data;
    validateRequired(data, ['uid']);
    if (disabled) preventSelfAction(uid, context.auth.uid, '無効化');

    await admin.auth().updateUser(uid, { disabled });
    const user = await admin.auth().getUser(uid);
    return { success: true, message: `${user.email} を${disabled ? '無効化' : '有効化'}しました` };
}, (context) => verifyAdmin(context)));

exports.setEmailVerified = functions.https.onCall(withAuth(async (data, context) => {
    const { uid, verified } = data;
    validateRequired(data, ['uid']);

    await admin.auth().updateUser(uid, { emailVerified: verified !== false });
    const user = await admin.auth().getUser(uid);
    return { success: true, message: `${user.email} のメール検証を「${user.emailVerified ? '確認済み' : '未確認'}」に更新しました` };
}, (context) => verifyAdmin(context)));
