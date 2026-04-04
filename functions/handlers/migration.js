/**
 * handlers/migration.js
 * データマイグレーション: 旧classes → grades/classes
 */

const functions = require('firebase-functions');
const { admin, db, DEFAULT_SCHOOL_ID } = require('../helpers/paths');
const { verifyAdmin, withAuth } = require('../helpers/auth');

exports.migrateToGradeStructure = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId } = data;
    const targetSchoolId = schoolId || DEFAULT_SCHOOL_ID;

    // 1. 旧classesを取得
    const oldClassesSnap = await db.collection('schools').doc(targetSchoolId)
        .collection('classes').get();

    if (oldClassesSnap.empty) {
        return { success: false, message: '移行対象のクラスがありません' };
    }

    // 2. gradeフィールドでグルーピング
    const gradeGroups = {};
    oldClassesSnap.forEach(doc => {
        const data = doc.data();
        const gradeName = data.grade || data.name || 'デフォルト';
        if (!gradeGroups[gradeName]) gradeGroups[gradeName] = [];
        gradeGroups[gradeName].push({ id: doc.id, ...data });
    });

    let totalClasses = 0;
    let totalDays = 0;
    const results = [];

    // 3. 各学年グループに対して移行
    let order = 0;
    for (const [gradeName, classes] of Object.entries(gradeGroups)) {
        // 学年を作成
        const gradeRef = db.collection('schools').doc(targetSchoolId).collection('grades').doc();
        await gradeRef.set({
            name: gradeName, order: order++,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        for (const oldClass of classes) {
            // クラスを新パスに作成
            const newClassRef = gradeRef.collection('classes').doc();
            await newClassRef.set({
                name: oldClass.name,
                displaySettings: oldClass.displaySettings || { ads: [], quietHours: [] },
                schoolName: oldClass.schoolName || '',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // daily_dataをコピー
            const dailySnap = await db.collection('schools').doc(targetSchoolId)
                .collection('classes').doc(oldClass.id)
                .collection('daily_data').get();

            const batchSize = 450;
            let batch = db.batch();
            let batchCount = 0;

            for (const dayDoc of dailySnap.docs) {
                batch.set(newClassRef.collection('daily_data').doc(dayDoc.id), dayDoc.data());
                batchCount++;
                totalDays++;
                if (batchCount >= batchSize) {
                    await batch.commit();
                    batch = db.batch();
                    batchCount = 0;
                }
            }
            if (batchCount > 0) await batch.commit();

            totalClasses++;
            results.push(`${gradeName} > ${oldClass.name} (${dailySnap.size}日分)`);
        }
    }

    return {
        success: true, message: `${totalClasses}クラス, ${totalDays}日分のデータを移行しました`,
        details: results
    };
}, (context) => verifyAdmin(context)));
