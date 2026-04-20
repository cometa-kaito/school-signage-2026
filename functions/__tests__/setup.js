// Test setup — firebase-admin を最小初期化しておく
// paths.js が admin.firestore() と admin.storage().bucket() を即時呼び出すため、
// 実際の接続はせず "default app" だけ存在させる。

import admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'test-project',
        storageBucket: 'test-bucket.appspot.com',
    });
}
