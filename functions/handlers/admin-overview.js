/**
 * handlers/admin-overview.js
 * 管理者ダッシュボード概要（学校一覧ページ用の一括取得）
 */

const { functions, admin, db } = require('../helpers/paths');
const { verifyAdmin, withAuth } = require('../helpers/auth');

exports.getAdminOverview = functions.https.onCall(withAuth(async (data, context) => {
    // 全クエリを並列実行
    const [schoolsSnap, listResult, membershipsSnap] = await Promise.all([
        db.collection('schools').get(),
        admin.auth().listUsers(100),
        db.collection('memberships').get(),
    ]);

    // 学校一覧（論理削除は除外）
    const schools = [];
    const schoolNameMap = {};
    schoolsSnap.forEach(doc => {
        const d = doc.data();
        if (d.deletedAt) return;
        const school = { id: doc.id, ...d };
        schools.push(school);
        schoolNameMap[doc.id] = school.name || doc.id;
    });

    // ユーザー一覧（@signage.local を除外）
    const users = listResult.users
        .filter(user => !user.email?.endsWith('@signage.local'))
        .map(user => ({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || '',
            emailVerified: user.emailVerified,
            disabled: user.disabled,
            isAdmin: user.customClaims?.admin === true,
            systemRole: user.customClaims?.systemRole || null,
            creationTime: user.metadata.creationTime,
            lastSignInTime: user.metadata.lastSignInTime,
        }));

    // メンバーシップマップ（userId → [{ schoolId, schoolName, role }]）
    const membershipsMap = {};
    membershipsSnap.forEach(doc => {
        const { userId, schoolId, role } = doc.data();
        if (!userId) return;
        if (!membershipsMap[userId]) {
            membershipsMap[userId] = [];
        }
        membershipsMap[userId].push({
            schoolId,
            schoolName: schoolNameMap[schoolId] || schoolId,
            role,
        });
    });

    return { schools, users, membershipsMap };
}, (context) => verifyAdmin(context)));
