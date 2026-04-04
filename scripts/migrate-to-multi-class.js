/**
 * migrate-to-multi-class.js
 *
 * 旧構造のデータを新しいクラス単位の構造に移行するスクリプト
 *
 * 旧構造:
 *   schools/{schoolId}/config/display_settings
 *   schools/{schoolId}/daily_data/{dateId}
 *
 * 新構造:
 *   schools/{schoolId}/classes/{classId}
 *   schools/{schoolId}/classes/{classId}/daily_data/{dateId}
 *
 * 使い方:
 *   cd signage/scripts
 *   node migrate-to-multi-class.js [schoolId]
 *
 * 注意: serviceAccountKey.json が signage/ ディレクトリにある前提です
 */

const admin = require('firebase-admin');
const path = require('path');

// Firebase Admin初期化
const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'school-signage-2026.firebasestorage.app'
});

const db = admin.firestore();

const SCHOOL_ID = process.argv[2] || 'gn_tech';

async function migrate() {
    console.log(`=== マイグレーション開始: school=${SCHOOL_ID} ===\n`);

    // 1. 旧設定を取得
    console.log('1. 旧設定を取得中...');
    const configSnap = await db.collection('schools').doc(SCHOOL_ID)
        .collection('config').doc('display_settings').get();
    const config = configSnap.exists ? configSnap.data() : {};
    console.log(`   school_name: ${config.school_name || '(未設定)'}`);
    console.log(`   class_name: ${config.class_name || '(未設定)'}`);
    console.log(`   ads: ${(config.ads || []).length}件`);
    console.log(`   quiet_hours: ${(config.quiet_hours || []).length}件`);

    // 2. クラスを作成
    console.log('\n2. クラスを作成中...');
    const classRef = db.collection('schools').doc(SCHOOL_ID).collection('classes').doc();
    const classData = {
        name: config.class_name || '1組',
        grade: '',
        schoolName: config.school_name || '',
        displaySettings: {
            ads: config.ads || [],
            quietHours: config.quiet_hours || []
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await classRef.set(classData);
    console.log(`   作成完了: classId=${classRef.id}, name=${classData.name}`);

    // 3. 旧daily_dataを新構造にコピー
    console.log('\n3. daily_dataを移行中...');
    const dailySnap = await db.collection('schools').doc(SCHOOL_ID)
        .collection('daily_data').get();

    let count = 0;
    const batchSize = 450; // Firestoreのバッチ制限は500
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of dailySnap.docs) {
        const newRef = db.collection('schools').doc(SCHOOL_ID)
            .collection('classes').doc(classRef.id)
            .collection('daily_data').doc(doc.id);
        batch.set(newRef, doc.data());
        count++;
        batchCount++;

        if (batchCount >= batchSize) {
            await batch.commit();
            console.log(`   ${count}件コミット済み...`);
            batch = db.batch();
            batchCount = 0;
        }
    }

    if (batchCount > 0) {
        await batch.commit();
    }
    console.log(`   移行完了: ${count}日分のデータ`);

    // 4. 既存adminユーザーのメンバーシップを作成
    console.log('\n4. メンバーシップを作成中...');
    const adminUsers = await admin.auth().listUsers(100);
    let memberCount = 0;

    for (const user of adminUsers.users) {
        if (user.customClaims?.admin === true) {
            const membershipId = `${user.uid}_${SCHOOL_ID}`;
            const existing = await db.collection('memberships').doc(membershipId).get();
            if (!existing.exists) {
                await db.collection('memberships').doc(membershipId).set({
                    userId: user.uid,
                    schoolId: SCHOOL_ID,
                    role: 'school_admin',
                    classIds: [],
                    grantedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`   ${user.email} -> school_admin`);
                memberCount++;
            } else {
                console.log(`   ${user.email} -> 既に存在（スキップ）`);
            }

            // systemRole claimも追加
            const currentClaims = user.customClaims || {};
            if (!currentClaims.systemRole) {
                await admin.auth().setCustomUserClaims(user.uid, {
                    ...currentClaims,
                    systemRole: 'system_admin'
                });
                console.log(`   ${user.email} -> systemRole=system_admin を付与`);
            }
        }
    }
    console.log(`   ${memberCount}件の新規メンバーシップを作成`);

    // 5. 学校ドキュメントにownerId追加（なければ）
    console.log('\n5. 学校ドキュメントを更新中...');
    const schoolSnap = await db.collection('schools').doc(SCHOOL_ID).get();
    if (schoolSnap.exists) {
        const schoolData = schoolSnap.data();
        if (!schoolData.name) {
            await db.collection('schools').doc(SCHOOL_ID).update({
                name: config.school_name || SCHOOL_ID,
                plan: 'free',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log('   学校ドキュメントを更新しました');
        } else {
            console.log('   学校ドキュメントは既に設定済み');
        }
    } else {
        await db.collection('schools').doc(SCHOOL_ID).set({
            name: config.school_name || SCHOOL_ID,
            plan: 'free',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('   学校ドキュメントを新規作成しました');
    }

    console.log('\n=== マイグレーション完了 ===');
    console.log(`学校: ${SCHOOL_ID}`);
    console.log(`クラスID: ${classRef.id}`);
    console.log(`移行データ: ${count}日分`);
    console.log(`メンバーシップ: ${memberCount}件新規作成`);
    console.log(`\nサイネージURL例:`);
    console.log(`  https://school-signage-2026.web.app/?school=${SCHOOL_ID}&class=${classRef.id}&kiosk=1`);

    process.exit(0);
}

migrate().catch(error => {
    console.error('マイグレーションエラー:', error);
    process.exit(1);
});
