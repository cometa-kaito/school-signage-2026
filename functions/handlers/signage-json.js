/**
 * handlers/signage-json.js
 * サイネージデータJSON生成
 * パス: schools/{schoolId}/grades/{gradeId}/classes/{classId}/daily_data
 * 保存: signage-data/{schoolId}/{gradeId}/{classId}/data.json
 */

const functions = require('firebase-functions');
const { db, bucket, classPath, dailyDataPath, schoolMasterDailyDataPath, gradeMasterDailyDataPath, formatDate } = require('../helpers/paths');
const { verifyAdmin, withAuth } = require('../helpers/auth');
const { validateRequired } = require('../helpers/validation');

/**
 * 3階層（学校マスター・学年マスター・クラス）のデータをマージして配列にソース情報を付与
 */
function mergeArraysWithSource(schoolItems, gradeItems, classItems, field) {
    const addSource = (items, source) => (items || []).map(item => ({
        ...item,
        _source: item._source || source
    }));
    return [
        ...addSource(schoolItems, 'school'),
        ...addSource(gradeItems, 'grade'),
        ...addSource(classItems, 'class')
    ];
}

async function generateClassSignageJson(schoolId, gradeId, classId) {
    try {
        console.log(`Generating signage JSON: school=${schoolId}, grade=${gradeId}, class=${classId}`);

        const classSnap = await classPath(schoolId, gradeId, classId).get();
        const classData = classSnap.exists ? classSnap.data() : {};

        // 学年名を取得
        const gradeSnap = await db.collection('schools').doc(schoolId)
            .collection('grades').doc(gradeId).get();
        const gradeName = gradeSnap.exists ? (gradeSnap.data().name || '') : '';

        const today = new Date();
        const fiveDaysAgo = new Date(today); fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        const tenDaysLater = new Date(today); tenDaysLater.setDate(tenDaysLater.getDate() + 10);

        const dateQuery = (ref) => ref
            .where('date', '>=', formatDate(fiveDaysAgo))
            .where('date', '<=', formatDate(tenDaysLater))
            .orderBy('date', 'asc').get();

        // 3階層を並行取得
        const [schoolMasterSnap, gradeMasterSnap, classSnap_] = await Promise.all([
            dateQuery(schoolMasterDailyDataPath(schoolId)),
            dateQuery(gradeMasterDailyDataPath(schoolId, gradeId)),
            dateQuery(dailyDataPath(schoolId, gradeId, classId))
        ]);

        // 各階層のデータをマップに変換
        const schoolMasterData = {};
        schoolMasterSnap.forEach(d => { schoolMasterData[d.id] = d.data(); });

        const gradeMasterData = {};
        gradeMasterSnap.forEach(d => { gradeMasterData[d.id] = d.data(); });

        const classRawData = {};
        classSnap_.forEach(d => { classRawData[d.id] = d.data(); });

        // 全日付キーを統合
        const allDates = new Set([
            ...Object.keys(schoolMasterData),
            ...Object.keys(gradeMasterData),
            ...Object.keys(classRawData)
        ]);

        // マージ
        const dailyData = {};
        for (const dateKey of allDates) {
            const school = schoolMasterData[dateKey] || {};
            const grade = gradeMasterData[dateKey] || {};
            const cls = classRawData[dateKey] || {};

            dailyData[dateKey] = {
                date: dateKey,
                schedules: mergeArraysWithSource(school.schedules, grade.schedules, cls.schedules, 'schedules'),
                notices: mergeArraysWithSource(school.notices, grade.notices, cls.notices, 'notices'),
                assignments: mergeArraysWithSource(school.assignments, grade.assignments, cls.assignments, 'assignments')
            };
        }

        const displaySettings = classData.displaySettings || {};
        const signageData = {
            generatedAt: new Date().toISOString(), schoolId, gradeId, classId,
            config: {
                schoolName: classData.schoolName || '',
                gradeName: gradeName,
                className: classData.name || '',
                ads: displaySettings.ads || [],
                quietHours: displaySettings.quietHours || []
            },
            dailyData
        };

        const fileName = `signage-data/${schoolId}/${gradeId}/${classId}/data.json`;
        const file = bucket.file(fileName);
        await file.save(JSON.stringify(signageData, null, 2), {
            contentType: 'application/json', metadata: { cacheControl: 'public, max-age=5' }
        });
        await file.makePublic();

        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        console.log(`Signage JSON generated: ${publicUrl}`);
        return publicUrl;
    } catch (error) {
        console.error('generateClassSignageJson error:', error);
        throw error;
    }
}

// Firestoreトリガー (学年 > クラス単位)
exports.onClassDataChange = functions.firestore
    .document('schools/{schoolId}/grades/{gradeId}/classes/{classId}/daily_data/{dateId}')
    .onWrite(async (change, context) => {
        const { schoolId, gradeId, classId } = context.params;
        await generateClassSignageJson(schoolId, gradeId, classId);
    });

exports.onClassConfigChange = functions.firestore
    .document('schools/{schoolId}/grades/{gradeId}/classes/{classId}')
    .onUpdate(async (change, context) => {
        const { schoolId, gradeId, classId } = context.params;
        const before = change.before.data().displaySettings || {};
        const after = change.after.data().displaySettings || {};
        if (JSON.stringify(before) !== JSON.stringify(after)) {
            await generateClassSignageJson(schoolId, gradeId, classId);
        }
    });

// マスターデータ変更時のファンアウト再生成

async function regenerateAllClassesInGrade(schoolId, gradeId) {
    const classesSnap = await db.collection('schools').doc(schoolId)
        .collection('grades').doc(gradeId).collection('classes').get();
    await Promise.all(classesSnap.docs.map(c => generateClassSignageJson(schoolId, gradeId, c.id)));
}

async function regenerateAllClassesInSchool(schoolId) {
    const gradesSnap = await db.collection('schools').doc(schoolId).collection('grades').get();
    for (const gradeDoc of gradesSnap.docs) {
        await regenerateAllClassesInGrade(schoolId, gradeDoc.id);
    }
}

// 学校マスターデータ変更トリガー
exports.onSchoolMasterDataChange = functions.firestore
    .document('schools/{schoolId}/master_daily_data/{dateId}')
    .onWrite(async (change, context) => {
        const { schoolId } = context.params;
        await regenerateAllClassesInSchool(schoolId);
    });

// 学年マスターデータ変更トリガー
exports.onGradeMasterDataChange = functions.firestore
    .document('schools/{schoolId}/grades/{gradeId}/master_daily_data/{dateId}')
    .onWrite(async (change, context) => {
        const { schoolId, gradeId } = context.params;
        await regenerateAllClassesInGrade(schoolId, gradeId);
    });

// 手動JSON再生成
exports.regenerateSignageJson = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, gradeId, classId } = data;
    validateRequired(data, ['schoolId', 'gradeId', 'classId']);
    const url = await generateClassSignageJson(schoolId, gradeId, classId);
    return { success: true, message: 'サイネージデータを再生成しました', url };
}, (context) => verifyAdmin(context)));
