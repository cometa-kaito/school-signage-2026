// school-admin-app.js - 学校管理ロジック（学校一覧 + 学校詳細の2ビュー）

import {
    db, SCHOOL_ID, GRADE_ID, CLASS_ID, setSchoolContext,
    login, loginWithGoogle, logout, onAuthChange, isUserAdmin, getUserClaims,
    listUsersFn, createAdminUserFn, setAdminRoleFn, updateUserFn, deleteUserFn,
    toggleUserStatusFn, setEmailVerifiedFn, setEditorPasswordFn,
    createSchoolFn, listSchoolsFn, updateSchoolFn, deleteSchoolFn,
    createGradeFn, listGradesFn, updateGradeFn, deleteGradeFn,
    createClassFn, listClassesFn, deleteClassFn,
    inviteMemberFn, listMembersFn, removeMemberFn, updateMembershipFn,
    getMyMembershipsFn
} from './config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.firebaseLoaded = true;

// ========================================
// DOM参照
// ========================================

const loginContainer = document.getElementById('loginContainer');
const appContainer = document.getElementById('appContainer');
const loginError = document.getElementById('loginError');
const schoolListView = document.getElementById('schoolListView');
const schoolDetailView = document.getElementById('schoolDetailView');
const breadcrumb = document.getElementById('breadcrumb');

// ========================================
// 状態管理
// ========================================

const urlParams = new URLSearchParams(window.location.search);
const schoolParam = urlParams.get('school');

let currentUserUid = null;
let isSystemAdminUser = false;
let schoolsList = [], gradesList = [];
let activeSchoolId = null, activeGradeId = null;
let usersData = [], membersData = [];
let quietHours = [];

// ========================================
// 認証
// ========================================

onAuthChange(async (user) => {
    if (user) {
        const isAdmin = await isUserAdmin(user);
        if (!isAdmin) {
            // system_adminでない場合、school_adminかチェック
            try {
                const result = await getMyMembershipsFn();
                const memberships = result.data.memberships || [];
                const schoolAdminMembership = memberships.find(m => m.role === 'school_admin');
                if (schoolAdminMembership) {
                    // school_adminは自校の詳細ビューへリダイレクト
                    currentUserUid = user.uid;
                    isSystemAdminUser = false;
                    loginContainer.style.display = 'none';
                    appContainer.style.display = 'block';
                    document.getElementById('userEmail').textContent = user.email;
                    const targetSchool = schoolParam || schoolAdminMembership.schoolId;
                    if (!schoolParam) {
                        window.location.href = `school-admin.html?school=${targetSchool}`;
                        return;
                    }
                    // school_adminは自校のみアクセス可
                    if (!memberships.some(m => m.schoolId === targetSchool && m.role === 'school_admin')) {
                        showLoginError('この学校へのアクセス権がありません');
                        await logout();
                        return;
                    }
                    activeSchoolId = targetSchool;
                    showDetailView();
                    return;
                }
            } catch (e) { console.error(e); }
            await logout();
            showLoginError('管理者権限がありません');
            return;
        }

        // system_admin
        currentUserUid = user.uid;
        isSystemAdminUser = true;
        loginContainer.style.display = 'none';
        appContainer.style.display = 'block';
        document.getElementById('userEmail').textContent = user.email;

        if (schoolParam) {
            activeSchoolId = schoolParam;
            showDetailView();
        } else {
            showListView();
        }
    } else {
        loginContainer.style.display = 'flex';
        appContainer.style.display = 'none';
    }
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.textContent = 'ログイン中...'; loginError.style.display = 'none';
    const result = await login(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
    if (!result.success) showLoginError(result.error);
    btn.disabled = false; btn.textContent = 'ログイン';
});
document.getElementById('googleLoginBtn').addEventListener('click', async () => {
    loginError.style.display = 'none';
    const result = await loginWithGoogle();
    if (!result.success) showLoginError(result.error);
});
document.getElementById('logoutBtn').addEventListener('click', () => logout());

// ========================================
// ユーティリティ
// ========================================

function showLoginError(msg) { loginError.textContent = msg; loginError.style.display = 'block'; }

function showLoading() { document.getElementById('loadingOverlay').style.display = 'flex'; }
function hideLoading() { document.getElementById('loadingOverlay').style.display = 'none'; }

async function withLoading(fn) {
    showLoading();
    try { return await fn(); }
    finally { hideLoading(); }
}

function showToast(msg, type) {
    const existing = document.querySelector('.toast'); if (existing) existing.remove();
    const t = document.createElement('div'); t.className = `toast toast-${type}`; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 4000);
}

