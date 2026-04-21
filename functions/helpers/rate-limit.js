/**
 * helpers/rate-limit.js
 * Firestoreベースのスライディングウィンドウ式レートリミット。
 *
 * 保存先: auth_rate_limit/{key}
 *   - attempts: number
 *   - windowStartAt: Timestamp
 *   - blockedUntil: Timestamp | null
 *
 * 外部Redisに依存しない簡易実装。低頻度のログイン試行向け。
 */

const crypto = require('crypto');
const functions = require('firebase-functions');
const { db, admin } = require('./paths');

const COLLECTION = 'auth_rate_limit';

/**
 * Cloud Functions の context から呼び出し元IPを取得する。
 * 取れない場合は 'unknown' を返す。
 * @param {import('../types').CallContext} context
 * @returns {string}
 */
function getClientIp(context) {
    const req = context.rawRequest;
    if (!req) return 'unknown';
    const xff = req.headers && req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
        return xff.split(',')[0].trim();
    }
    if (Array.isArray(xff) && xff.length > 0) {
        return String(xff[0]).split(',')[0].trim();
    }
    return req.ip || 'unknown';
}

/**
 * プライバシー保護のためIPをハッシュ化。
 * @param {string} value
 * @returns {string}
 */
function hashValue(value) {
    return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 32);
}

/**
 * レートリミットを消費（試行を記録）する。
 * ブロック中なら HttpsError('resource-exhausted') を throw。
 *
 * @param {{
 *   key: string,
 *   maxAttempts?: number,
 *   windowMs?: number,
 *   blockMs?: number,
 * }} opts
 * @returns {Promise<FirebaseFirestore.DocumentReference>}
 */
async function consumeRateLimit({
    key,
    maxAttempts = 5,
    windowMs = 5 * 60 * 1000,
    blockMs = 15 * 60 * 1000,
}) {
    const ref = db.collection(COLLECTION).doc(key);
    const now = Date.now();

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists ? snap.data() : {};

        const blockedUntil = data.blockedUntil && data.blockedUntil.toMillis
            ? data.blockedUntil.toMillis()
            : 0;
        if (blockedUntil && now < blockedUntil) {
            const remainingSec = Math.ceil((blockedUntil - now) / 1000);
            throw new functions.https.HttpsError(
                'resource-exhausted',
                `試行回数が多すぎます。${remainingSec}秒後にやり直してください。`
            );
        }

        const windowStartAt = data.windowStartAt && data.windowStartAt.toMillis
            ? data.windowStartAt.toMillis()
            : 0;
        const windowExpired = !windowStartAt || (now - windowStartAt) > windowMs;
        const attempts = windowExpired ? 1 : (data.attempts || 0) + 1;

        const update = {
            attempts,
            windowStartAt: windowExpired
                ? admin.firestore.FieldValue.serverTimestamp()
                : data.windowStartAt,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (attempts >= maxAttempts) {
            update.blockedUntil = admin.firestore.Timestamp.fromMillis(now + blockMs);
        } else {
            update.blockedUntil = null;
        }

        tx.set(ref, update, { merge: true });
    });

    return ref;
}

/**
 * 成功時にカウンタをリセット。
 * @param {string} key
 */
async function resetRateLimit(key) {
    const ref = db.collection(COLLECTION).doc(key);
    try {
        await ref.set({
            attempts: 0,
            blockedUntil: null,
            windowStartAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    } catch (_) { /* 記録失敗は致命的ではない */ }
}

module.exports = {
    getClientIp,
    hashValue,
    consumeRateLimit,
    resetRateLimit,
};
