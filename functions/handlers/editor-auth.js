/**
 * handlers/editor-auth.js
 * エディター認証
 */

const functions = require('firebase-functions');
const { admin, db, DEFAULT_SCHOOL_ID } = require('../helpers/paths');
const { verifyAdmin, withAuth } = require('../helpers/auth');
const { validateRequired } = require('../helpers/validation');

exports.loginAsEditor = functions.https.onCall(withAuth(async (data, context) => {
    const { password, schoolId } = data;
    validateRequired(data, ['password']);
    const targetSchoolId = schoolId || DEFAULT_SCHOOL_ID;

    const editorConfigSnap = await db.collection('schools').doc(targetSchoolId)
        .collection('config').doc('editor_auth').get();
    if (!editorConfigSnap.exists) throw new functions.https.HttpsError('not-found', 'エディター認証が設定されていません');
    if (editorConfigSnap.data().password !== password) throw new functions.https.HttpsError('unauthenticated', 'パスワードが間違っています');

    const customToken = await admin.auth().createCustomToken(`editor_${targetSchoolId}`, {
        editor: true, schoolId: targetSchoolId
    });
    return { success: true, customToken, schoolId: targetSchoolId, message: 'エディターとしてログインしました' };
}, null));

exports.setEditorPassword = functions.https.onCall(withAuth(async (data, context) => {
    const { password, schoolId } = data;
    validateRequired(data, ['password']);
    if (password.length < 4) throw new functions.https.HttpsError('invalid-argument', 'パスワードは4文字以上必要です');
    const targetSchoolId = schoolId || DEFAULT_SCHOOL_ID;

    await db.collection('schools').doc(targetSchoolId).collection('config').doc('editor_auth')
        .set({ password, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { success: true, message: 'エディターパスワードを設定しました' };
}, (context) => verifyAdmin(context)));
