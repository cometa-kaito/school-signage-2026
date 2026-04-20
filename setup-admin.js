// setup-admin.js
// 初回の管理者ユーザーにカスタムクレームを設定するスクリプト
//
// 使用方法:
// 1. Firebase コンソールからサービスアカウントキーをダウンロード
// 2. リポジトリ外の安全な場所に保存（例: ~/.kimiterrace-credentials/serviceAccountKey.json）
// 3. 環境変数を設定:
//      export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.kimiterrace-credentials/serviceAccountKey.json"
//    または ADMIN_EMAIL と KIMITERRACE_CREDENTIALS_PATH を個別に設定
// 4. npm install firebase-admin
// 5. node setup-admin.js [add|remove|list] [email]

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ========================================
// 設定（環境変数から読み込み）
// ========================================

// 管理者に設定するメールアドレス
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

// サービスアカウントキーの解決順序:
//  1. GOOGLE_APPLICATION_CREDENTIALS (Google 標準)
//  2. KIMITERRACE_CREDENTIALS_PATH (プロジェクト固有)
//  3. ~/.kimiterrace-credentials/serviceAccountKey.json (デフォルト)
function resolveCredentialsPath() {
    const candidates = [
        process.env.GOOGLE_APPLICATION_CREDENTIALS,
        process.env.KIMITERRACE_CREDENTIALS_PATH,
        path.join(os.homedir(), '.kimiterrace-credentials', 'serviceAccountKey.json')
    ].filter(Boolean);

    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

// ========================================
// 初期化
// ========================================

const credentialsPath = resolveCredentialsPath();

if (!credentialsPath) {
    console.error('❌ エラー: サービスアカウントキーが見つかりません');
    console.log('');
    console.log('以下の手順でサービスアカウントキーを取得して安全に配置してください：');
    console.log('1. Firebase コンソール (https://console.firebase.google.com/) にアクセス');
    console.log('2. プロジェクトの設定 → サービスアカウント');
    console.log('3. 「新しい秘密鍵の生成」をクリック');
    console.log('4. ダウンロードしたJSONを **リポジトリ外** に保存');
    console.log('   推奨パス: ~/.kimiterrace-credentials/serviceAccountKey.json');
    console.log('5. 環境変数 GOOGLE_APPLICATION_CREDENTIALS にフルパスを設定');
    process.exit(1);
}

if (!ADMIN_EMAIL) {
    console.error('❌ エラー: 環境変数 ADMIN_EMAIL が未設定です');
    console.log('例: ADMIN_EMAIL=admin@example.com node setup-admin.js');
    process.exit(1);
}

let serviceAccount;
try {
    serviceAccount = require(credentialsPath);
} catch (error) {
    console.error(`❌ サービスアカウントキーの読み込みに失敗: ${credentialsPath}`);
    console.error(error.message);
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// ========================================
// 管理者設定関数
// ========================================

async function setAdminRole(email) {
    try {
        console.log(`🔍 ユーザーを検索中: ${email}`);
        
        // ユーザーを取得
        const user = await admin.auth().getUserByEmail(email);
        console.log(`✅ ユーザーが見つかりました`);
        console.log(`   UID: ${user.uid}`);
        console.log(`   メール: ${user.email}`);
        console.log(`   メール確認: ${user.emailVerified ? '済み' : '未確認'}`);
        
        // 現在のカスタムクレームを確認
        const currentClaims = user.customClaims || {};
        console.log(`   現在のクレーム:`, currentClaims);
        
        // 管理者クレームを設定
        await admin.auth().setCustomUserClaims(user.uid, {
            ...currentClaims,
            admin: true,
            systemRole: 'system_admin'
        });
        
        console.log('');
        console.log('🎉 管理者権限を付与しました！');
        console.log('');
        console.log('⚠️ 注意: ユーザーは再ログインが必要です');
        console.log('   新しいIDトークンを取得するために、一度ログアウトしてから再ログインしてください。');
        
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            console.error(`❌ エラー: ユーザー ${email} が見つかりません`);
            console.log('');
            console.log('Firebase Authentication でユーザーを作成してから再実行してください：');
            console.log('1. Firebase コンソール → Authentication → Users');
            console.log('2. 「ユーザーを追加」をクリック');
            console.log(`3. メールアドレス: ${email}`);
            console.log('4. パスワードを設定して追加');
        } else {
            console.error('❌ エラー:', error.message);
        }
    }
}

async function listAdmins() {
    console.log('📋 管理者一覧を取得中...');
    console.log('');
    
    const listResult = await admin.auth().listUsers(100);
    const admins = listResult.users.filter(user => 
        user.customClaims && user.customClaims.admin === true
    );
    
    if (admins.length === 0) {
        console.log('管理者ユーザーはまだいません');
    } else {
        console.log(`管理者ユーザー (${admins.length}人):`);
        admins.forEach(user => {
            console.log(`  - ${user.email} (UID: ${user.uid})`);
        });
    }
}

async function removeAdminRole(email) {
    try {
        const user = await admin.auth().getUserByEmail(email);
        const currentClaims = user.customClaims || {};
        delete currentClaims.admin;
        
        await admin.auth().setCustomUserClaims(user.uid, currentClaims);
        console.log(`✅ ${email} の管理者権限を削除しました`);
    } catch (error) {
        console.error('❌ エラー:', error.message);
    }
}

// ========================================
// メイン処理
// ========================================

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
        case 'list':
            await listAdmins();
            break;
            
        case 'remove':
            const removeEmail = args[1] || ADMIN_EMAIL;
            await removeAdminRole(removeEmail);
            break;
            
        case 'add':
        default:
            const addEmail = args[1] || ADMIN_EMAIL;
            await setAdminRole(addEmail);
            break;
    }
    
    process.exit(0);
}

// 使用方法を表示
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('使用方法:');
    console.log('  node setup-admin.js [command] [email]');
    console.log('');
    console.log('コマンド:');
    console.log('  add [email]    - 管理者権限を付与（デフォルト）');
    console.log('  remove [email] - 管理者権限を削除');
    console.log('  list           - 管理者一覧を表示');
    console.log('');
    console.log('例:');
    console.log('  node setup-admin.js add admin@example.com');
    console.log('  node setup-admin.js list');
    process.exit(0);
}

main();