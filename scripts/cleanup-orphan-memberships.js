/**
 * cleanup-orphan-memberships.js
 *
 * 存在しない学校を指す memberships を検出し、--execute 指定時に削除する。
 *
 * 使い方:
 *   cd signage/scripts
 *   node cleanup-orphan-memberships.js                 # ドライラン（一覧表示のみ）
 *   node cleanup-orphan-memberships.js --execute       # 実際に削除
 *   node cleanup-orphan-memberships.js --school gn_tech           # 特定schoolIdの孤児のみ表示
 *   node cleanup-orphan-memberships.js --school gn_tech --execute # 特定schoolIdの孤児を削除
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
const schoolFlagIdx = args.indexOf('--school');
const TARGET_SCHOOL_ID = schoolFlagIdx >= 0 ? args[schoolFlagIdx + 1] : null;

async function main() {
    console.log(`=== 孤児membershipsクリーンアップ ===`);
    console.log(`モード: ${EXECUTE ? '実行（削除）' : 'ドライラン'}`);
    if (TARGET_SCHOOL_ID) console.log(`対象schoolId: ${TARGET_SCHOOL_ID}`);
    console.log('');

    const [schoolsSnap, membershipsSnap] = await Promise.all([
        db.collection('schools').get(),
        db.collection('memberships').get(),
    ]);

    const existingSchoolIds = new Set();
    schoolsSnap.forEach(doc => existingSchoolIds.add(doc.id));
    console.log(`既存の学校: ${existingSchoolIds.size}件 [${[...existingSchoolIds].join(', ')}]`);
    console.log(`memberships総数: ${membershipsSnap.size}件`);
    console.log('');

    const orphans = [];
    membershipsSnap.forEach(doc => {
        const data = doc.data();
        const { userId, schoolId, role } = data;
        if (!schoolId) return;
        if (existingSchoolIds.has(schoolId)) return;
        if (TARGET_SCHOOL_ID && schoolId !== TARGET_SCHOOL_ID) return;
        orphans.push({ id: doc.id, ref: doc.ref, userId, schoolId, role });
    });

    if (orphans.length === 0) {
        console.log('孤児membershipは見つかりませんでした。');
        return;
    }

    console.log(`孤児membership: ${orphans.length}件`);
    orphans.forEach(o => {
        console.log(`  - ${o.id}  (userId=${o.userId}, schoolId=${o.schoolId}, role=${o.role})`);
    });
    console.log('');

    if (!EXECUTE) {
        console.log('ドライランのため削除はしていません。実行するには --execute を付けてください。');
        return;
    }

    console.log('削除を実行します...');
    const batchSize = 400;
    for (let i = 0; i < orphans.length; i += batchSize) {
        const batch = db.batch();
        orphans.slice(i, i + batchSize).forEach(o => batch.delete(o.ref));
        await batch.commit();
    }
    console.log(`${orphans.length}件の孤児membershipを削除しました。`);
}

main().then(() => process.exit(0)).catch(err => {
    console.error('エラー:', err);
    process.exit(1);
});
