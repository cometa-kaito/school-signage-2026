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

const PASSWORD_MIN_LENGTH = 8;

/**
 * パスワード強度を検証し、不適切なら HttpsError を投げる。
 * 要件: 8文字以上 / 英字と数字を両方含む / 空白のみ不可。
 *
 * @param {unknown} password
 * @throws {functions.https.HttpsError}
 */
function validatePasswordStrength(password) {
    if (typeof password !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'パスワードを入力してください');
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            `パスワードは${PASSWORD_MIN_LENGTH}文字以上必要です`
        );
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'パスワードは英字と数字の両方を含む必要があります'
        );
    }
    if (/^\s*$/.test(password)) {
        throw new functions.https.HttpsError('invalid-argument', 'パスワードに空白のみは使えません');
    }
}

module.exports = {
    ERROR_MESSAGES,
    PASSWORD_MIN_LENGTH,
    getErrorMessage,
    validateRequired,
    preventSelfAction,
    validatePasswordStrength,
};
