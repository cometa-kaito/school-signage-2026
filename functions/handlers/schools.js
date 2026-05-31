/**
 * handlers/schools.js
 * 学校管理
 */

const { functions, hotFunctions, admin, db } = require('../helpers/paths');
const { verifyAuth, verifyAdmin, verifySchoolAdmin, withAuth } = require('../helpers/auth');
const { validateRequired } = require('../helpers/validation');

exports.createSchool = functions.https.onCall(withAuth(async (data, context) => {
    const { name, plan, hierarchyMode } = data;
    validateRequired(data, ['name']);

    // 重複しないランダムな学校IDを生成（英小文字+数字の12桁）
    const generateRandomId = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let id = '';
        for (let i = 0; i < 12; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
    };

    let schoolId;
    for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = generateRandomId();
        const exists = await db.collection('schools').doc(candidate).get();
        if (!exists.exists) {
            schoolId = candidate;
            break;
        }
    }
    if (!schoolId) {
        throw new functions.https.HttpsError('internal', '学校IDの生成に失敗しました');
    }

    const mode = hierarchyMode === 'department' ? 'department' : 'class';

    await db.collection('schools').doc(schoolId).set({
        name,
        plan: plan || 'free',
        hierarchyMode: mode,
        ownerId: context.auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const membershipId = `${context.auth.uid}_${schoolId}`;
    await db.collection('memberships').doc(membershipId).set({
        userId: context.auth.uid, schoolId, role: 'school_admin',
        classIds: [], grantedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, schoolId, message: `学校「${name}」を作成しました` };
}, (context) => verifyAdmin(context)));

// 公開用の学校一覧（認証不要、id/name/hierarchyMode のみ返す）
exports.listSchoolsPublic = hotFunctions.https.onCall(async () => {
    const snap = await db.collection('schools').get();
    const schools = [];
    snap.forEach(doc => {
        const d = doc.data();
        if (d.deletedAt) return;
        schools.push({
            id: doc.id,
            name: d.name || doc.id,
            hierarchyMode: d.hierarchyMode === 'department' ? 'department' : 'class',
        });
    });
    return { schools };
});

exports.listSchools = hotFunctions.https.onCall(withAuth(async (data, context) => {
    if (context.auth.token.admin || context.auth.token.systemRole === 'system_admin') {
        const snap = await db.collection('schools').get();
        const schools = [];
        snap.forEach(doc => {
            const d = doc.data();
            if (d.deletedAt) return; // 旧データの論理削除を除外
            schools.push({ id: doc.id, ...d });
        });
        return { schools };
    }
    const membershipsSnap = await db.collection('memberships')
        .where('userId', '==', context.auth.uid).get();
    const schools = [];
    for (const memberDoc of membershipsSnap.docs) {
        const { schoolId, role, classIds } = memberDoc.data();
        const schoolSnap = await db.collection('schools').doc(schoolId).get();
        if (schoolSnap.exists) {
            const d = schoolSnap.data();
            if (d.deletedAt) continue;
            schools.push({ id: schoolSnap.id, ...d, myRole: role, myClassIds: classIds || [] });
        }
    }
    return { schools };
}, (context) => verifyAuth(context)));

exports.updateSchool = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, name, plan } = data;
    validateRequired(data, ['schoolId']);
    const u = {};
    if (name) u.name = name;
    if (plan) u.plan = plan;
    await db.collection('schools').doc(schoolId).update(u);
    return { success: true, message: '学校情報を更新しました' };
}, async (context, data) => {
    validateRequired(data, ['schoolId']);
    await verifySchoolAdmin(context, data.schoolId);
}));

/**
 * setSchoolHierarchyMode
 * 学校の階層モードを切り替える。
 *   class → department: 既存クラスが 学年 > 学科 > クラス 配置になっているか検証。
 *     未移行クラス（学年直下の classes）が存在する場合はエラー。
 *   department → class: 既存クラスが 学年 > クラス 配置になっているか検証。
 *     未移行クラス（学科配下の classes）が存在する場合はエラー。
 */
exports.setSchoolHierarchyMode = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, mode } = data;
    validateRequired(data, ['schoolId', 'mode']);
    if (mode !== 'class' && mode !== 'department') {
        throw new functions.https.HttpsError('invalid-argument', 'mode は "class" か "department"');
    }

    const schoolRef = db.collection('schools').doc(schoolId);
    const schoolSnap = await schoolRef.get();
    if (!schoolSnap.exists) {
        throw new functions.https.HttpsError('not-found', '学校が見つかりません');
    }
    const currentMode = schoolSnap.data().hierarchyMode || 'class';
    if (currentMode === mode) {
        return { success: true, message: 'モードは既にこの設定です', mode };
    }

    const blockers = [];

    if (mode === 'department') {
        // class → department: 学校直下 grades のクラスが残っていたら拒否
        const gradesSnap = await schoolRef.collection('grades').get();
        for (const gradeDoc of gradesSnap.docs) {
            const cSnap = await gradeDoc.ref.collection('classes').limit(20).get();
            cSnap.forEach(c => blockers.push({
                gradeId: gradeDoc.id,
                gradeName: gradeDoc.data().name || gradeDoc.id,
                classId: c.id,
                className: c.data().name || c.id,
            }));
        }
        if (blockers.length > 0) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                `学科モードへの切替には、学校直下の学年・クラスを削除してから学科を作成する必要があります (${blockers.length}件)`,
                { blockers }
            );
        }
    } else {
        // department → class: 学科配下の学年・クラスを拒否条件とする
        const deptsSnap = await schoolRef.collection('departments').get();
        for (const deptDoc of deptsSnap.docs) {
            const gradesSnap = await deptDoc.ref.collection('grades').get();
            for (const gradeDoc of gradesSnap.docs) {
                const cSnap = await gradeDoc.ref.collection('classes').limit(20).get();
                cSnap.forEach(c => blockers.push({
                    departmentId: deptDoc.id,
                    departmentName: deptDoc.data().name || deptDoc.id,
                    gradeId: gradeDoc.id,
                    gradeName: gradeDoc.data().name || gradeDoc.id,
                    classId: c.id,
                    className: c.data().name || c.id,
                }));
            }
        }
        if (blockers.length > 0) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                `クラスモードへの切替には、学科配下を整理してから切替する必要があります (${blockers.length}件)`,
                { blockers }
            );
        }
    }

    await schoolRef.update({ hierarchyMode: mode });
    return { success: true, message: `モードを「${mode === 'department' ? '学科' : 'クラス'}」に切り替えました`, mode };
}, (context) => verifyAdmin(context)));

exports.deleteSchool = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId } = data;
    validateRequired(data, ['schoolId']);

    // 学校ドキュメントを削除
    await db.collection('schools').doc(schoolId).delete();

    // 紐づくmembershipsを削除（orphan防止）
    const memSnap = await db.collection('memberships')
        .where('schoolId', '==', schoolId).get();
    if (!memSnap.empty) {
        const batch = db.batch();
        memSnap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }

    // 注: grades/classes/daily_data 等のサブコレクションは孤児になるが
    // 学校docが消えた時点で全APIから見えなくなる（UI上は削除済みと等価）
    return { success: true, message: '学校を削除しました' };
}, (context) => verifyAdmin(context)));
