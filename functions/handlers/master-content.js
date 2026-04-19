/**
 * handlers/master-content.js
 * マスターコンテンツのクラスへのコピー機能
 */

const { functions, db, schoolMasterDailyDataPath, gradeMasterDailyDataPath, dailyDataPath } = require('../helpers/paths');
const { verifySchoolAdmin, withAuth } = require('../helpers/auth');
const { validateRequired } = require('../helpers/validation');

/**
 * マスターデータを対象クラスにコピー
 * sourceLevel: 'school' → 学校内全クラス、'grade' → 学年内全クラス
 * contentType: 'schedules' | 'notices' | 'assignments' | 'all'
 */
exports.copyMasterToClasses = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, gradeId, sourceLevel, dateStr, contentType } = data;
    validateRequired(data, ['schoolId', 'sourceLevel', 'dateStr', 'contentType']);

    if (!['school', 'grade'].includes(sourceLevel)) {
        throw new functions.https.HttpsError('invalid-argument', 'sourceLevelは school または grade を指定してください');
    }
    if (!['schedules', 'notices', 'assignments', 'all'].includes(contentType)) {
        throw new functions.https.HttpsError('invalid-argument', '無効なcontentTypeです');
    }

    // マスターデータを取得
    let masterRef;
    if (sourceLevel === 'school') {
        masterRef = schoolMasterDailyDataPath(schoolId).doc(dateStr);
    } else {
        validateRequired(data, ['gradeId']);
        masterRef = gradeMasterDailyDataPath(schoolId, gradeId).doc(dateStr);
    }

    const masterSnap = await masterRef.get();
    if (!masterSnap.exists) {
        throw new functions.https.HttpsError('not-found', '指定日のマスターデータが見つかりません');
    }
    const masterData = masterSnap.data();

    // コピー対象のフィールドを決定
    const fields = contentType === 'all'
        ? ['schedules', 'notices', 'assignments']
        : [contentType];

    // コピー対象のアイテムに _source タグを付与
    const taggedItems = {};
    for (const field of fields) {
        const items = masterData[field] || [];
        if (items.length > 0) {
            taggedItems[field] = items.map(item => ({
                ...item,
                _source: `${sourceLevel}_copy`,
                _masterDate: dateStr
            }));
        }
    }

    if (Object.keys(taggedItems).length === 0) {
        return { success: true, message: 'コピー対象のデータがありません', classCount: 0 };
    }

    // 対象クラスを取得
    let targetClasses = [];
    if (sourceLevel === 'school') {
        // 学校内全学年の全クラス
        const gradesSnap = await db.collection('schools').doc(schoolId).collection('grades').get();
        for (const gradeDoc of gradesSnap.docs) {
            const classesSnap = await db.collection('schools').doc(schoolId)
                .collection('grades').doc(gradeDoc.id).collection('classes').get();
            classesSnap.docs.forEach(c => {
                targetClasses.push({ gradeId: gradeDoc.id, classId: c.id });
            });
        }
    } else {
        // 学年内全クラス
        const classesSnap = await db.collection('schools').doc(schoolId)
            .collection('grades').doc(gradeId).collection('classes').get();
        classesSnap.docs.forEach(c => {
            targetClasses.push({ gradeId, classId: c.id });
        });
    }

    // バッチ書き込み（450ドキュメント制限に注意）
    let batch = db.batch();
    let batchCount = 0;
    const BATCH_LIMIT = 450;

    for (const target of targetClasses) {
        const classDocRef = dailyDataPath(schoolId, target.gradeId, target.classId).doc(dateStr);
        const classSnap = await classDocRef.get();
        const existingData = classSnap.exists ? classSnap.data() : { date: dateStr };

        // 各フィールドにアイテムを追加
        for (const field of Object.keys(taggedItems)) {
            const existingList = existingData[field] || [];
            existingData[field] = [...existingList, ...taggedItems[field]];
        }

        batch.set(classDocRef, existingData, { merge: true });
        batchCount++;

        if (batchCount >= BATCH_LIMIT) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }

    if (batchCount > 0) {
        await batch.commit();
    }

    return {
        success: true,
        message: `${targetClasses.length}クラスにコピーしました`,
        classCount: targetClasses.length
    };
}, (context, data) => verifySchoolAdmin(context, data.schoolId)));