function showGenericModal(title, bodyHtml, onSave) {
    document.getElementById('genericModalTitle').textContent = title;
    document.getElementById('genericModalBody').innerHTML = bodyHtml;
    document.getElementById('genericModalSave').textContent = '保存';
    document.getElementById('genericModalSave').onclick = () => withLoading(onSave);
    document.getElementById('genericModal').style.display = 'flex';
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(
        () => showToast('コピーしました', 'success'),
        () => showToast('コピーに失敗しました', 'error')
    );
}
window.copyToClipboard = copyToClipboard;

// ========================================
// ビュー切り替え
// ========================================

function showListView() {
    document.getElementById('pageTitle').textContent = '学校管理';
    schoolListView.style.display = 'block';
    schoolDetailView.style.display = 'none';
    loadSchoolList();
}

function showDetailView() {
    document.getElementById('pageTitle').textContent = '学校管理';
    schoolListView.style.display = 'none';
    schoolDetailView.style.display = 'block';
    // system_admin以外はパンくず非表示
    breadcrumb.style.display = isSystemAdminUser ? 'block' : 'none';
    setSchoolContext(activeSchoolId, null, null);
    loadSchoolDetail();
}

// ========================================
// 学校一覧ビュー（system_adminのみ）
// ========================================

async function loadSchoolList() {
    const container = document.getElementById('schoolGridContainer');
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>読み込み中...</p></div>';
    try {
        const r = await listSchoolsFn();
        schoolsList = r.data.schools || [];
        renderSchoolGrid();
    } catch (e) {
        container.innerHTML = `<p class="error-text">エラー: ${e.message}</p>`;
    }
}

