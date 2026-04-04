// user-management-app.js - 管理画面ロジック

import {
    db, storage, SCHOOL_ID, GRADE_ID, CLASS_ID, setSchoolContext,
    login, loginWithGoogle, logout, onAuthChange, isUserAdmin,
    listUsersFn, createAdminUserFn, setAdminRoleFn, updateUserFn, deleteUserFn,
    toggleUserStatusFn, setEmailVerifiedFn, setEditorPasswordFn,
    createSchoolFn, listSchoolsFn, createGradeFn, listGradesFn, updateGradeFn, deleteGradeFn,
    createClassFn, listClassesFn, deleteClassFn,
    inviteMemberFn, listMembersFn, removeMemberFn, updateMembershipFn,
    registerDeviceFn, listDevicesFn, removeDeviceFn, revokeDeviceTokenFn,
    migrateToGradeStructureFn
} from './config.js';
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

window.firebaseLoaded = true;

const loginContainer = document.getElementById('loginContainer');
const appContainer = document.getElementById('appContainer');
const loginError = document.getElementById('loginError');

let currentUserUid = null;
let schoolsList = [], gradesList = [], classesList = [];
let activeSchoolId = SCHOOL_ID, activeGradeId = GRADE_ID;
let usersData = [], membersData = [];
let quietHours = [], adsData = [], pendingAdAction = null;
let adGradeId = null, adClassId = null, adClassesList = [];

