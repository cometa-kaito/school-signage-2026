/**
 * functions/index.js
 * 管理者ユーザー管理用 Cloud Functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// ========================================
// エラーメッセージ定義
// ========================================

const ERROR_MESSAGES = {
    'auth/email-already-exists': 'このメールアドレスは既に使用されています',
    'auth/invalid-email': 'メールアドレスの形式が正しくありません',
    'auth/weak-password': 'パスワードが弱すぎます',
};

/**
 * Firebase Authエラーを日本語メッセージに変換
 * @param {Error} error 
 * @returns {string}
 */
function getErrorMessage(error) {
    return ERROR_MESSAGES[error.code] || error.message;
}

// ========================================
// ヘルパー関数
// ========================================

/**
 * リクエストが認証済みの管理者からのものか確認
 * @param {Object} context - Cloud Functionsのコンテキスト
 * @throws {functions.https.HttpsError}
 */
function verifyAdmin(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'ログインが必要です'
        );
    }
    
    if (!context.auth.token.admin) {
        throw new functions.https.HttpsError(
            'permission-denied',
            '管理者権限が必要です'
        );
    }
}

/**
 * 必須パラメータの検証
 * @param {Object} data - リクエストデータ
 * @param {string[]} requiredFields - 必須フィールド名の配列
 * @throws {functions.https.HttpsError}
 */
function validateRequired(data, requiredFields) {
    for (const field of requiredFields) {
        if (!data[field]) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                `${field}は必須です`
            );
        }
    }
}

/**
 * 自分自身への操作を防止
 * @param {string} targetUid - 対象ユーザーのUID
 * @param {string} currentUid - 現在のユーザーのUID
 * @param {string} action - 操作名
 * @throws {functions.https.HttpsError}
 */
function preventSelfAction(targetUid, currentUid, action) {
    if (targetUid === currentUid) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            `自分自身を${action}することはできません`
        );
    }
}

// ========================================
// ユーザー一覧取得
// ========================================

exports.listUsers = functions.https.onCall(async (data, context) => {
    verifyAdmin(context);
    
    try {
        const listResult = await admin.auth().listUsers(100);
        
        const users = listResult.users.map(user => ({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || '',
            emailVerified: user.emailVerified,
            disabled: user.disabled,
            isAdmin: user.customClaims?.admin === true,
            creationTime: user.metadata.creationTime,
            lastSignInTime: user.metadata.lastSignInTime
        }));
        
        return { users };
    } catch (error) {
        console.error('listUsers error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// ========================================
// ユーザー作成
// ========================================

exports.createAdminUser = functions.https.onCall(async (data, context) => {
    verifyAdmin(context);
    
    const { email, password, displayName, setAsAdmin } = data;
    
    validateRequired(data, ['email', 'password']);
    
    if (password.length < 6) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'パスワードは6文字以上必要です'
        );
    }
    
    try {
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: displayName || '',
            emailVerified: true  // 管理者が作成したユーザーは検証済みとする
        });
        
        if (setAsAdmin) {
            await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });
        }
        
        return {
            success: true,
            message: `ユーザー ${email} を作成しました`,
            uid: userRecord.uid
        };
    } catch (error) {
        console.error('createAdminUser error:', error);
        throw new functions.https.HttpsError('internal', getErrorMessage(error));
    }
});

// ========================================
// 管理者権限の付与/削除
// ========================================

exports.setAdminRole = functions.https.onCall(async (data, context) => {
    verifyAdmin(context);
    
    const { uid, isAdmin } = data;
    
    validateRequired(data, ['uid']);
    
    if (!isAdmin) {
        preventSelfAction(uid, context.auth.uid, '管理者権限を削除');
    }
    
    try {
        const user = await admin.auth().getUser(uid);
        const currentClaims = user.customClaims || {};
        
        if (isAdmin) {
            await admin.auth().setCustomUserClaims(uid, { ...currentClaims, admin: true });
        } else {
            const { admin: _, ...restClaims } = currentClaims;
            await admin.auth().setCustomUserClaims(uid, restClaims);
        }
        
        const action = isAdmin ? '付与' : '削除';
        return {
            success: true,
            message: `${user.email} の管理者権限を${action}しました`
        };
    } catch (error) {
        console.error('setAdminRole error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// ========================================
// ユーザー情報更新
// ========================================

exports.updateUser = functions.https.onCall(async (data, context) => {
    verifyAdmin(context);
    
    const { uid, email, displayName, password } = data;
    
    validateRequired(data, ['uid']);
    
    try {
        const updateData = {};
        
        if (email) updateData.email = email;
        if (displayName !== undefined) updateData.displayName = displayName;
        if (password && password.length >= 6) updateData.password = password;
        
        if (Object.keys(updateData).length === 0) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                '更新するデータがありません'
            );
        }
        
        await admin.auth().updateUser(uid, updateData);
        
        return {
            success: true,
            message: 'ユーザー情報を更新しました'
        };
    } catch (error) {
        console.error('updateUser error:', error);
        throw new functions.https.HttpsError('internal', getErrorMessage(error));
    }
});

// ========================================
// ユーザー削除
// ========================================

exports.deleteUser = functions.https.onCall(async (data, context) => {
    verifyAdmin(context);
    
    const { uid } = data;
    
    validateRequired(data, ['uid']);
    preventSelfAction(uid, context.auth.uid, '削除');
    
    try {
        const user = await admin.auth().getUser(uid);
        const email = user.email;
        
        await admin.auth().deleteUser(uid);
        
        return {
            success: true,
            message: `ユーザー ${email} を削除しました`
        };
    } catch (error) {
        console.error('deleteUser error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// ========================================
// ユーザーの有効/無効切り替え
// ========================================

exports.toggleUserStatus = functions.https.onCall(async (data, context) => {
    verifyAdmin(context);
    
    const { uid, disabled } = data;
    
    validateRequired(data, ['uid']);
    
    if (disabled) {
        preventSelfAction(uid, context.auth.uid, '無効化');
    }
    
    try {
        await admin.auth().updateUser(uid, { disabled });
        
        const user = await admin.auth().getUser(uid);
        const action = disabled ? '無効化' : '有効化';
        
        return {
            success: true,
            message: `${user.email} を${action}しました`
        };
    } catch (error) {
        console.error('toggleUserStatus error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// ========================================
// メール検証ステータスの更新
// ========================================

exports.setEmailVerified = functions.https.onCall(async (data, context) => {
    verifyAdmin(context);
    
    const { uid, verified } = data;
    
    validateRequired(data, ['uid']);
    
    try {
        await admin.auth().updateUser(uid, { 
            emailVerified: verified !== false  // デフォルトはtrue
        });
        
        const user = await admin.auth().getUser(uid);
        const status = user.emailVerified ? '確認済み' : '未確認';
        
        return {
            success: true,
            message: `${user.email} のメール検証ステータスを「${status}」に更新しました`
        };
    } catch (error) {
        console.error('setEmailVerified error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});