function renderSchoolGrid() {
    const container = document.getElementById('schoolGridContainer');
    if (schoolsList.length === 0) {
        container.innerHTML = '<p class="empty-text">学校が登録されていません</p>';
        return;
    }
    container.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">
        ${schoolsList.map(s => `
            <div class="school-card" style="background:#f8f9fa;border:2px solid #e9ecef;border-radius:12px;padding:20px;cursor:pointer;transition:all 0.2s;"
                 onmouseenter="this.style.borderColor='#667eea';this.style.boxShadow='0 4px 12px rgba(102,126,234,0.15)'"
                 onmouseleave="this.style.borderColor='#e9ecef';this.style.boxShadow='none'"
                 onclick="window.openSchool('${s.id}')">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div>
                        <h3 style="margin:0 0 4px;font-size:18px;">${s.name || s.id}</h3>
                        <p style="margin:0;color:#888;font-size:13px;">ID: ${s.id}</p>
                    </div>
                    <div style="display:flex;gap:4px;" onclick="event.stopPropagation()">
                        <button class="btn-icon" onclick="window.editSchool('${s.id}','${(s.name || '').replace(/'/g, "\\'")}')" title="編集">&#9998;</button>
                        <button class="btn-icon btn-danger" onclick="window.deleteSchool('${s.id}')" title="削除">&#128465;</button>
                    </div>
                </div>
            </div>
        `).join('')}
    </div>`;
}

window.openSchool = (schoolId) => {
    window.location.href = `school-admin.html?school=${schoolId}`;
};

window.editSchool = (schoolId, currentName) => {
    showGenericModal('学校名を編集',
        `<div class="form-group"><label>学校名</label><input type="text" id="inp-school-name" value="${currentName}"></div>`,
        async () => {
            const name = document.getElementById('inp-school-name').value;
            if (!name) { showToast('学校名を入力してください', 'error'); return; }
            try {
                await updateSchoolFn({ schoolId, name });
                showToast('更新しました', 'success');
                document.getElementById('genericModal').style.display = 'none';
                loadSchoolList();
            } catch (e) { showToast('エラー: ' + e.message, 'error'); }
        }
    );
};

window.deleteSchool = async (schoolId) => {
    if (!confirm('この学校を削除しますか？関連する全データが削除されます。')) return;
    try {
        await deleteSchoolFn({ schoolId });
        showToast('削除しました', 'success');
        loadSchoolList();
    } catch (e) { showToast('エラー: ' + e.message, 'error'); }
};

document.getElementById('createSchoolBtn').addEventListener('click', () => {
    showGenericModal('学校を作成',
        '<div class="form-group"><label>学校名</label><input type="text" id="inp-school-name" placeholder="例: GNテクニカルカレッジ"></div>',
        async () => {
            const name = document.getElementById('inp-school-name').value;
            if (!name) { showToast('学校名を入力してください', 'error'); return; }
            try {
                const result = await createSchoolFn({ name });
                showToast('学校を作成しました', 'success');
                document.getElementById('genericModal').style.display = 'none';
                loadSchoolList();
            } catch (e) { showToast('エラー: ' + e.message, 'error'); }
        }
    );
});

// ========================================
// 学校詳細ビュー
// ========================================

async function loadSchoolDetail() {
    // 学校名を取得して表示
    try {
        const r = await listSchoolsFn();
        schoolsList = r.data.schools || [];
        const school = schoolsList.find(s => s.id === activeSchoolId);
        document.getElementById('schoolNameHeader').textContent = school ? school.name : activeSchoolId;
        document.getElementById('schoolIdBadge').textContent = `学校ID: ${activeSchoolId}`;
    } catch (e) {
        document.getElementById('schoolNameHeader').textContent = activeSchoolId;
        document.getElementById('schoolIdBadge').textContent = `学校ID: ${activeSchoolId}`;
    }

    // system_admin以外はユーザー作成・学校編集/削除を非表示
    if (!isSystemAdminUser) {
        document.getElementById('createUserBtn').style.display = 'none';
        document.getElementById('editSchoolBtn').style.display = 'none';
        document.getElementById('deleteSchoolBtn').style.display = 'none';
    }

    // 各セクションを読み込み
    loadGrades(activeSchoolId);
    loadUsersAndMembers();
    loadEditorPassword();
    loadQuietHours();
}

// 学校情報の編集・削除（詳細ビュー）
document.getElementById('editSchoolBtn').addEventListener('click', () => {
    const currentName = document.getElementById('schoolNameHeader').textContent;
    showGenericModal('学校名を編集',
        `<div class="form-group"><label>学校名</label><input type="text" id="inp-school-name" value="${currentName}"></div>`,
        async () => {
            const name = document.getElementById('inp-school-name').value;
            if (!name) { showToast('学校名を入力してください', 'error'); return; }
            try {
                await updateSchoolFn({ schoolId: activeSchoolId, name });
                document.getElementById('schoolNameHeader').textContent = name;
                showToast('更新しました', 'success');
                document.getElementById('genericModal').style.display = 'none';
            } catch (e) { showToast('エラー: ' + e.message, 'error'); }
        }
    );
});

document.getElementById('deleteSchoolBtn').addEventListener('click', async () => {
    if (!confirm('この学校を削除しますか？関連する全データが削除されます。')) return;
    try {
        await deleteSchoolFn({ schoolId: activeSchoolId });
        showToast('削除しました', 'success');
        window.location.href = 'school-admin.html';
    } catch (e) { showToast('エラー: ' + e.message, 'error'); }
});

// ========================================
// 学年管理
// ========================================

// 学年ごとのクラスデータキャッシュ
let gradeClassesCache = {};

async function loadGrades(schoolId) {
    try {
        const r = await listGradesFn({ schoolId });
        gradesList = r.data.grades || [];
        gradeClassesCache = {};
        // 全学年のクラスを並列取得
        await Promise.all(gradesList.map(async (g) => {
            try {
                const cr = await listClassesFn({ schoolId, gradeId: g.id });
                gradeClassesCache[g.id] = cr.data.classes || [];
            } catch { gradeClassesCache[g.id] = []; }
        }));
        renderGradeClassTree();
    } catch (e) { gradesList = []; renderGradeClassTree(); }
}

function renderGradeClassTree() {
    const c = document.getElementById('gradeClassTreeContainer');
    if (gradesList.length === 0) {
        c.innerHTML = '<p class="empty-text">学年がありません。「+ 学年追加」から作成してください。</p>';
        return;
    }

    c.innerHTML = gradesList.map(g => {
        const classes = gradeClassesCache[g.id] || [];
        const isOpen = g.id === activeGradeId;
        return `
        <div style="border:1px solid #e1e1e1;border-radius:10px;margin-bottom:10px;overflow:hidden;">
            <div style="background:${isOpen ? '#e8eaf6' : '#f5f5f5'};padding:12px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;"
                 onclick="window.toggleGrade('${g.id}')">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:13px;color:#888;">${isOpen ? '&#9660;' : '&#9654;'}</span>
                    <span style="font-weight:bold;font-size:15px;">${g.name}</span>
                    <span style="font-size:12px;color:#888;">(${classes.length}クラス)</span>
                </div>
                <div style="display:flex;gap:4px;" onclick="event.stopPropagation()">
                    <button class="btn btn-secondary btn-sm" onclick="window.addClassToGrade('${g.id}','${g.name.replace(/'/g, "\\'")}')">+ クラス</button>
                    <button class="btn-icon btn-danger" onclick="window.deleteGrade('${g.id}')" title="学年を削除" style="font-size:12px;">x</button>
                </div>
            </div>
            ${isOpen ? `
            <div style="padding:12px 16px;background:#fff;">
                ${classes.length === 0 ? '<p class="empty-text" style="margin:0;">クラスがありません。「+ クラス」から追加してください。</p>' :
                `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;">
                    ${classes.map(cl => `
                        <div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
                            <span style="font-weight:500;">${cl.name}</span>
                            <div style="display:flex;gap:4px;">
                                <button class="btn-icon" onclick="window.showClassUrls('${cl.id}','${cl.name.replace(/'/g, "\\'")}')" title="詳細・URL" style="font-size:12px;">&#128279;</button>
                                <button class="btn-icon btn-danger" onclick="window.deleteClassInGrade('${g.id}','${cl.id}')" title="削除" style="font-size:12px;">x</button>
                            </div>
                        </div>
                    `).join('')}
                </div>`}
            </div>` : ''}
        </div>`;
    }).join('');
}

window.toggleGrade = (gradeId) => {
    activeGradeId = (activeGradeId === gradeId) ? null : gradeId;
    renderGradeClassTree();
};

window.addClassToGrade = (gradeId, gradeName) => {
    activeGradeId = gradeId;
    showGenericModal(`${gradeName} にクラスを追加`,
        '<div class="form-group"><label>クラス名</label><input type="text" id="inp-class-name" placeholder="例: 電子工学科"></div>',
        async () => {
            const name = document.getElementById('inp-class-name').value;
            if (!name) { showToast('クラス名を入力してください', 'error'); return; }
            try {
                const result = await createClassFn({ schoolId: activeSchoolId, gradeId, name });
                document.getElementById('genericModal').style.display = 'none';
                showToast('クラスを作成しました', 'success');
                // キャッシュ更新
                try {
                    const cr = await listClassesFn({ schoolId: activeSchoolId, gradeId });
                    gradeClassesCache[gradeId] = cr.data.classes || [];
                } catch { /* ignore */ }
                renderGradeClassTree();
                // 作成したクラスのURLを表示
                const newClass = (gradeClassesCache[gradeId] || []).find(c => c.name === name);
                if (newClass) showUrlModal(newClass.id, newClass.name);
            } catch (e) { showToast('エラー: ' + e.message, 'error'); }
        }
    );
};

window.deleteClassInGrade = async (gradeId, classId) => {
    if (!confirm('クラスを削除しますか？')) return;
    await withLoading(async () => {
        try {
            await deleteClassFn({ schoolId: activeSchoolId, gradeId, classId });
            showToast('削除しました', 'success');
            // キャッシュ更新
            gradeClassesCache[gradeId] = (gradeClassesCache[gradeId] || []).filter(c => c.id !== classId);
            renderGradeClassTree();
        } catch (e) { showToast('エラー: ' + e.message, 'error'); }
    });
};

window.deleteGrade = async (gradeId) => {
    if (!confirm('この学年と含まれるクラスをすべて削除しますか？')) return;
    await withLoading(async () => {
        try {
            await deleteGradeFn({ schoolId: activeSchoolId, gradeId });
            showToast('削除しました', 'success');
            if (activeGradeId === gradeId) activeGradeId = null;
            delete gradeClassesCache[gradeId];
            loadGrades(activeSchoolId);
        } catch (e) { showToast('エラー: ' + e.message, 'error'); }
    });
};

document.getElementById('createGradeBtn').addEventListener('click', () => {
    showGenericModal('学年を追加',
        '<div class="form-group"><label>学年名</label><input type="text" id="inp-grade-name" placeholder="例: 2年"></div>',
        async () => {
            const name = document.getElementById('inp-grade-name').value;
            if (!name) { showToast('学年名を入力してください', 'error'); return; }
            try {
                await createGradeFn({ schoolId: activeSchoolId, name });
                showToast('学年を作成しました', 'success');
                document.getElementById('genericModal').style.display = 'none';
                loadGrades(activeSchoolId);
            } catch (e) { showToast('エラー: ' + e.message, 'error'); }
        }
    );
});

function showUrlModal(classId, className) {
    const origin = window.location.origin;
    const signageUrl = `${origin}/?school=${activeSchoolId}&grade=${activeGradeId}&class=${classId}&kiosk=1`;
    const dashboardUrl = `${origin}/dashboard.html?school=${activeSchoolId}&grade=${activeGradeId}&class=${classId}`;
    const adminUrl = `${origin}/admin.html?school=${activeSchoolId}&grade=${activeGradeId}&class=${classId}`;
    const settingsUrl = `${origin}/class-settings.html?school=${activeSchoolId}&grade=${activeGradeId}&class=${classId}`;

    const grade = gradesList.find(g => g.id === activeGradeId);
    const gradeName = grade ? grade.name : activeGradeId;

    showGenericModal(`${gradeName} ${className}`,
        `<div style="display:flex;gap:8px;margin-bottom:16px;">
            <a href="${dashboardUrl}" class="btn btn-primary" style="flex:1;text-align:center;text-decoration:none;">ダッシュボード</a>
            <a href="${adminUrl}" class="btn btn-secondary" style="flex:1;text-align:center;text-decoration:none;">連絡登録</a>
            <a href="${settingsUrl}" class="btn btn-secondary" style="flex:1;text-align:center;text-decoration:none;">クラス設定</a>
        </div>
        <div class="form-group">
            <label>サイネージURL</label>
            <div style="display:flex;gap:8px;">
                <input type="text" readonly value="${signageUrl}" style="flex:1;font-size:12px;" id="url-signage">
                <button class="btn btn-secondary btn-sm" onclick="window.copyToClipboard(document.getElementById('url-signage').value)">コピー</button>
            </div>
        </div>
        <div class="form-group">
            <label>ダッシュボードURL</label>
            <div style="display:flex;gap:8px;">
                <input type="text" readonly value="${dashboardUrl}" style="flex:1;font-size:12px;" id="url-dashboard">
                <button class="btn btn-secondary btn-sm" onclick="window.copyToClipboard(document.getElementById('url-dashboard').value)">コピー</button>
            </div>
        </div>`,
        () => { document.getElementById('genericModal').style.display = 'none'; }
    );
    document.getElementById('genericModalSave').textContent = '閉じる';
}

window.showClassUrls = (classId, className) => {
    showUrlModal(classId, className);
};

// ========================================
// ユーザー・メンバー統合管理
// ========================================

async function loadUsersAndMembers() {
    const container = document.getElementById('userTableContainer');
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>読み込み中...</p></div>';
    try {
        if (isSystemAdminUser) {
            // system_admin: 全ユーザー + この学校のメンバーを表示
            const [usersResult, membersResult] = await Promise.all([
                listUsersFn(),
                listMembersFn({ schoolId: activeSchoolId }).catch(() => ({ data: { members: [] } }))
            ]);
            usersData = usersResult.data.users || [];
            membersData = membersResult.data.members || [];
        } else {
            // school_admin: この学校のメンバーのみ表示
            const membersResult = await listMembersFn({ schoolId: activeSchoolId });
            membersData = membersResult.data.members || [];
            usersData = membersData.map(m => ({
                uid: m.userId, email: m.email, displayName: m.displayName || '',
                disabled: m.disabled, isAdmin: m.isAdmin,
                lastSignInTime: m.lastSignInTime
            }));
        }
        renderUnifiedUserTable();
    } catch (e) { container.innerHTML = `<p class="error-text">エラー: ${e.message}</p>`; }
}

function renderUnifiedUserTable() {
    const container = document.getElementById('userTableContainer');
    if (usersData.length === 0) {
        container.innerHTML = isSystemAdminUser
            ? '<p class="empty-text">ユーザーがいません</p>'
            : '<p class="empty-text">この学校にメンバーがいません</p>';
        return;
    }

    const memberMap = {};
    membersData.forEach(m => { memberMap[m.userId] = m; });

    const roleLabels = { system_admin: 'システム管理者', school_admin: '学校管理者', teacher: '教員' };

    const rows = usersData.map(user => {
        const member = memberMap[user.uid];
        const isCurrent = user.uid === currentUserUid;
        const currentRole = member ? member.role : '';
        const lastSignIn = user.lastSignInTime ? new Date(user.lastSignInTime).toLocaleString('ja-JP') : '-';

        let roleCell;
        if (user.isAdmin) {
            roleCell = `<span class="badge badge-admin">システム管理者</span>`;
        } else if (member) {
            if (isSystemAdminUser) {
                roleCell = `<select class="role-dropdown" data-uid="${user.uid}" data-current="${currentRole}">
                    ${['school_admin','teacher'].map(r => `<option value="${r}" ${r === currentRole ? 'selected' : ''}>${roleLabels[r]}</option>`).join('')}
                </select>`;
            } else {
                roleCell = `<span class="badge" style="background:#e3f2fd;color:#1565c0;">${roleLabels[currentRole] || currentRole}</span>`;
            }
        } else {
            roleCell = isSystemAdminUser
                ? `<button class="btn btn-sm btn-secondary" onclick="window.addMember('${user.uid}', '${user.email}')">メンバー追加</button>`
                : '';
        }

        const actionsHtml = isSystemAdminUser ? `<td><div class="action-buttons">
                <button class="btn-icon" onclick="window.editUser('${user.uid}')" title="編集">&#9998;</button>
                ${!isCurrent ? `
                    <button class="btn-icon" onclick="window.toggleStatus('${user.uid}', ${!user.disabled})" title="${user.disabled ? '有効化' : '無効化'}">${user.disabled ? '&#9989;' : '&#128683;'}</button>
                    ${member ? `<button class="btn-icon" onclick="window.removeMemberFromSchool('${user.uid}')" title="メンバー除外">&#128100;</button>` : ''}
                    <button class="btn-icon btn-danger" onclick="window.deleteUserAction('${user.uid}')" title="削除">&#128465;</button>
                ` : ''}
            </div></td>` : '';

        return `<tr>
            <td>${user.email}${isCurrent ? ' <span class="current-user-badge">(自分)</span>' : ''}</td>
            <td>${user.displayName || '-'}</td>
            <td>${roleCell}</td>
            <td><span class="badge ${user.disabled ? 'badge-disabled' : 'badge-active'}">${user.disabled ? '無効' : '有効'}</span></td>
            <td class="last-signin">${lastSignIn}</td>
            ${actionsHtml}
        </tr>`;
    }).join('');

    const opsHeader = isSystemAdminUser ? '<th>操作</th>' : '';
    container.innerHTML = `<table class="user-table"><thead><tr>
        <th>メール</th><th>名前</th><th>ロール</th><th>状態</th><th>最終ログイン</th>${opsHeader}
    </tr></thead><tbody>${rows}</tbody></table>`;

    if (isSystemAdminUser) {
        container.querySelectorAll('.role-dropdown').forEach(sel => {
            sel.addEventListener('change', async (e) => {
                const uid = e.target.dataset.uid;
                const newRole = e.target.value;
                try {
                    await updateMembershipFn({ schoolId: activeSchoolId, userId: uid, role: newRole });
                    showToast('ロールを変更しました', 'success');
                } catch (err) { showToast('エラー: ' + err.message, 'error'); e.target.value = e.target.dataset.current; }
            });
        });
    }
}

