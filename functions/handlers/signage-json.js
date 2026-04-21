/**
 * handlers/signage-json.js
 * サイネージデータJSON生成
 *   クラスモード: schools/{s}/grades/{g}/classes/{c}/daily_data/*
 *   学科モード:   schools/{s}/departments/{d}/grades/{g}/classes/{c}/daily_data/*
 * 保存: signage-data/{schoolId}/{gradeId}/{classId}/data.json
 */

const {
    functions, db, bucket,
    classPathFor,
    dailyDataPathFor,
    schoolMasterDailyDataPath,
    gradeMasterDailyDataPathFor,
    departmentMasterDailyDataPath,
    departmentPath,
    gradePathFor,
    formatDate,
} = require('../helpers/paths');
const { logger } = require('firebase-functions');
const { verifyAdmin, withAuth } = require('../helpers/auth');
const { validateRequired } = require('../helpers/validation');

function addSource(items, source) {
    return (items || []).map(item => ({ ...item, _source: item._source || source }));
}

async function generateClassSignageJson(schoolId, gradeId, classId, departmentId) {
    try {
        logger.info('signageJson.generate.start', {
            schoolId,
            departmentId: departmentId || null,
            gradeId,
            classId,
        });

        const classSnap = await classPathFor(schoolId, gradeId, classId, departmentId || null).get();
        const classData = classSnap.exists ? classSnap.data() : {};

        const gradeSnap = await gradePathFor(schoolId, gradeId, departmentId || null).get();
        const gradeName = gradeSnap.exists ? (gradeSnap.data().name || '') : '';

        let deptName = '';
        let deptDocData = {};
        if (departmentId) {
            const dSnap = await departmentPath(schoolId, departmentId).get();
            if (dSnap.exists) {
                deptDocData = dSnap.data();
                deptName = deptDocData.name || '';
            }
        }

        const today = new Date();
        const fiveDaysAgo = new Date(today); fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        const tenDaysLater = new Date(today); tenDaysLater.setDate(tenDaysLater.getDate() + 10);

        const dateQuery = (ref) => ref
            .where('date', '>=', formatDate(fiveDaysAgo))
            .where('date', '<=', formatDate(tenDaysLater))
            .orderBy('date', 'asc').get();

        const [schoolMasterSnap, deptMasterSnap, gradeMasterSnap, classSnap_] = await Promise.all([
            dateQuery(schoolMasterDailyDataPath(schoolId)),
            departmentId
                ? dateQuery(departmentMasterDailyDataPath(schoolId, departmentId))
                : Promise.resolve({ forEach: () => {} }),
            dateQuery(gradeMasterDailyDataPathFor(schoolId, gradeId, departmentId || null)),
            dateQuery(dailyDataPathFor(schoolId, gradeId, classId, departmentId || null)),
        ]);

        const toMap = (snap) => {
            const map = {};
            snap.forEach(d => { map[d.id] = d.data(); });
            return map;
        };
        const schoolMasterData = toMap(schoolMasterSnap);
        const deptMasterData = toMap(deptMasterSnap);
        const gradeMasterData = toMap(gradeMasterSnap);
        const classRawData = toMap(classSnap_);

        const allDates = new Set([
            ...Object.keys(schoolMasterData),
            ...Object.keys(deptMasterData),
            ...Object.keys(gradeMasterData),
            ...Object.keys(classRawData),
        ]);

        const dailyData = {};
        for (const dateKey of allDates) {
            const school = schoolMasterData[dateKey] || {};
            const dept = deptMasterData[dateKey] || {};
            const grade = gradeMasterData[dateKey] || {};
            const cls = classRawData[dateKey] || {};

            dailyData[dateKey] = {
                date: dateKey,
                // 順序: 学校 > 学科 > 学年 > クラス
                schedules: [
                    ...addSource(school.schedules, 'school'),
                    ...addSource(dept.schedules, 'department'),
                    ...addSource(grade.schedules, 'grade'),
                    ...addSource(cls.schedules, 'class'),
                ],
                notices: [
                    ...addSource(school.notices, 'school'),
                    ...addSource(dept.notices, 'department'),
                    ...addSource(grade.notices, 'grade'),
                    ...addSource(cls.notices, 'class'),
                ],
                assignments: [
                    ...addSource(school.assignments, 'school'),
                    ...addSource(dept.assignments, 'department'),
                    ...addSource(grade.assignments, 'grade'),
                    ...addSource(cls.assignments, 'class'),
                ],
            };
        }

        // 広告階層マージ
        const schoolDocSnap = await db.collection('schools').doc(schoolId).get();
        const schoolAds = schoolDocSnap.exists ? (schoolDocSnap.data().displaySettings?.ads || []) : [];
        const deptAds = departmentId ? (deptDocData.displaySettings?.ads || []) : [];
        const gradeAds = gradeSnap.exists ? (gradeSnap.data().displaySettings?.ads || []) : [];
        const classAds = (classData.displaySettings?.ads) || [];
        const mergedAds = [...schoolAds, ...deptAds, ...gradeAds, ...classAds];

        const displaySettings = classData.displaySettings || {};
        // quiet_hours フォールバックチェーン: クラス → 学年 → 学科 → 学校
        const pickQH = (ds) =>
            (ds && (ds.quiet_hours || ds.quietHours)) || [];
        let resolvedQH = pickQH(displaySettings);
        if (resolvedQH.length === 0) {
            try {
                const gradeCfgSnap = await gradePathFor(schoolId, gradeId, departmentId || null)
                    .collection('config').doc('display_settings').get();
                if (gradeCfgSnap.exists) resolvedQH = pickQH(gradeCfgSnap.data());
            } catch { /* ignore */ }
        }
        if (resolvedQH.length === 0 && departmentId) {
            try {
                const deptCfgSnap = await departmentPath(schoolId, departmentId)
                    .collection('config').doc('display_settings').get();
                if (deptCfgSnap.exists) resolvedQH = pickQH(deptCfgSnap.data());
            } catch { /* ignore */ }
        }
        if (resolvedQH.length === 0) {
            try {
                const schoolCfgSnap = await db.collection('schools').doc(schoolId)
                    .collection('config').doc('display_settings').get();
                if (schoolCfgSnap.exists) resolvedQH = pickQH(schoolCfgSnap.data());
            } catch { /* ignore */ }
        }
        const signageData = {
            generatedAt: new Date().toISOString(),
            schoolId, gradeId, classId, departmentId: departmentId || null,
            config: {
                schoolName: classData.schoolName || '',
                departmentName: deptName,
                gradeName,
                className: classData.name || '',
                ads: mergedAds,
                quietHours: resolvedQH,
            },
            dailyData,
        };

        const fileName = `signage-data/${schoolId}/${gradeId}/${classId}/data.json`;
        const file = bucket.file(fileName);
        await file.save(JSON.stringify(signageData, null, 2), {
            contentType: 'application/json', metadata: { cacheControl: 'public, max-age=5' }
        });
        await file.makePublic();

        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        logger.info('signageJson.generate.success', {
            schoolId,
            departmentId: departmentId || null,
            gradeId,
            classId,
            publicUrl,
        });
        return publicUrl;
    } catch (error) {
        logger.error('signageJson.generate.failed', {
            schoolId,
            departmentId: departmentId || null,
            gradeId,
            classId,
            message: error.message,
            stack: error.stack,
        });
        throw error;
    }
}

