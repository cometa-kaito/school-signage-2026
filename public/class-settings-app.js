// class-settings-app.js - クラス設定ページ（広告管理 + 授業時間設定）

import {
    db, storage, SCHOOL_ID, GRADE_ID, CLASS_ID,
    login, loginWithGoogle, logout, onAuthChange, isUserAdmin, isUserTeacher, hasAnyAccess, getUserRoleLabel
} from './config.js';
import { doc, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { hasFullContext, renderContextSelector, redirectWithContext } from './context-selector.js';

window.firebaseLoaded = true;

const loginContainer = document.getElementById('loginContainer');
const appContainer = document.getElementById('appContainer');
const loginError = document.getElementById('loginError');

let activeSchoolId = SCHOOL_ID;
let activeGradeId = GRADE_ID;
let activeClassId = CLASS_ID;
let adsData = [], pendingAdAction = null;
let quietHours = [];

// ========================================
// ユーティリティ
// ========================================

function showLoginError(msg) { loginError.textContent = msg; loginError.style.display = 'block'; }
function showToast(msg, type) {
    const existing = document.querySelector('.toast'); if (existing) existing.remove();
    const t = document.createElement('div'); t.className = `toast toast-${type}`; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 4000);
}
function showLoading() { document.getElementById('loadingOverlay').style.display = 'flex'; }
function hideLoading() { document.getElementById('loadingOverlay').style.display = 'none'; }
async function withLoading(fn) { showLoading(); try { return await fn(); } finally { hideLoading(); } }

// ========================================
// 認証
// ========================================

