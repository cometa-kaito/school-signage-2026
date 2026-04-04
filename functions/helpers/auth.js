/**
 * helpers/auth.js
 * 認証・認可ヘルパー関数
 */

const functions = require('firebase-functions');
const { db } = require('./paths');

function verifyAuth(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'ログインが必要です');
    }
}

function verifyAdmin(context) {
    verifyAuth(context);
    if (!context.auth.token.admin && context.auth.token.systemRole !== 'system_admin') {
        throw new functions.https.HttpsError('permission-denied', '管理者権限が必要です');
    }
}

async function verifySchoolAdmin(context, schoolId) {
    verifyAuth(context);
    if (context.auth.token.admin || context.auth.token.systemRole === 'system_admin') return;
    const membershipId = `${context.auth.uid}_${schoolId}`;
    const snap = await db.collection('memberships').doc(membershipId).get();
    if (!snap.exists || snap.data().role !== 'school_admin') {
        throw new functions.https.HttpsError('permission-denied', 'この学校の管理者権限が必要です');
    }
}

async function verifyClassAccess(context, schoolId, classId) {
    verifyAuth(context);
    if (context.auth.token.admin || context.auth.token.systemRole === 'system_admin') return;
    const membershipId = `${context.auth.uid}_${schoolId}`;
    const snap = await db.collection('memberships').doc(membershipId).get();
    if (!snap.exists) throw new functions.https.HttpsError('permission-denied', 'アクセス権がありません');
    const m = snap.data();
    if (m.role === 'school_admin') return;
    if (['teacher', 'editor'].includes(m.role) && (m.classIds || []).includes(classId)) return;
    throw new functions.https.HttpsError('permission-denied', 'このクラスへのアクセス権がありません');
}

/**
 * withAuth ラッパー
 * 共通の try/catch + HttpsError パターンを処理する
 * @param {Function} handler - async (data, context) => result
 * @param {Function|null} authCheck - (context, data) => void/Promise (省略可)
 * @returns {Function} onCall用ハンドラー
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