// ユーザー作成/編集モーダル
function openUserModal(uid) {
    const roleGroup = document.getElementById('userModalRoleGroup');
    const roleSelect = document.getElementById('userModalRole');

    // system_adminのみ権限ドロップダウンを表示
    roleGroup.style.display = isSystemAdminUser ? 'block' : 'none';

    if (uid) {
        const user = usersData.find(u => u.uid === uid);
        if (!user) return;
        const member = membersData.find(m => m.userId === uid);
        document.getElementById('userModalTitle').textContent = 'ユーザー編集';
        document.getElementById('userModalUid').value = uid;
        document.getElementById('userModalEmail').value = user.email;
        document.getElementById('userModalName').value = user.displayName || '';
        document.getElementById('userModalPassword').value = '';
        // 権限の現在値を設定
        if (user.isAdmin) {
            roleSelect.value = 'system_admin';
        } else if (member) {
            roleSelect.value = member.role;
        } else {
            roleSelect.value = '';
        }
    } else {
        document.getElementById('userModalTitle').textContent = 'ユーザー作成';
        document.getElementById('userModalUid').value = '';
        document.getElementById('userModalEmail').value = '';
        document.getElementById('userModalName').value = '';
        document.getElementById('userModalPassword').value = '';
        roleSelect.value = '';
    }
    document.getElementById('userModal').style.display = 'flex';
}

