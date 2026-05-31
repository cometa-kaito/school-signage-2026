/**
 * handlers/editor-auth.js
 * エディター認証
 *
 * パスワードは bcrypt でハッシュ化して Firestore に保存する。
 * 旧データ（password: 平文）からの移行は loginAsEditor 成功時に lazy migration で行う。
 * 内部的に Firebase Auth ユーザー(editor_{schoolId}@signage.local)を自動作成し、
 * signInWithEmailAndPassword でログインする方式。
 */

const bcrypt = require('bcryptjs');
const { functions, hotFunctions, admin, db, DEFAULT_SCHOOL_ID } = require('../helpers/paths');
const { verifyAdmin, withAuth } = require('../helpers/auth');
const { validateRequired, validatePasswordStrength } = require('../helpers/validation');
const { getClientIp, hashValue, consumeRateLimit, resetRateLimit } = require('../helpers/rate-limit');

const EDITOR_EMAIL_DOMAIN = 'signage.local';
const BCRYPT_ROUNDS = 12;

function getEditorEmail(schoolId) {
    return `editor_${schoolId}@${EDITOR_EMAIL_DOMAIN}`;
}

/**
 * エディターログイン
 * 1. Firestoreでパスワードを検証（bcrypt ハッシュ比較 / 旧データは平文比較 + 即ハッシュ化）
 * 2. Firebase Authユーザーを作成/更新（パスワード同期 + カスタムクレーム設定）
 * 3. メールアドレスを返却 → クライアントがsignInWithEmailAndPasswordでログイン
 */
exports.loginAsEditor = hotFunctions.https.onCall(withAuth(async (data, context) => {
    const { password, schoolId } = data;
    validateRequired(data, ['password']);
    const targetSchoolId = schoolId || DEFAULT_SCHOOL_ID;

    // レートリミット: IP+学校単位で 5分5回まで、超過で15分ブロック
    const ipHash = hashValue(getClientIp(context));
    const rateLimitKey = `editor_${targetSchoolId}_${ipHash}`;
    await consumeRateLimit({ key: rateLimitKey });

    // パスワード検証
    const editorConfigRef = db.collection('schools').doc(targetSchoolId)
        .collection('config').doc('editor_auth');
    const editorConfigSnap = await editorConfigRef.get();
    if (!editorConfigSnap.exists) throw new functions.https.HttpsError('not-found', 'エディター認証が設定されていません');

    const configData = editorConfigSnap.data() || {};
    const storedHash = configData.passwordHash;
    const storedPlain = configData.password;

    let ok = false;
    let needsMigration = false;
    if (typeof storedHash === 'string' && storedHash.length > 0) {
        ok = await bcrypt.compare(password, storedHash);
    } else if (typeof storedPlain === 'string' && storedPlain.length > 0) {
        // 旧データ（平文保存）からのフォールバック
        ok = storedPlain === password;
        needsMigration = ok;
    }
    if (!ok) throw new functions.https.HttpsError('unauthenticated', 'パスワードが間違っています');

    // lazy migration: 旧平文データを bcrypt ハッシュに上書きし、平文フィールドを削除
    if (needsMigration) {
        const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        await editorConfigRef.set({
            passwordHash: hash,
            password: admin.firestore.FieldValue.delete(),
            migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }

    // 成功時はカウンタをリセット（ブロック回避）
    await resetRateLimit(rateLimitKey);

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
 * bcrypt でハッシュ化して保存。旧 password フィールドがあれば削除する。
 */
exports.setEditorPassword = functions.https.onCall(withAuth(async (data, context) => {
    const { password, schoolId } = data;
    validateRequired(data, ['password']);
    validatePasswordStrength(password);
    const targetSchoolId = schoolId || DEFAULT_SCHOOL_ID;

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Firestoreに保存（平文 password は削除）
    await db.collection('schools').doc(targetSchoolId).collection('config').doc('editor_auth')
        .set({
            passwordHash,
            password: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

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
