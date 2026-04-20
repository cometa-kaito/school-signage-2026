/**
 * cleanup-feedback.js
 *
 * feedback コレクションの全ドキュメントを一覧表示し、--execute 指定時に削除する。
 *
 * 使い方:
 *   cd signage/scripts
 *   node cleanup-feedback.js              # ドライラン（一覧表示のみ）
 *   node cleanup-feedback.js --execute    # 実際に削除
 *
 * 注意: serviceAccountKey.json が signage/ ディレクトリにある前提です
 */

const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');

async function main() {
    const snap = await db.collection('feedback').get();
    console.log(`feedback コレクション: ${snap.size} 件`);
    if (snap.empty) {
        console.log('削除対象なし');
        return;
    }
    snap.forEach((doc) => {
        const d = doc.data();
        const ts = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toISOString() : '(no createdAt)';
        console.log(`  - ${doc.id}  ${ts}  ${d.classroomLabel || ''}  ${d.submitterEmail || ''}`);
    });

    if (!EXECUTE) {
        console.log('\n[DRY RUN] 削除するには --execute を付けて再実行してください。');
        return;
    }

    console.log('\n削除を実行します...');
    const batchSize = 400;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += batchSize) {
        const batch = db.batch();
        docs.slice(i, i + batchSize).forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        console.log(`  削除: ${Math.min(i + batchSize, docs.length)} / ${docs.length}`);
    }
    console.log('完了');
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