document.getElementById('createUserBtn').addEventListener('click', () => openUserModal(null));
window.editUser = (uid) => openUserModal(uid);

document.getElementById('userModalSave').addEventListener('click', () => withLoading(async () => {
    const uid = document.getElementById('userModalUid').value;
    const email = document.getElementById('userModalEmail').value;
    const displayName = document.getElementById('userModalName').value;
    const password = document.getElementById('userModalPassword').value;
    const selectedRole = isSystemAdminUser ? document.getElementById('userModalRole').value : null;

    try {
        if (uid) {
            // ユーザー基本情報の更新
            await updateUserFn({ uid, email, displayName, password: password || undefined });

            // 権限変更（system_adminのみ）
            if (isSystemAdminUser && selectedRole !== null) {
                const user = usersData.find(u => u.uid === uid);
                const member = membersData.find(m => m.userId === uid);
                const wasAdmin = user?.isAdmin;
                const prevRole = member?.role || '';

                if (selectedRole === 'system_admin') {
                    if (!wasAdmin) await setAdminRoleFn({ uid, isAdmin: true });
                    if (member) await removeMemberFn({ schoolId: activeSchoolId, userId: uid });
                } else if (selectedRole === '') {
                    // メンバーでない
                    if (wasAdmin) await setAdminRoleFn({ uid, isAdmin: false });
                    if (member) await removeMemberFn({ schoolId: activeSchoolId, userId: uid });
                } else {
                    // school_admin / teacher
                    if (wasAdmin) await setAdminRoleFn({ uid, isAdmin: false });
                    if (member) {
                        if (prevRole !== selectedRole) {
                            await updateMembershipFn({ schoolId: activeSchoolId, userId: uid, role: selectedRole });
                        }
                    } else {
                        await inviteMemberFn({ schoolId: activeSchoolId, email, role: selectedRole });
                    }
                }
            }
        } else {
            // 新規作成
            if (!email || !password) { showToast('メールとパスワードは必須です', 'error'); return; }
            const setAsAdmin = selectedRole === 'system_admin';
            const result = await createAdminUserFn({ email, password, displayName, setAsAdmin });

            // 作成後にロールを設定
            if (isSystemAdminUser && selectedRole && selectedRole !== 'system_admin' && result.data?.uid) {
                await inviteMemberFn({ schoolId: activeSchoolId, email, role: selectedRole });
            }
        }
        showToast('保存しました', 'success');
        document.getElementById('userModal').style.display = 'none';
        loadUsersAndMembers();
    } catch (e) { showToast('エラー: ' + e.message, 'error'); }
}));