// ===== Firestore triggers =====

// クラスモード: daily_data
exports.onClassDataChange = functions.firestore
    .document('schools/{schoolId}/grades/{gradeId}/classes/{classId}/daily_data/{dateId}')
    .onWrite(async (change, context) => {
        const { schoolId, gradeId, classId } = context.params;
        await generateClassSignageJson(schoolId, gradeId, classId, null);
    });

// クラスモード: classDoc
exports.onClassConfigChange = functions.firestore
    .document('schools/{schoolId}/grades/{gradeId}/classes/{classId}')
    .onUpdate(async (change, context) => {
        const { schoolId, gradeId, classId } = context.params;
        const before = change.before.data().displaySettings || {};
        const after = change.after.data().displaySettings || {};
        if (JSON.stringify(before) !== JSON.stringify(after)) {
            await generateClassSignageJson(schoolId, gradeId, classId, null);
        }
    });

// 学科モード: daily_data
exports.onDeptClassDataChange = functions.firestore
    .document('schools/{schoolId}/departments/{departmentId}/grades/{gradeId}/classes/{classId}/daily_data/{dateId}')
    .onWrite(async (change, context) => {
        const { schoolId, departmentId, gradeId, classId } = context.params;
        await generateClassSignageJson(schoolId, gradeId, classId, departmentId);
    });

// 学科モード: classDoc
exports.onDeptClassConfigChange = functions.firestore
    .document('schools/{schoolId}/departments/{departmentId}/grades/{gradeId}/classes/{classId}')
    .onUpdate(async (change, context) => {
        const { schoolId, departmentId, gradeId, classId } = context.params;
        const before = change.before.data().displaySettings || {};
        const after = change.after.data().displaySettings || {};
        if (JSON.stringify(before) !== JSON.stringify(after)) {
            await generateClassSignageJson(schoolId, gradeId, classId, departmentId);
        }
    });

