/**
 * handlers/editor-auth.js
 * エディター認証
 *
 * パスワードは bcrypt でハッシュ化して Firestore に保存し、サーバ側で検証する。
 * 旧データ（password: 平文）からの移行は loginAsEditor 成功時に lazy migration で行う。
 * 検証成功後は Firebase Auth ユーザー(editor_{schoolId}@signage.local)に毎回
 * ランダムな使い捨てパスワードを発行し、それを返してクライアントが
 * signInWithEmailAndPassword でログインする。編集者パスワード自体は Auth に保存しない
 * ため、(1) Auth の最小6文字制限に縛られない（編集者ポリシーの4文字でも可）、
 * (2) 編集者パスワードを直接使って Auth にサインインし、サーバ検証/レート制限を
 * 迂回する攻撃を防げる、という2点を満たす。
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { functions, hotFunctions, admin, db, DEFAULT_SCHOOL_ID, HttpsError } = require('../helpers/paths');
const { verifyAdmin, withAuth } = require('../helpers/auth');
const { validateRequired, validateEditorPasswordStrength } = require('../helpers/validation');
const { getClientIp, hashValue, consumeRateLimit, resetRateLimit } = require('../helpers/rate-limit');

const EDITOR_EMAIL_DOMAIN = 'signage.local';
const BCRYPT_ROUNDS = 12;

function getEditorEmail(schoolId) {
    return `editor_${schoolId}@${EDITOR_EMAIL_DOMAIN}`;
}

/**
 * Firebase Auth サインイン用の使い捨てパスワードを生成する。
 * 編集者パスワードとは無関係なランダム値（48桁hex で 6文字制限を常に満たす）。
 */
function generateSignInPassword() {
    return crypto.randomBytes(24).toString('hex');
}

/**
 * エディターログイン
 * 1. Firestoreでパスワードを検証（bcrypt ハッシュ比較 / 旧データは平文比較 + 即ハッシュ化）
 * 2. Firebase Authユーザーを用意し、使い捨てパスワードを設定 + カスタムクレーム付与
 * 3. メールアドレスと使い捨てパスワードを返却 → クライアントが signInWithEmailAndPassword
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
    if (!editorConfigSnap.exists) throw new HttpsError('not-found', 'エディター認証が設定されていません');

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
    if (!ok) throw new HttpsError('unauthenticated', 'パスワードが間違っています');

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
    // 編集者パスワードは Auth に保存せず、毎回ランダムな使い捨てパスワードを発行する。
    const signInPassword = generateSignInPassword();

    // Firebase Authユーザーを作成または更新（使い捨てパスワードを設定）
    let uid;
    try {
        const userRecord = await admin.auth().getUserByEmail(email);
        uid = userRecord.uid;
        await admin.auth().updateUser(uid, { password: signInPassword });
        await admin.auth().setCustomUserClaims(uid, claims);
    } catch (e) {
        if (e.code === 'auth/user-not-found') {
            // 新規作成
            const newUser = await admin.auth().createUser({
                email,
                password: signInPassword,
                emailVerified: true,
                displayName: `エディター (${targetSchoolId})`
            });
            uid = newUser.uid;
            await admin.auth().setCustomUserClaims(uid, claims);
        } else {
            throw new HttpsError('internal', 'ユーザー準備エラー: ' + e.message);
        }
    }

    return { success: true, email, signInPassword, schoolId: targetSchoolId, message: 'エディターとしてログインしました' };
}, null));

/**
 * エディターパスワード設定
 * bcrypt でハッシュ化して保存。旧 password フィールドがあれば削除する。
 * Auth ユーザーは存在保証＋クレーム付与のみ（ログイン時に毎回使い捨てパスワードを
 * 発行するため、編集者パスワードを Auth へ保存する必要はない）。
 */
exports.setEditorPassword = functions.https.onCall(withAuth(async (data, context) => {
    const { password, schoolId } = data;
    validateRequired(data, ['password']);
    validateEditorPasswordStrength(password);
    const targetSchoolId = schoolId || DEFAULT_SCHOOL_ID;

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Firestoreに保存（平文 password は削除）
    await db.collection('schools').doc(targetSchoolId).collection('config').doc('editor_auth')
        .set({
            passwordHash,
            password: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

    // Firebase Authユーザーの存在保証 + クレーム付与（パスワードは保存しない）
    const email = getEditorEmail(targetSchoolId);
    const claims = { teacher: true, schoolId: targetSchoolId };
    try {
        const userRecord = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(userRecord.uid, claims);
    } catch (e) {
        if (e.code === 'auth/user-not-found') {
            const newUser = await admin.auth().createUser({
                email,
                emailVerified: true,
                displayName: `エディター (${targetSchoolId})`
            });
            await admin.auth().setCustomUserClaims(newUser.uid, claims);
        }
    }

    return { success: true, message: 'エディターパスワードを設定しました' };
}, (context) => verifyAdmin(context)));