window.addMember = async (uid, email) => {
    await withLoading(async () => {
        try {
            await inviteMemberFn({ schoolId: activeSchoolId, email, role: 'teacher' });
            showToast(`${email} をメンバーに追加しました`, 'success');
            loadUsersAndMembers();
        } catch (e) { showToast('エラー: ' + e.message, 'error'); }
    });
};

window.removeMemberFromSchool = async (uid) => {
    if (!confirm('この学校のメンバーから除外しますか？')) return;
    await withLoading(async () => {
        try { await removeMemberFn({ schoolId: activeSchoolId, userId: uid }); showToast('除外しました', 'success'); loadUsersAndMembers(); }
        catch (e) { showToast('エラー: ' + e.message, 'error'); }
    });
};

window.toggleStatus = async (uid, disabled) => {
    await withLoading(async () => {
        try { await toggleUserStatusFn({ uid, disabled }); showToast(disabled ? '無効化しました' : '有効化しました', 'success'); loadUsersAndMembers(); }
        catch (e) { showToast('エラー: ' + e.message, 'error'); }
    });
};

window.deleteUserAction = async (uid) => {
    if (!confirm('ユーザーを完全に削除しますか？')) return;
    await withLoading(async () => {
        try { await deleteUserFn({ uid }); showToast('削除しました', 'success'); loadUsersAndMembers(); }
        catch (e) { showToast('エラー: ' + e.message, 'error'); }
    });
};

