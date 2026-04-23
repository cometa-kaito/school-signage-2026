/**
 * handlers/school-detail.js
 * 学校詳細データを一括取得
 *   クラスモード: grades[] + classesMap
 *   学科モード: departments[] + gradesByDept + classesByDeptGrade
 */

const { functions, admin, db } = require('../helpers/paths');
const { verifyAuth, withAuth } = require('../helpers/auth');
const { validateRequired } = require('../helpers/validation');

exports.getSchoolDetail = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, includeUsers } = data;
    const schoolRef = db.collection('schools').doc(schoolId);

    const [schoolSnap, memberSnap, authSnap, configSnap, usersResult] = await Promise.all([
        schoolRef.get(),
        db.collection('memberships').where('schoolId', '==', schoolId).get(),
        schoolRef.collection('config').doc('editor_auth').get().catch(() => null),
        schoolRef.collection('config').doc('display_settings').get().catch(() => null),
        includeUsers ? admin.auth().listUsers(100) : Promise.resolve(null),
    ]);

    const schoolData = schoolSnap.exists ? schoolSnap.data() : {};
    const schoolName = schoolData.name || schoolId;
    const hierarchyMode = schoolData.hierarchyMode === 'department' ? 'department' : 'class';

    let grades = [];
    const classesMap = {};
    let departments = [];
    const gradesByDept = {};
    const classesByDeptGrade = {};

    if (hierarchyMode === 'class') {
        const gradeSnap = await schoolRef.collection('grades').orderBy('order', 'asc').get();
        gradeSnap.forEach(doc => grades.push({ id: doc.id, ...doc.data() }));
        await Promise.all(grades.map(async (g) => {
            const snap = await schoolRef.collection('grades').doc(g.id)
                .collection('classes').orderBy('name', 'asc').get()
                .catch(() => ({ forEach: () => {} }));
            const list = [];
            snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
            classesMap[g.id] = list;
        }));
    } else {
        const deptSnap = await schoolRef.collection('departments')
            .orderBy('order', 'asc').get()
            .catch(() => ({ forEach: () => {}, docs: [] }));
        deptSnap.forEach(doc => departments.push({ id: doc.id, ...doc.data() }));
        await Promise.all(departments.map(async (d) => {
            const gSnap = await schoolRef.collection('departments').doc(d.id)
                .collection('grades').orderBy('order', 'asc').get()
                .catch(() => ({ forEach: () => {}, docs: [] }));
            const gList = [];
            gSnap.forEach(doc => gList.push({ id: doc.id, departmentId: d.id, ...doc.data() }));
            gradesByDept[d.id] = gList;
            classesByDeptGrade[d.id] = {};
            await Promise.all(gList.map(async (g) => {
                const cSnap = await schoolRef.collection('departments').doc(d.id)
                    .collection('grades').doc(g.id)
                    .collection('classes').orderBy('name', 'asc').get()
                    .catch(() => ({ forEach: () => {} }));
                const cList = [];
                cSnap.forEach(doc => cList.push({ id: doc.id, ...doc.data() }));
                classesByDeptGrade[d.id][g.id] = cList;
            }));
        }));
    }

    // メンバー
    const callerIsSystemAdmin = context.auth.token.admin === true
        || context.auth.token.systemRole === 'system_admin';
    const members = [];
    await Promise.all(memberSnap.docs.map(async (doc) => {
        const m = doc.data();
        try {
            const user = await admin.auth().getUser(m.userId);
            const isAdmin = user.customClaims?.admin === true;
            // セキュリティ: 非システム管理者にはシステム管理者の情報を見せない
            if (isAdmin && !callerIsSystemAdmin) return;
            members.push({
                userId: m.userId, email: user.email, displayName: user.displayName || '',
                role: m.role, classIds: m.classIds || [], grantedAt: m.grantedAt,
                disabled: user.disabled, emailVerified: user.emailVerified,
                isAdmin,
                lastSignInTime: user.metadata.lastSignInTime
            });
        } catch (e) { /* skip deleted users */ }
    }));

    // エディターパスワードは機密情報のためクライアントに返さない。設定有無のフラグのみ返却。
    const hasEditorPassword = !!(authSnap && authSnap.exists
        && ((authSnap.data().passwordHash && authSnap.data().passwordHash.length > 0)
            || (authSnap.data().password && authSnap.data().password.length > 0)));
    const quietHours = (configSnap && configSnap.exists) ? (configSnap.data().quiet_hours || []) : [];

    let users = [];
    if (usersResult) {
        users = usersResult.users.map(user => ({
            uid: user.uid, email: user.email, displayName: user.displayName || '',
            emailVerified: user.emailVerified, disabled: user.disabled,
            isAdmin: user.customClaims?.admin === true,
            systemRole: user.customClaims?.systemRole || null,
            creationTime: user.metadata.creationTime,
            lastSignInTime: user.metadata.lastSignInTime
        }));
    }

    return {
        schoolName,
        hierarchyMode,
        grades,
        classesMap,
        departments,
        gradesByDept,
        classesByDeptGrade,
        members,
        hasEditorPassword,
        quietHours,
        users,
    };
}, (context, data) => {
    validateRequired(data, ['schoolId']);
    verifyAuth(context);
}));