onAuthChange(async (user) => {
    if (user) {
        showLoading();
        const canAccess = await hasAnyAccess(user);
        if (canAccess) {
            loginContainer.style.display = 'none';
            appContainer.style.display = 'block';
            const roleLabel = await getUserRoleLabel(user);
            document.getElementById('userEmail').textContent = `${user.email}${roleLabel ? ` (${roleLabel})` : ''}`;
            hideLoading();
            initPage();
        } else { hideLoading(); await logout(); showLoginError('アクセス権限がありません'); }
    } else { hideLoading(); loginContainer.style.display = 'flex'; appContainer.style.display = 'none'; }
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.textContent = 'ログイン中...'; loginError.style.display = 'none';
    showLoading();
    const result = await login(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
    if (!result.success) { hideLoading(); showLoginError(result.error); }
    btn.disabled = false; btn.textContent = 'ログイン';
});
document.getElementById('googleLoginBtn').addEventListener('click', async () => {
    loginError.style.display = 'none';
    showLoading();
    const result = await loginWithGoogle();
    if (!result.success) { hideLoading(); showLoginError(result.error); }
});
document.getElementById('logoutBtn').addEventListener('click', () => logout());

// ========================================
// ページ初期化
// ========================================

function initPage() {
    if (!hasFullContext()) {
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('contextSelectorView').style.display = 'block';
        renderContextSelector('contextSelectorView', (schoolId, gradeId, classId) => {
            redirectWithContext(schoolId, gradeId, classId);
        });
        return;
    }

    activeSchoolId = SCHOOL_ID;
    activeGradeId = GRADE_ID;
    activeClassId = CLASS_ID;

    // パンくずリンク
    document.getElementById('backLink').href = `school-admin.html?school=${activeSchoolId}`;

    // ヘッダー表示
    loadClassInfo();
    loadAds();
    loadQuietHours();
}

async function loadClassInfo() {
    try {
        const [schoolSnap, gradeSnap, classSnap] = await Promise.all([
            getDoc(doc(db, "schools", activeSchoolId)),
            getDoc(doc(db, "schools", activeSchoolId, "grades", activeGradeId)),
            getDoc(getClassRef())
        ]);
        const schoolName = schoolSnap.exists() ? (schoolSnap.data().name || activeSchoolId) : activeSchoolId;
        const gradeName = gradeSnap.exists() ? (gradeSnap.data().name || activeGradeId) : activeGradeId;
        const className = classSnap.exists() ? (classSnap.data().name || activeClassId) : activeClassId;
        document.getElementById('classHeader').textContent = `${className} の設定`;
        document.getElementById('classSubheader').textContent = `${schoolName} / ${gradeName} / ${className}`;
        document.getElementById('pageTitle').textContent = `${className} - クラス設定`;
    } catch (e) {
        document.getElementById('classHeader').textContent = 'クラス設定';
    }
}

// ========================================
// Firestoreパス
// ========================================

function getClassRef() {
    return doc(db, "schools", activeSchoolId, "grades", activeGradeId, "classes", activeClassId);
}

// ========================================
// 広告管理
// ========================================

async function loadAds() {
    const classRef = getClassRef();
    try {
        const snap = await getDoc(classRef);
        const settings = snap.exists() ? (snap.data().displaySettings || {}) : {};
        adsData = settings.ads || [];
        renderAdList();
    } catch (e) { adsData = []; renderAdList(); }
}

async function saveAds() {
    const classRef = getClassRef();
    const snap = await getDoc(classRef);
    const current = snap.exists() ? (snap.data().displaySettings || {}) : {};
    current.ads = adsData;
    await updateDoc(classRef, { displaySettings: current });
}

function renderAdList() {
    const c = document.getElementById('adListContainer');
    const addBtn = document.getElementById('addAdBtn');

    if (adsData.length === 0) { c.innerHTML = '<p class="empty-text">広告未登録</p>'; }
    else {
        c.innerHTML = adsData.map((ad, idx) => `
            <div class="ad-management-item" draggable="true" data-index="${idx}">
                <div class="ad-drag-handle">☰</div>
                ${ad.type === 'video' ? `<video src="${ad.url}" class="ad-thumbnail" muted playsinline onmouseenter="this.play()" onmouseleave="this.pause();this.currentTime=0;"></video>` : `<img src="${ad.url}" class="ad-thumbnail" onerror="this.src='https://placehold.jp/80x60.png?text=Error'">`}
                <div class="ad-details" style="flex:1;min-width:0;">
                    <p style="margin:0 0 6px 0;font-weight:500;">${ad.type === 'video' ? '動画' : '画像'} ${idx + 1}</p>
                    <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">
                        <span style="font-size:11px;color:#888;white-space:nowrap;">URL:</span>
                        <input type="text" id="ad-link-${idx}" placeholder="https://example.com" value="${ad.link_url || ''}" style="flex:1;font-size:12px;padding:4px 6px;border:1px solid #ddd;border-radius:4px;min-width:0;">
                    </div>
                    <div style="display:flex;align-items:center;gap:4px;">
                        <span style="font-size:11px;color:#888;white-space:nowrap;">表示秒数:</span>
                        <input type="number" id="ad-duration-${idx}" value="${ad.duration_sec || 10}" min="3" max="120" style="width:60px;font-size:12px;padding:4px 6px;border:1px solid #ddd;border-radius:4px;">
                        <span style="font-size:11px;color:#888;">秒</span>
                        <button class="btn btn-sm" onclick="window.saveAdSettings(${idx})" style="font-size:11px;padding:3px 8px;white-space:nowrap;margin-left:auto;">設定を保存</button>
                    </div>
                </div>
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
    pendingAdAction = { type: 'replace', index: idx };
    document.getElementById('adFileInput').click();
};

window.deleteAd = async (idx) => {
    if (!confirm('削除しますか？')) return;
    await withLoading(async () => {
        adsData.splice(idx, 1);
        await saveAds();
        showToast('削除しました', 'success');
        renderAdList();
    });
};

window.saveAdSettings = async (idx) => {
    const linkInput = document.getElementById(`ad-link-${idx}`);
    const durationInput = document.getElementById(`ad-duration-${idx}`);
    const linkUrl = (linkInput?.value || '').trim();
    const duration = parseInt(durationInput?.value || '10', 10);

    if (linkUrl && !linkUrl.match(/^https?:\/\//)) {
        showToast('URLは http:// または https:// で始めてください', 'error');
        return;
    }

    await withLoading(async () => {
        adsData[idx].link_url = linkUrl;
        adsData[idx].duration_sec = Math.max(3, Math.min(120, duration));
        await saveAds();
        showToast('設定を保存しました', 'success');
        renderAdList();
    });
};

document.getElementById('addAdBtn').addEventListener('click', () => {
    if (adsData.length >= 5) { showToast('最大5枚です', 'error'); return; }
    pendingAdAction = 'add';
    document.getElementById('adFileInput').click();
});

document.getElementById('adFileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const isVideo = file.type.startsWith('video/');
    await withLoading(async () => {
        try {
            const folder = isVideo ? 'videos' : 'ads';
            const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            const newAd = { id: `ad_${Date.now()}`, type: isVideo ? 'video' : 'image', url, link_url: '', duration_sec: isVideo ? 0 : 10 };
            if (pendingAdAction === 'add') adsData.push(newAd);
            else if (pendingAdAction?.type === 'replace') adsData[pendingAdAction.index] = { ...adsData[pendingAdAction.index], ...newAd };
            await saveAds();
            showToast('アップロードしました', 'success');
            renderAdList();
        } catch (err) { showToast('エラー: ' + err.message, 'error'); }
    });
    e.target.value = '';
    pendingAdAction = null;
});

// ========================================
// 授業時間設定（クラス個別）
// ========================================

async function loadQuietHours() {
    const classRef = getClassRef();
    try {
        const snap = await getDoc(classRef);
        const settings = snap.exists() ? (snap.data().displaySettings || {}) : {};
        quietHours = settings.quiet_hours || [];
        renderQuietHours();

        // マスター設定の存在を確認してメモ表示
        const masterSnap = await getDoc(doc(db, "schools", activeSchoolId, "config", "display_settings"));
        const masterQH = masterSnap.exists() ? (masterSnap.data().quiet_hours || []) : [];
        const note = document.getElementById('masterFallbackNote');
        if (quietHours.length === 0 && masterQH.length > 0) {
            note.style.display = 'block';
            note.textContent = `現在、学校マスター設定（${masterQH.map(q => q.start + '〜' + q.end).join(', ')}）が適用されています。`;
        } else if (quietHours.length === 0) {
            note.style.display = 'block';
            note.textContent = '授業時間が未設定です。学校マスター設定も未設定のため、広告は常時表示されます。';
        } else {
            note.style.display = 'none';
        }
    } catch (e) { quietHours = []; renderQuietHours(); }
}

function renderQuietHours() {
    const c = document.getElementById('quietHoursList');
    if (quietHours.length === 0) { c.innerHTML = '<p class="empty-text">未設定（学校マスター設定を使用）</p>'; return; }
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

document.getElementById('addQuietHourBtn').addEventListener('click', () => {
    quietHours.push({ start: '08:30', end: '15:30' });
    renderQuietHours();
});

document.getElementById('saveQuietHoursBtn').addEventListener('click', async () => {
    await withLoading(async () => {
        try {
            const classRef = getClassRef();
            const snap = await getDoc(classRef);
            const current = snap.exists() ? (snap.data().displaySettings || {}) : {};
            current.quiet_hours = quietHours;
            await updateDoc(classRef, { displaySettings: current });
            showToast('保存しました', 'success');
            loadQuietHours();
        } catch (e) { showToast('エラー: ' + e.message, 'error'); }
    });
});