// ========================================
// エディターパスワード
// ========================================

async function loadEditorPassword() {
    try {
        const snap = await getDoc(doc(db, "schools", activeSchoolId, "config", "editor_auth"));
        if (snap.exists()) document.getElementById('editorPasswordInput').value = snap.data().password || '';
    } catch (e) { /* ignore */ }
}
document.getElementById('saveEditorPasswordBtn').addEventListener('click', async () => {
    const pw = document.getElementById('editorPasswordInput').value;
    if (pw.length < 4) { showToast('4文字以上必要です', 'error'); return; }
    await withLoading(async () => {
        try { await setEditorPasswordFn({ password: pw, schoolId: activeSchoolId }); showToast('保存しました', 'success'); }
        catch (e) { showToast('エラー: ' + e.message, 'error'); }
    });
});

// ========================================
// 授業時間
// ========================================

async function loadQuietHours() {
    try {
        const snap = await getDoc(doc(db, "schools", activeSchoolId, "config", "display_settings"));
        quietHours = snap.exists() ? (snap.data().quiet_hours || []) : [];
        renderQuietHours();
    } catch (e) { quietHours = []; renderQuietHours(); }
}

function renderQuietHours() {
    const c = document.getElementById('quietHoursList');
    if (quietHours.length === 0) { c.innerHTML = '<p class="empty-text">未設定</p>'; return; }
    c.innerHTML = quietHours.map((item, idx) => `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
            <input type="time" value="${item.start || '08:30'}" onchange="window.updateQH(${idx},'start',this.value)">
            <span>〜</span>
            <input type="time" value="${item.end || '15:30'}" onchange="window.updateQH(${idx},'end',this.value)">
            <button class="btn-icon btn-danger" onclick="window.removeQH(${idx})">x</button>
        </div>
    `).join('');
}

window.updateQH = (i, f, v) => { if (quietHours[i]) quietHours[i][f] = v; };
window.removeQH = (i) => { quietHours.splice(i, 1); renderQuietHours(); };
document.getElementById('addQuietHourBtn').addEventListener('click', () => { quietHours.push({ start: '08:30', end: '15:30' }); renderQuietHours(); });
document.getElementById('saveQuietHoursBtn').addEventListener('click', async () => {
    await withLoading(async () => {
        try { await setDoc(doc(db, "schools", activeSchoolId, "config", "display_settings"), { quiet_hours: quietHours }, { merge: true }); showToast('保存しました', 'success'); }
        catch (e) { showToast('エラー: ' + e.message, 'error'); }
    });
});