// ===== 再生成ファンアウト =====

async function enumerateAllClassesInSchool(schoolId) {
    const targets = [];
    // クラスモードの classes
    const gradesSnap = await db.collection('schools').doc(schoolId).collection('grades').get();
    for (const g of gradesSnap.docs) {
        const cSnap = await g.ref.collection('classes').get();
        cSnap.forEach(c => targets.push({ gradeId: g.id, classId: c.id, departmentId: null }));
    }
    // 学科モードの classes
    const deptsSnap = await db.collection('schools').doc(schoolId).collection('departments').get();
    for (const d of deptsSnap.docs) {
        const dGradesSnap = await d.ref.collection('grades').get();
        for (const g of dGradesSnap.docs) {
            const cSnap = await g.ref.collection('classes').get();
            cSnap.forEach(c => targets.push({ gradeId: g.id, classId: c.id, departmentId: d.id }));
        }
    }
    return targets;
}

async function regenerateAllClassesInSchool(schoolId) {
    const targets = await enumerateAllClassesInSchool(schoolId);
    await Promise.all(targets.map(t =>
        generateClassSignageJson(schoolId, t.gradeId, t.classId, t.departmentId)
    ));
}

async function regenerateAllClassesInDepartment(schoolId, departmentId) {
    const dGradesSnap = await db.collection('schools').doc(schoolId)
        .collection('departments').doc(departmentId)
        .collection('grades').get();
    const targets = [];
    for (const g of dGradesSnap.docs) {
        const cSnap = await g.ref.collection('classes').get();
        cSnap.forEach(c => targets.push({ gradeId: g.id, classId: c.id, departmentId }));
    }
    await Promise.all(targets.map(t =>
        generateClassSignageJson(schoolId, t.gradeId, t.classId, t.departmentId)
    ));
}

async function regenerateAllClassesInGradeClassMode(schoolId, gradeId) {
    const cSnap = await db.collection('schools').doc(schoolId)
        .collection('grades').doc(gradeId)
        .collection('classes').get();
    await Promise.all(cSnap.docs.map(c =>
        generateClassSignageJson(schoolId, gradeId, c.id, null)
    ));
}

async function regenerateAllClassesInDeptGrade(schoolId, departmentId, gradeId) {
    const cSnap = await db.collection('schools').doc(schoolId)
        .collection('departments').doc(departmentId)
        .collection('grades').doc(gradeId)
        .collection('classes').get();
    await Promise.all(cSnap.docs.map(c =>
        generateClassSignageJson(schoolId, gradeId, c.id, departmentId)
    ));
}

// 学校マスター変更
exports.onSchoolMasterDataChange = functions.firestore
    .document('schools/{schoolId}/master_daily_data/{dateId}')
    .onWrite(async (change, context) => {
        const { schoolId } = context.params;
        await regenerateAllClassesInSchool(schoolId);
    });

// 学年マスター変更（クラスモード）
exports.onGradeMasterDataChange = functions.firestore
    .document('schools/{schoolId}/grades/{gradeId}/master_daily_data/{dateId}')
    .onWrite(async (change, context) => {
        const { schoolId, gradeId } = context.params;
        await regenerateAllClassesInGradeClassMode(schoolId, gradeId);
    });

// 学科マスター変更
exports.onDeptMasterDataChange = functions.firestore
    .document('schools/{schoolId}/departments/{departmentId}/master_daily_data/{dateId}')
    .onWrite(async (change, context) => {
        const { schoolId, departmentId } = context.params;
        await regenerateAllClassesInDepartment(schoolId, departmentId);
    });

// 学年マスター変更（学科モード: 学科×学年）
exports.onDeptGradeMasterDataChange = functions.firestore
    .document('schools/{schoolId}/departments/{departmentId}/grades/{gradeId}/master_daily_data/{dateId}')
    .onWrite(async (change, context) => {
        const { schoolId, departmentId, gradeId } = context.params;
        await regenerateAllClassesInDeptGrade(schoolId, departmentId, gradeId);
    });

// 手動JSON再生成
exports.regenerateSignageJson = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, gradeId, classId, departmentId } = data;
    validateRequired(data, ['schoolId', 'gradeId', 'classId']);
    const url = await generateClassSignageJson(schoolId, gradeId, classId, departmentId || null);
    return { success: true, message: 'サイネージデータを再生成しました', url };
}, (context) => verifyAdmin(context)));