// ========== 認証 ==========
onAuthChange(async (user) => {
    if (user) {
        const isAdmin = await isUserAdmin(user);
        if (isAdmin) {
            currentUserUid = user.uid;
            loginContainer.style.display = 'none';
            appContainer.style.display = 'block';
            document.getElementById('userEmail').textContent = user.email;
            loadSchools();
        } else { await logout(); showLoginError('管理者権限がありません'); }
    } else { loginContainer.style.display = 'flex'; appContainer.style.display = 'none'; }
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

function showLoginError(msg) { loginError.textContent = msg; loginError.style.display = 'block'; }
function showToast(msg, type) {
    const existing = document.querySelector('.toast'); if (existing) existing.remove();
    const t = document.createElement('div'); t.className = `toast toast-${type}`; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 4000);
}

function showGenericModal(title, bodyHtml, onSave) {
    document.getElementById('genericModalTitle').textContent = title;
    document.getElementById('genericModalBody').innerHTML = bodyHtml;
    document.getElementById('genericModalSave').onclick = onSave;
    document.getElementById('genericModal').style.display = 'flex';
}

// ========== 学校管理 ==========
async function loadSchools() {
    try {
        const r = await listSchoolsFn();
        schoolsList = r.data.schools || [];
        renderSchoolSelect();
        if (activeSchoolId) {
            loadGrades(activeSchoolId);
            loadUsersAndMembers();
            loadDevices(activeSchoolId);
            loadEditorPassword();
            initAdSelectors();
            loadQuietHours();
        }
    } catch (e) { console.error(e); }
}

function renderSchoolSelect() {
    const sel = document.getElementById('schoolSelect');
    sel.innerHTML = schoolsList.map(s => `<option value="${s.id}" ${s.id === activeSchoolId ? 'selected' : ''}>${s.name || s.id}</option>`).join('');
}

document.getElementById('schoolSelect').addEventListener('change', (e) => {
    activeSchoolId = e.target.value;
    activeGradeId = null;
    setSchoolContext(activeSchoolId, null, null);
    loadGrades(activeSchoolId);
    loadUsersAndMembers();
    loadDevices(activeSchoolId);
    loadEditorPassword();
    loadAds();
    loadQuietHours();
});

document.getElementById('createSchoolBtn').addEventListener('click', () => {
    showGenericModal('学校を作成', '<div class="form-group"><label>学校名</label><input type="text" id="inp-school-name" placeholder="例: GNテクニカルカレッジ"></div>', async () => {
        const name = document.getElementById('inp-school-name').value;
        if (!name) { showToast('学校名を入力してください', 'error'); return; }
        try { await createSchoolFn({ name }); showToast('学校を作成しました', 'success'); document.getElementById('genericModal').style.display = 'none'; loadSchools(); }
        catch (e) { showToast('エラー: ' + e.message, 'error'); }
    });
});

// ========== 学年管理 ==========
async function loadGrades(schoolId) {
    try {
        const r = await listGradesFn({ schoolId });
        gradesList = r.data.grades || [];
        renderGradeList();
        initAdSelectors();
    } catch (e) { gradesList = []; renderGradeList(); initAdSelectors(); }
}

function renderGradeList() {
    const c = document.getElementById('gradeListContainer');
    if (gradesList.length === 0) { c.innerHTML = '<p class="empty-text">学年がありません</p>'; return; }
    c.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;">${gradesList.map(g => `
        <div style="background:${g.id === activeGradeId ? '#e3f2fd' : '#f5f5f5'};padding:8px 14px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:8px;border:${g.id === activeGradeId ? '2px solid #667eea' : '2px solid transparent'};"
             onclick="window.selectGrade('${g.id}')">
            <span>${g.name}</span>
            <button class="btn-icon btn-danger" onclick="event.stopPropagation();window.deleteGrade('${g.id}')" title="削除" style="font-size:12px;">×</button>
        </div>
    `).join('')}</div>`;
}

window.selectGrade = (gradeId) => {
    activeGradeId = gradeId;
    setSchoolContext(activeSchoolId, activeGradeId, null);
    renderGradeList();
    loadClassesForGrade(activeSchoolId, gradeId);
    const grade = gradesList.find(g => g.id === gradeId);
    document.getElementById('gradeNameLabel').textContent = grade ? `(${grade.name})` : '';
};

window.deleteGrade = async (gradeId) => {
    if (!confirm('この学年を削除しますか？')) return;
    try { await deleteGradeFn({ schoolId: activeSchoolId, gradeId }); showToast('削除しました', 'success'); if (activeGradeId === gradeId) activeGradeId = null; loadGrades(activeSchoolId); classesList = []; renderClassList(); }
    catch (e) { showToast('エラー: ' + e.message, 'error'); }
};

document.getElementById('createGradeBtn').addEventListener('click', () => {
    showGenericModal('学年を追加', '<div class="form-group"><label>学年名</label><input type="text" id="inp-grade-name" placeholder="例: 電子工学科2年"></div>', async () => {
        const name = document.getElementById('inp-grade-name').value;
        if (!name) { showToast('学年名を入力してください', 'error'); return; }
        try { await createGradeFn({ schoolId: activeSchoolId, name }); showToast('学年を作成しました', 'success'); document.getElementById('genericModal').style.display = 'none'; loadGrades(activeSchoolId); }
        catch (e) { showToast('エラー: ' + e.message, 'error'); }
    });
});

// ========== クラス管理 ==========
async function loadClassesForGrade(schoolId, gradeId) {
    try {
        const r = await listClassesFn({ schoolId, gradeId });
        classesList = r.data.classes || [];
        renderClassList();
    } catch (e) { classesList = []; renderClassList(); }
}

function renderClassList() {
    const c = document.getElementById('classListContainer');
    if (!activeGradeId) { c.innerHTML = '<p class="empty-text">左の学年を選択してください</p>'; return; }
    if (classesList.length === 0) { c.innerHTML = '<p class="empty-text">クラスがありません</p>'; return; }
    c.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;">${classesList.map(cl => `
        <div style="background:#f5f5f5;padding:8px 14px;border-radius:8px;display:flex;align-items:center;gap:8px;">
            <span>${cl.name}</span>
            <button class="btn-icon btn-danger" onclick="window.deleteClass('${cl.id}')" title="削除" style="font-size:12px;">×</button>
        </div>
    `).join('')}</div>`;
}

window.deleteClass = async (classId) => {
    if (!confirm('クラスを削除しますか？')) return;
    try { await deleteClassFn({ schoolId: activeSchoolId, gradeId: activeGradeId, classId }); showToast('削除しました', 'success'); loadClassesForGrade(activeSchoolId, activeGradeId); }
    catch (e) { showToast('エラー: ' + e.message, 'error'); }
};

document.getElementById('createClassBtn').addEventListener('click', () => {
    if (!activeGradeId) { showToast('先に学年を選択してください', 'error'); return; }
    showGenericModal('クラスを追加', '<div class="form-group"><label>クラス名</label><input type="text" id="inp-class-name" placeholder="例: A組"></div>', async () => {
        const name = document.getElementById('inp-class-name').value;
        if (!name) { showToast('クラス名を入力してください', 'error'); return; }
        try { await createClassFn({ schoolId: activeSchoolId, gradeId: activeGradeId, name }); showToast('クラスを作成しました', 'success'); document.getElementById('genericModal').style.display = 'none'; loadClassesForGrade(activeSchoolId, activeGradeId); }
        catch (e) { showToast('エラー: ' + e.message, 'error'); }
    });
});

// ========== ユーザー・メンバー統合管理 ==========
async function loadUsersAndMembers() {
    const container = document.getElementById('userTableContainer');
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>読み込み中...</p></div>';
    try {
        const [usersResult, membersResult] = await Promise.all([
            listUsersFn(),
            listMembersFn({ schoolId: activeSchoolId }).catch(() => ({ data: { members: [] } }))
        ]);
        usersData = usersResult.data.users || [];
        membersData = membersResult.data.members || [];
        renderUnifiedUserTable();
    } catch (e) { container.innerHTML = `<p class="error-text">エラー: ${e.message}</p>`; }
}

function renderUnifiedUserTable() {
    const container = document.getElementById('userTableContainer');
    if (usersData.length === 0) { container.innerHTML = '<p class="empty-text">ユーザーがいません</p>'; return; }

    const memberMap = {};
    membersData.forEach(m => { memberMap[m.userId] = m; });

    const roleLabels = { system_admin: 'システム管理者', school_admin: '学校管理者', teacher: '教員', editor: '編集者' };
    const roleOptions = ['school_admin', 'teacher', 'editor'].map(r => `<option value="${r}">${roleLabels[r]}</option>`).join('');

    const rows = usersData.map(user => {
        const member = memberMap[user.uid];
        const isCurrent = user.uid === currentUserUid;
        const currentRole = member ? member.role : '';
        const lastSignIn = user.lastSignInTime ? new Date(user.lastSignInTime).toLocaleString('ja-JP') : '-';

        let roleCell;
        if (user.isAdmin) {
            roleCell = `<span class="badge badge-admin">システム管理者</span>`;
        } else if (member) {
            roleCell = `<select class="role-dropdown" data-uid="${user.uid}" data-current="${currentRole}">
                ${['school_admin','teacher','editor'].map(r => `<option value="${r}" ${r === currentRole ? 'selected' : ''}>${roleLabels[r]}</option>`).join('')}
            </select>`;
        } else {
            roleCell = `<button class="btn btn-sm btn-secondary" onclick="window.addMember('${user.uid}', '${user.email}')">メンバー追加</button>`;
        }

        return `<tr>
            <td>${user.email}${isCurrent ? ' <span class="current-user-badge">(自分)</span>' : ''}</td>
            <td>${user.displayName || '-'}</td>
            <td>${roleCell}</td>
            <td><span class="badge ${user.disabled ? 'badge-disabled' : 'badge-active'}">${user.disabled ? '無効' : '有効'}</span></td>
            <td class="last-signin">${lastSignIn}</td>
            <td><div class="action-buttons">
                <button class="btn-icon" onclick="window.editUser('${user.uid}')" title="編集">✏️</button>
                ${!isCurrent ? `
                    <button class="btn-icon" onclick="window.toggleStatus('${user.uid}', ${!user.disabled})" title="${user.disabled ? '有効化' : '無効化'}">${user.disabled ? '✅' : '🚫'}</button>
                    ${member ? `<button class="btn-icon" onclick="window.removeMemberFromSchool('${user.uid}')" title="メンバー除外">👤</button>` : ''}
                    <button class="btn-icon btn-danger" onclick="window.deleteUserAction('${user.uid}')" title="削除">🗑️</button>
                ` : ''}
            </div></td>
        </tr>`;
    }).join('');

    container.innerHTML = `<table class="user-table"><thead><tr>
        <th>メール</th><th>名前</th><th>ロール</th><th>状態</th><th>最終ログイン</th><th>操作</th>
    </tr></thead><tbody>${rows}</tbody></table>`;

    // ドロップダウン変更ハンドラ
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

// ユーザー作成/編集モーダル
document.getElementById('createUserBtn').addEventListener('click', () => {
    document.getElementById('userModalTitle').textContent = 'ユーザー作成';
    document.getElementById('userModalUid').value = '';
    document.getElementById('userModalEmail').value = '';
    document.getElementById('userModalName').value = '';
    document.getElementById('userModalPassword').value = '';
    document.getElementById('userModalAdmin').checked = false;
    document.getElementById('userModal').style.display = 'flex';
});

window.editUser = (uid) => {
    const user = usersData.find(u => u.uid === uid);
    if (!user) return;
    document.getElementById('userModalTitle').textContent = 'ユーザー編集';
    document.getElementById('userModalUid').value = uid;
    document.getElementById('userModalEmail').value = user.email;
    document.getElementById('userModalName').value = user.displayName || '';
    document.getElementById('userModalPassword').value = '';
    document.getElementById('userModalAdmin').checked = user.isAdmin;
    document.getElementById('userModal').style.display = 'flex';
};

document.getElementById('userModalSave').addEventListener('click', async () => {
    const uid = document.getElementById('userModalUid').value;
    const email = document.getElementById('userModalEmail').value;
    const displayName = document.getElementById('userModalName').value;
    const password = document.getElementById('userModalPassword').value;
    const setAsAdmin = document.getElementById('userModalAdmin').checked;

    try {
        if (uid) {
            // 編集
            await updateUserFn({ uid, email, displayName, password: password || undefined });
            // 管理者権限変更
            const user = usersData.find(u => u.uid === uid);
            if (user && user.isAdmin !== setAsAdmin) {
                await setAdminRoleFn({ uid, isAdmin: setAsAdmin });
            }
        } else {
            // 新規作成
            if (!email || !password) { showToast('メールとパスワードは必須です', 'error'); return; }
            await createAdminUserFn({ email, password, displayName, setAsAdmin });
        }
        showToast('保存しました', 'success');
        document.getElementById('userModal').style.display = 'none';
        loadUsersAndMembers();
    } catch (e) { showToast('エラー: ' + e.message, 'error'); }
});

window.addMember = async (uid, email) => {
    try {
        await inviteMemberFn({ schoolId: activeSchoolId, email, role: 'teacher' });
        showToast(`${email} をメンバーに追加しました`, 'success');
        loadUsersAndMembers();
    } catch (e) { showToast('エラー: ' + e.message, 'error'); }
};

window.removeMemberFromSchool = async (uid) => {
    if (!confirm('この学校のメンバーから除外しますか？')) return;
    try { await removeMemberFn({ schoolId: activeSchoolId, userId: uid }); showToast('除外しました', 'success'); loadUsersAndMembers(); }
    catch (e) { showToast('エラー: ' + e.message, 'error'); }
};

window.toggleStatus = async (uid, disabled) => {
    try { await toggleUserStatusFn({ uid, disabled }); showToast(disabled ? '無効化しました' : '有効化しました', 'success'); loadUsersAndMembers(); }
    catch (e) { showToast('エラー: ' + e.message, 'error'); }
};

window.deleteUserAction = async (uid) => {
    if (!confirm('ユーザーを完全に削除しますか？')) return;
    try { await deleteUserFn({ uid }); showToast('削除しました', 'success'); loadUsersAndMembers(); }
    catch (e) { showToast('エラー: ' + e.message, 'error'); }
};

// ========== デバイス管理 ==========
let devicesList = [];

async function loadDevices(schoolId) {
    const c = document.getElementById('deviceListContainer');
    try {
        const r = await listDevicesFn({ schoolId });
        devicesList = r.data.devices || [];
        renderDeviceList();
    } catch (e) { c.innerHTML = `<p class="error-text">${e.message}</p>`; }
}

function renderDeviceList() {
    const c = document.getElementById('deviceListContainer');
    if (devicesList.length === 0) { c.innerHTML = '<p class="empty-text">端末が未登録</p>'; return; }

    const rows = devicesList.map(d => {
        const grade = gradesList.find(g => g.id === d.gradeId);
        const gradeName = grade ? grade.name : d.gradeId || '-';
        const statusBadge = d.status === 'online' ? '<span class="badge badge-active">オンライン</span>' : '<span class="badge badge-disabled">オフライン</span>';
        return `<tr>
            <td>${d.name}</td><td>${gradeName}</td><td>${d.classId || '-'}</td><td>${statusBadge}</td>
            <td><div class="action-buttons">
                <button class="btn-icon" onclick="window.revokeDevice('${d.id}')" title="トークン再発行">🔄</button>
                <button class="btn-icon btn-danger" onclick="window.removeDevice('${d.id}')" title="削除">🗑️</button>
            </div></td>
        </tr>`;
    }).join('');
    c.innerHTML = `<table class="user-table"><thead><tr><th>端末名</th><th>学年</th><th>クラス</th><th>状態</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table>`;
}

document.getElementById('registerDeviceBtn').addEventListener('click', () => {
    const gradeOpts = gradesList.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    showGenericModal('端末を登録',
        `<div class="form-group"><label>端末名</label><input type="text" id="inp-device-name" placeholder="例: 1A教室モニター"></div>
         <div class="form-group"><label>学年</label><select id="inp-device-grade">${gradeOpts}</select></div>
         <div class="form-group"><label>クラスID</label><input type="text" id="inp-device-class" placeholder="クラスIDを入力"></div>`,
        async () => {
            const name = document.getElementById('inp-device-name').value;
            const gradeId = document.getElementById('inp-device-grade').value;
            const classId = document.getElementById('inp-device-class').value;
            if (!name || !gradeId || !classId) { showToast('全項目を入力してください', 'error'); return; }
            try {
                const r = await registerDeviceFn({ schoolId: activeSchoolId, gradeId, classId, name });
                document.getElementById('genericModal').style.display = 'none';
                const signageUrl = `${window.location.origin}/?token=${encodeURIComponent(r.data.deviceToken)}&kiosk=1`;
                alert(`デバイストークン:\n${r.data.deviceToken}\n\nサイネージURL:\n${signageUrl}`);
                loadDevices(activeSchoolId);
            } catch (e) { showToast('エラー: ' + e.message, 'error'); }
        }
    );
});

window.revokeDevice = async (deviceId) => {
    if (!confirm('トークンを再発行しますか？')) return;
    try {
        const r = await revokeDeviceTokenFn({ schoolId: activeSchoolId, deviceId });
        alert(`新トークン:\n${r.data.deviceToken}`);
    } catch (e) { showToast('エラー: ' + e.message, 'error'); }
};
window.removeDevice = async (deviceId) => {
    if (!confirm('端末を削除しますか？')) return;
    try { await removeDeviceFn({ schoolId: activeSchoolId, deviceId }); showToast('削除しました', 'success'); loadDevices(activeSchoolId); }
    catch (e) { showToast('エラー: ' + e.message, 'error'); }
};

// ========== エディターパスワード ==========
async function loadEditorPassword() {
    try {
        const snap = await getDoc(doc(db, "schools", activeSchoolId, "config", "editor_auth"));
        if (snap.exists()) document.getElementById('editorPasswordInput').value = snap.data().password || '';
    } catch (e) { /* ignore */ }
}
document.getElementById('saveEditorPasswordBtn').addEventListener('click', async () => {
    const pw = document.getElementById('editorPasswordInput').value;
    if (pw.length < 4) { showToast('4文字以上必要です', 'error'); return; }
    try { await setEditorPasswordFn({ password: pw, schoolId: activeSchoolId }); showToast('保存しました', 'success'); }
    catch (e) { showToast('エラー: ' + e.message, 'error'); }
});

// ========== 授業時間 ==========
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
            <input type="time" value="${item.start||'08:30'}" onchange="window.updateQH(${idx},'start',this.value)">
            <span>〜</span>
            <input type="time" value="${item.end||'15:30'}" onchange="window.updateQH(${idx},'end',this.value)">
            <button class="btn-icon btn-danger" onclick="window.removeQH(${idx})">×</button>
        </div>
    `).join('');
}
window.updateQH = (i, f, v) => { if (quietHours[i]) quietHours[i][f] = v; };
window.removeQH = (i) => { quietHours.splice(i, 1); renderQuietHours(); };
document.getElementById('addQuietHourBtn').addEventListener('click', () => { quietHours.push({ start: '08:30', end: '15:30' }); renderQuietHours(); });
document.getElementById('saveQuietHoursBtn').addEventListener('click', async () => {
    try { await setDoc(doc(db, "schools", activeSchoolId, "config", "display_settings"), { quiet_hours: quietHours }, { merge: true }); showToast('保存しました', 'success'); }
    catch (e) { showToast('エラー: ' + e.message, 'error'); }
});

// ========== 広告管理（クラス単位） ==========

// 広告用の学年・クラスセレクタを初期化
function initAdSelectors() {
    const gradeSelect = document.getElementById('adGradeSelect');
    const classSelect = document.getElementById('adClassSelect');
    gradeSelect.innerHTML = '<option value="">-- 学年を選択 --</option>' +
        gradesList.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    classSelect.innerHTML = '<option value="">-- クラスを選択 --</option>';
    adGradeId = null; adClassId = null; adClassesList = [];
    adsData = [];
    renderAdList();
}

document.getElementById('adGradeSelect')?.addEventListener('change', async (e) => {
    adGradeId = e.target.value || null;
    adClassId = null;
    const classSelect = document.getElementById('adClassSelect');
    if (adGradeId) {
        try {
            const r = await listClassesFn({ schoolId: activeSchoolId, gradeId: adGradeId });
            adClassesList = r.data.classes || [];
        } catch (err) { adClassesList = []; }
        classSelect.innerHTML = '<option value="">-- クラスを選択 --</option>' +
            adClassesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } else {
        adClassesList = [];
        classSelect.innerHTML = '<option value="">-- クラスを選択 --</option>';
    }
    adsData = []; renderAdList();
});

document.getElementById('adClassSelect')?.addEventListener('change', (e) => {
    adClassId = e.target.value || null;
    if (adClassId) { loadAds(); }
    else { adsData = []; renderAdList(); }
});

function getAdClassRef() {
    if (!adGradeId || !adClassId) return null;
    return doc(db, "schools", activeSchoolId, "grades", adGradeId, "classes", adClassId);
}

async function loadAds() {
    const classRef = getAdClassRef();
    if (!classRef) { adsData = []; renderAdList(); return; }
    try {
        const snap = await getDoc(classRef);
        const settings = snap.exists() ? (snap.data().displaySettings || {}) : {};
        adsData = settings.ads || [];
        renderAdList();
    } catch (e) { adsData = []; renderAdList(); }
}

async function saveAds() {
    const classRef = getAdClassRef();
    if (!classRef) return;
    const snap = await getDoc(classRef);
    const current = snap.exists() ? (snap.data().displaySettings || {}) : {};
    current.ads = adsData;
    await updateDoc(classRef, { displaySettings: current });
}

function renderAdList() {
    const c = document.getElementById('adListContainer');
    const addBtn = document.getElementById('addAdBtn');

    if (!adGradeId || !adClassId) {
        c.innerHTML = '<p class="empty-text">上のセレクタで学年・クラスを選択してください</p>';
        if (addBtn) addBtn.style.display = 'none';
        return;
    }

    if (adsData.length === 0) { c.innerHTML = '<p class="empty-text">広告未登録</p>'; }
    else {
        c.innerHTML = adsData.map((ad, idx) => `
            <div class="ad-management-item" draggable="true" data-index="${idx}">
                <div class="ad-drag-handle">☰</div>
                ${ad.type === 'video' ? `<video src="${ad.url}" class="ad-thumbnail" muted playsinline onmouseenter="this.play()" onmouseleave="this.pause();this.currentTime=0;"></video>` : `<img src="${ad.url}" class="ad-thumbnail" onerror="this.src='https://placehold.jp/80x60.png?text=Error'">`}
                <div class="ad-details"><p>${ad.type === 'video' ? '動画' : '画像'} ${idx+1}</p></div>
                <div class="ad-actions-group">
                    <button class="btn btn-sm" onclick="window.replaceAd(${idx})">変更</button>
                    <button class="btn btn-sm btn-danger" onclick="window.deleteAd(${idx})">削除</button>
                </div>
            </div>
        `).join('');
    }
    if (addBtn) addBtn.style.display = adsData.length >= 5 ? 'none' : '';
}

window.replaceAd = (idx) => {
    if (!getAdClassRef()) { showToast('クラスを選択してください', 'error'); return; }
    pendingAdAction = { type: 'replace', index: idx }; document.getElementById('adFileInput').click();
};
window.deleteAd = async (idx) => {
    if (!confirm('削除しますか？')) return;
    adsData.splice(idx, 1);
    await saveAds();
    showToast('削除しました', 'success'); renderAdList();
};
document.getElementById('addAdBtn').addEventListener('click', () => {
    if (!getAdClassRef()) { showToast('学年・クラスを選択してください', 'error'); return; }
    if (adsData.length >= 5) { showToast('最大5枚です', 'error'); return; }
    pendingAdAction = 'add'; document.getElementById('adFileInput').click();
});
document.getElementById('adFileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!getAdClassRef()) { showToast('クラスを選択してください', 'error'); e.target.value = ''; return; }
    const isVideo = file.type.startsWith('video/');
    try {
        showToast('アップロード中...', 'success');
        const folder = isVideo ? 'videos' : 'ads';
        const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        const newAd = { id: `ad_${Date.now()}`, type: isVideo ? 'video' : 'image', url, link_url: '', duration_sec: isVideo ? 0 : 10 };
        if (pendingAdAction === 'add') adsData.push(newAd);
        else if (pendingAdAction?.type === 'replace') adsData[pendingAdAction.index] = { ...adsData[pendingAdAction.index], ...newAd };
        await saveAds();
        showToast('アップロードしました', 'success'); renderAdList();
    } catch (err) { showToast('エラー: ' + err.message, 'error'); }
    e.target.value = ''; pendingAdAction = null;
});

// ========== データ移行 ==========
document.getElementById('migrateBtn').addEventListener('click', async () => {
    if (!confirm('既存データを学年構造にコピーしますか？')) return;
    const rd = document.getElementById('migrateResult');
    rd.textContent = '移行中...';
    try {
        const r = await migrateToGradeStructureFn({ schoolId: activeSchoolId });
        rd.innerHTML = `<span style="color:green;">${r.data.message}</span>`;
        loadGrades(activeSchoolId);
    } catch (e) { rd.innerHTML = `<span style="color:red;">エラー: ${e.message}</span>`; }
});
