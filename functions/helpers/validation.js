/**
 * helpers/validation.js
 * バリデーション・エラーメッセージヘルパー
 */

const functions = require('firebase-functions');

const ERROR_MESSAGES = {
    'auth/email-already-exists': 'このメールアドレスは既に使用されています',
    'auth/invalid-email': 'メールアドレスの形式が正しくありません',
    'auth/weak-password': 'パスワードが弱すぎます',
};

function getErrorMessage(error) {
    return ERROR_MESSAGES[error.code] || error.message;
}

function validateRequired(data, fields) {
    for (const f of fields) {
        if (!data[f]) throw new functions.https.HttpsError('invalid-argument', `${f}は必須です`);
    }
}

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
