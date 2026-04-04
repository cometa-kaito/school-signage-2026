/**
 * handlers/editor-auth.js
 * エディター認証
 *
 * パスワードのみでログイン可能。
 * 内部的にFirebase Authユーザー(editor_{schoolId}@signage.local)を自動作成し、
 * signInWithEmailAndPasswordでログインする方式。
 * createCustomTokenを使わないためIAM権限不要。
 */

const functions = require('firebase-functions');
const { admin, db, DEFAULT_SCHOOL_ID } = require('../helpers/paths');
const { verifyAdmin, withAuth } = require('../helpers/auth');
const { validateRequired } = require('../helpers/validation');

const EDITOR_EMAIL_DOMAIN = 'signage.local';

function getEditorEmail(schoolId) {
    return `editor_${schoolId}@${EDITOR_EMAIL_DOMAIN}`;
}

/**
 * エディターログイン
 * 1. Firestoreでパスワードを検証
 * 2. Firebase Authユーザーを作成/更新（パスワード同期 + カスタムクレーム設定）
 * 3. メールアドレスを返却 → クライアントがsignInWithEmailAndPasswordでログイン
 */
exports.loginAsEditor = functions.https.onCall(withAuth(async (data, context) => {
    const { password, schoolId } = data;
    validateRequired(data, ['password']);
    const targetSchoolId = schoolId || DEFAULT_SCHOOL_ID;

    // パスワード検証
    const editorConfigSnap = await db.collection('schools').doc(targetSchoolId)
        .collection('config').doc('editor_auth').get();
    if (!editorConfigSnap.exists) throw new functions.https.HttpsError('not-found', 'エディター認証が設定されていません');
    if (editorConfigSnap.data().password !== password) throw new functions.https.HttpsError('unauthenticated', 'パスワードが間違っています');

    const email = getEditorEmail(targetSchoolId);
    const claims = { teacher: true, schoolId: targetSchoolId };

    // Firebase Authユーザーを作成または更新
    let uid;
    try {
        const userRecord = await admin.auth().getUserByEmail(email);
        uid = userRecord.uid;
        // パスワードとクレームを同期
        await admin.auth().updateUser(uid, { password });
        await admin.auth().setCustomUserClaims(uid, claims);
    } catch (e) {
        if (e.code === 'auth/user-not-found') {
            // 新規作成
            const newUser = await admin.auth().createUser({
                email,
                password,
                emailVerified: true,
                displayName: `エディター (${targetSchoolId})`
            });
            uid = newUser.uid;
            await admin.auth().setCustomUserClaims(uid, claims);
        } else {
            throw new functions.https.HttpsError('internal', 'ユーザー作成エラー: ' + e.message);
        }
    }

    return { success: true, email, schoolId: targetSchoolId, message: 'エディターとしてログインしました' };
}, null));

/**
 * エディターパスワード設定
 */
exports.setEditorPassword = functions.https.onCall(withAuth(async (data, context) => {
    const { password, schoolId } = data;
    validateRequired(data, ['password']);
    if (password.length < 4) throw new functions.https.HttpsError('invalid-argument', 'パスワードは4文字以上必要です');
    const targetSchoolId = schoolId || DEFAULT_SCHOOL_ID;

    // Firestoreに保存
    await db.collection('schools').doc(targetSchoolId).collection('config').doc('editor_auth')
        .set({ password, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

    // Firebase Authユーザーも同期更新
    const email = getEditorEmail(targetSchoolId);
    const claims = { teacher: true, schoolId: targetSchoolId };
    try {
        const userRecord = await admin.auth().getUserByEmail(email);
        await admin.auth().updateUser(userRecord.uid, { password });
        await admin.auth().setCustomUserClaims(userRecord.uid, claims);
    } catch (e) {
        if (e.code === 'auth/user-not-found') {
            const newUser = await admin.auth().createUser({
                email,
                password,
                emailVerified: true,
                displayName: `エディター (${targetSchoolId})`
            });
            await admin.auth().setCustomUserClaims(newUser.uid, claims);
        }
    }

    return { success: true, message: 'エディターパスワードを設定しました' };
}, (context) => verifyAdmin(context)));
