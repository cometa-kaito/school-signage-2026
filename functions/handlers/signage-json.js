/**
 * handlers/signage-json.js
 * サイネージデータJSON生成
 * パス: schools/{schoolId}/grades/{gradeId}/classes/{classId}/daily_data
 * 保存: signage-data/{schoolId}/{gradeId}/{classId}/data.json
 */

const functions = require('firebase-functions');
const { bucket, classPath, dailyDataPath, formatDate } = require('../helpers/paths');
const { verifyAdmin, withAuth } = require('../helpers/auth');
const { validateRequired } = require('../helpers/validation');

async function generateClassSignageJson(schoolId, gradeId, classId) {
    try {
        console.log(`Generating signage JSON: school=${schoolId}, grade=${gradeId}, class=${classId}`);

        const classSnap = await classPath(schoolId, gradeId, classId).get();
        const classData = classSnap.exists ? classSnap.data() : {};

        const today = new Date();
        const fiveDaysAgo = new Date(today); fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        const tenDaysLater = new Date(today); tenDaysLater.setDate(tenDaysLater.getDate() + 10);

        const dailySnap = await dailyDataPath(schoolId, gradeId, classId)
            .where('date', '>=', formatDate(fiveDaysAgo))
            .where('date', '<=', formatDate(tenDaysLater))
            .orderBy('date', 'asc').get();

        const dailyData = {};
        dailySnap.forEach(doc => { dailyData[doc.id] = doc.data(); });

        const displaySettings = classData.displaySettings || {};
        const signageData = {
            generatedAt: new Date().toISOString(), schoolId, gradeId, classId,
            config: {
                schoolName: classData.schoolName || '',
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

// 手動JSON再生成
exports.regenerateSignageJson = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, gradeId, classId } = data;
    validateRequired(data, ['schoolId', 'gradeId', 'classId']);
    const url = await generateClassSignageJson(schoolId, gradeId, classId);
    return { success: true, message: 'サイネージデータを再生成しました', url };
}, (context) => verifyAdmin(context)));
