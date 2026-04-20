/**
 * helpers/auth.js
 * 認証・認可ヘルパー関数
 */

const functions = require('firebase-functions');
const { db } = require('./paths');

/**
 * 認証済みか確認。未認証なら HttpsError(unauthenticated) を投げる。
 * @param {import('../types').CallContext} context
 * @throws {functions.https.HttpsError}
 */
function verifyAuth(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'ログインが必要です');
    }
}

/**
 * system_admin か確認。custom claim `admin=true` または `systemRole='system_admin'` が必要。
 * @param {import('../types').CallContext} context
 * @throws {functions.https.HttpsError}
 */
function verifyAdmin(context) {
    verifyAuth(context);
    if (!context.auth.token.admin && context.auth.token.systemRole !== 'system_admin') {
        throw new functions.https.HttpsError('permission-denied', '管理者権限が必要です');
    }
}

/**
 * 指定学校の school_admin か確認。
 * system_admin は無条件で通過。
 * それ以外は membership/{uid}_{schoolId} を参照して role='school_admin' を要求。
 * @param {import('../types').CallContext} context
 * @param {string} schoolId
 * @returns {Promise<void>}
 * @throws {functions.https.HttpsError}
 */
async function verifySchoolAdmin(context, schoolId) {
    verifyAuth(context);
    if (context.auth.token.admin || context.auth.token.systemRole === 'system_admin') return;
    const membershipId = `${context.auth.uid}_${schoolId}`;
    const snap = await db.collection('memberships').doc(membershipId).get();
    if (!snap.exists || snap.data().role !== 'school_admin') {
        throw new functions.https.HttpsError('permission-denied', 'この学校の管理者権限が必要です');
    }
}

/**
 * 指定クラスへのアクセス権があるか確認。
 * school_admin または teacher であれば通過。
 * @param {import('../types').CallContext} context
 * @param {string} schoolId
 * @param {string} _classId - 現状は membership レベルで判定（将来 classIds 限定にする場合に使用）
 * @returns {Promise<void>}
 * @throws {functions.https.HttpsError}
 */
async function verifyClassAccess(context, schoolId, _classId) {
    verifyAuth(context);
    if (context.auth.token.admin || context.auth.token.systemRole === 'system_admin') return;
    const membershipId = `${context.auth.uid}_${schoolId}`;
    const snap = await db.collection('memberships').doc(membershipId).get();
    if (!snap.exists) throw new functions.https.HttpsError('permission-denied', 'アクセス権がありません');
    const m = snap.data();
    if (m.role === 'school_admin' || m.role === 'teacher') return;
    throw new functions.https.HttpsError('permission-denied', 'このクラスへのアクセス権がありません');
}

/**
 * Cloud Function ハンドラーを authCheck + 例外変換でラップする。
 * - authCheck が throw → そのまま伝搬（HttpsError 想定）
 * - handler が HttpsError を throw → そのまま伝搬
 * - handler がそれ以外の例外を throw → HttpsError('internal') に変換
 *
 * @template T, R
 * @param {import('../types').HandlerFn<T, R>} handler
 * @param {import('../types').AuthCheckFn | null} [authCheck]
 * @returns {(data: T, context: import('../types').CallContext) => Promise<R>}
 */
function withAuth(handler, authCheck) {
    return async (data, context) => {
        if (authCheck) {
            await authCheck(context, data);
        }
        try {
            return await handler(data, context);
        } catch (error) {
            if (error instanceof functions.https.HttpsError) throw error;
            console.error(`${handler.name || 'handler'} error:`, error);
            throw new functions.https.HttpsError('internal', error.message);
        }
    };
}

module.exports = {
    verifyAuth,
    verifyAdmin,
    verifySchoolAdmin,
    verifyClassAccess,
    withAuth,
};
