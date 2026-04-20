/**
 * helpers/validation.js
 * バリデーション・エラーメッセージヘルパー
 */

const functions = require('firebase-functions');

/** @type {Record<string, string>} */
const ERROR_MESSAGES = {
    'auth/email-already-exists': 'このメールアドレスは既に使用されています',
    'auth/invalid-email': 'メールアドレスの形式が正しくありません',
    'auth/weak-password': 'パスワードが弱すぎます',
};

/**
 * Firebase エラーを日本語メッセージに変換する。
 * 既知コードでなければ error.message をそのまま返す。
 * @param {{ code?: string; message?: string }} error
 * @returns {string}
 */
function getErrorMessage(error) {
    return ERROR_MESSAGES[error.code] || error.message;
}

/**
 * 必須フィールドが全て truthy かチェックし、欠けていれば HttpsError を投げる。
 * @param {Record<string, unknown>} data
 * @param {string[]} fields
 * @throws {functions.https.HttpsError}
 */
function validateRequired(data, fields) {
    for (const f of fields) {
        if (!data[f]) throw new functions.https.HttpsError('invalid-argument', `${f}は必須です`);
    }
}

/**
 * 自分自身を対象にした操作を防ぐ（自分の管理者権限剥奪や削除など）。
 * @param {string} targetUid
 * @param {string} currentUid
 * @param {string} action 「削除」「無効化」など動詞
 * @throws {functions.https.HttpsError}
 */
function preventSelfAction(targetUid, currentUid, action) {
    if (targetUid === currentUid) {
        throw new functions.https.HttpsError('failed-precondition', `自分自身を${action}することはできません`);
    }
}

module.exports = {
    ERROR_MESSAGES,
    getErrorMessage,
    validateRequired,
    preventSelfAction,
};
