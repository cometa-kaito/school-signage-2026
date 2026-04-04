// admin-app.js - サイネージ管理（コンテンツ登録）画面ロジック

import {
    db,
    SCHOOL_ID, GRADE_ID, CLASS_ID,
    login,
    loginWithGoogle,
    loginAsEditor,
    logout,
    onAuthChange,
    isUserAdmin,
    isUserTeacher,
    hasAnyAccess
} from './config.js';
import {
    doc,
    setDoc,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { hasFullContext, renderContextSelector, redirectWithContext } from './context-selector.js';

// Firebase SDK読み込み成功を通知
window.firebaseLoaded = true;

// DOM要素
const loginContainer = document.getElementById('loginContainer');
const appContainer = document.getElementById('appContainer');
const loginError = document.getElementById('loginError');
const successMsg = document.getElementById('successMsg');
const errorMsg = document.getElementById('errorMsg');

// アプリ状態
let currentMode = 'schedule';
let appInitialized = false;

// タブ切り替え
document.querySelectorAll('.login-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tabName = tab.dataset.tab;
        document.getElementById('editorLoginForm').style.display = tabName === 'editor' ? 'block' : 'none';
        document.getElementById('loginForm').style.display = tabName === 'admin' ? 'block' : 'none';
        hideError();
    });
});

// 認証状態の監視
onAuthChange(async (user) => {
    if (user) {
        showLoading();
        const canAccess = await hasAnyAccess(user);
        if (canAccess) {
            hideLoading();
            showApp(user);
        } else {
            hideLoading();
            await logout();
            showError('アクセス権限がありません');
        }
    } else {
        hideLoading();
        showLogin();
    }
});

// エディターログインフォーム（パスワードのみ）
document.getElementById('editorLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('editorPassword').value;
    const btn = document.getElementById('editorLoginBtn');
    btn.disabled = true;
    btn.textContent = 'ログイン中...';
    hideError();
    showLoading();
    const result = await loginAsEditor(password);
    if (!result.success) { hideLoading(); showError(result.error); }
    btn.disabled = false;
    btn.textContent = 'ログイン';
});

// 管理者ログインフォーム
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.textContent = 'ログイン中...';
    hideError();
    showLoading();
    const result = await login(email, password);
    if (!result.success) { hideLoading(); showError(result.error); }
    btn.disabled = false;
    btn.textContent = 'ログイン';
});

// Googleログイン
document.getElementById('googleLoginBtn').addEventListener('click', async () => {
    hideError();
    showLoading();
    const result = await loginWithGoogle();
    if (!result.success) { hideLoading(); showError(result.error); }
});

// ログアウト
document.getElementById('logoutBtn').addEventListener('click', () => logout());

// UI表示切替
function showApp(user) {
    loginContainer.style.display = 'none';
    appContainer.style.display = 'block';
    document.getElementById('userEmail').textContent = user.email;

    // URLパラメータが揃っていない場合はコンテキスト選択画面を表示
    if (!hasFullContext()) {
        document.getElementById('adminContent').style.display = 'none';
        document.getElementById('contextSelectorView').style.display = 'block';
        renderContextSelector('contextSelectorView', (schoolId, gradeId, classId) => {
            redirectWithContext(schoolId, gradeId, classId);
        });
        return;
    }

    // コンテキスト情報をヘッダーに表示
    const label = document.getElementById('contextLabel');
    if (label) {
        label.textContent = `${SCHOOL_ID} / ${GRADE_ID} / ${CLASS_ID}`;
    }

    initApp();
}

function showLogin() {
    loginContainer.style.display = 'flex';
    appContainer.style.display = 'none';
}

function showError(msg) {
    loginError.textContent = msg;
    loginError.style.display = 'block';
}

function hideError() {
    loginError.style.display = 'none';
}

function showLoading() { document.getElementById('loadingOverlay').style.display = 'flex'; }
function hideLoading() { document.getElementById('loadingOverlay').style.display = 'none'; }
async function withLoading(fn) { showLoading(); try { return await fn(); } finally { hideLoading(); } }

// アプリ初期化
function initApp() {
    if (appInitialized) return;
    appInitialized = true;

    document.getElementById('target-date').value = new Date().toISOString().split('T')[0];

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.getElementById('submitBtn').addEventListener('click', submitData);
}

function switchTab(type) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('[id^="form-"]').forEach(f => f.classList.add('hidden'));
    document.querySelector(`[data-tab="${type}"]`).classList.add('active');
    document.getElementById(`form-${type}`).classList.remove('hidden');
    currentMode = type;

    // 提出物タブの場合は対象日カードを無効化（入力不可）
    const targetDateCard = document.getElementById('target-date-card');
    const targetDateInput = document.getElementById('target-date');
    if (targetDateCard && targetDateInput) {
        if (type === 'assignment') {
            targetDateCard.classList.add('disabled');
            targetDateInput.disabled = true;
        } else {
            targetDateCard.classList.remove('disabled');
            targetDateInput.disabled = false;
        }
    }
}

// その他選択時の自由入力表示切り替え
window.toggleCustomTime = function() {
    const select = document.getElementById('sched-time-select');
    const customGroup = document.getElementById('custom-time-group');
    if (select && customGroup) {
        customGroup.style.display = select.value === 'その他' ? 'block' : 'none';
    }
};

// オプションセクションの表示切り替え
window.toggleOptional = function(id) {
    const el = document.getElementById(id);
    const header = el?.previousElementSibling;
    if (el) {
        const isHidden = el.classList.contains('hidden');
        el.classList.toggle('hidden');
        if (header) {
            header.textContent = (isHidden ? '▼' : '▶') + ' 表示期間（オプション）';
        }
    }
};

async function submitData() {
    const btn = document.getElementById('submitBtn');

    btn.disabled = true;
    btn.textContent = '送信中...';
    successMsg.style.display = 'none';
    errorMsg.style.display = 'none';
    showLoading();

    try {
        let dateStr;

        if (currentMode === 'assignment') {
            // 提出物の場合は期限日をドキュメントのキーとして使用
            dateStr = document.getElementById('assign-deadline').value;
            if (!dateStr) throw new Error("提出期限を選択してください");
        } else {
            // 予定・連絡の場合は対象日を使用
            dateStr = document.getElementById('target-date').value;
            if (!dateStr) throw new Error("対象日を選択してください");
        }

        const docRef = doc(db, "schools", SCHOOL_ID, "grades", GRADE_ID, "classes", CLASS_ID, "daily_data", dateStr);
        const updateData = buildUpdateData(dateStr);

        await setDoc(docRef, updateData, { merge: true });

        clearForm();
        successMsg.style.display = 'block';
        setTimeout(() => successMsg.style.display = 'none', 3000);
    } catch (error) {
        errorMsg.textContent = 'エラー: ' + error.message;
        errorMsg.style.display = 'block';
    } finally {
        hideLoading();
        btn.disabled = false;
        btn.textContent = '登録する';
    }
}

function buildUpdateData(dateStr) {
    const builders = {
        schedule: () => {
            const content = document.getElementById('sched-content').value;
            if (!content) throw new Error("内容を入力してください");

            const selectValue = document.getElementById('sched-time-select').value;
            const customValue = document.getElementById('sched-time-custom').value;
            const time = selectValue === 'その他' ? customValue : selectValue;

            const scheduleData = {
                time: time,
                content,
                location: document.getElementById('sched-location').value
            };

            // 表示期間（オプション）
            const displayStart = document.getElementById('sched-display-start').value;
            const displayEnd = document.getElementById('sched-display-end').value;
            if (displayStart) scheduleData.display_start = displayStart;
            if (displayEnd) scheduleData.display_end = displayEnd;

            return {
                date: dateStr,
                schedules: arrayUnion(scheduleData)
            };
        },
        notice: () => {
            const text = document.getElementById('notice-text').value;
            if (!text) throw new Error("内容を入力してください");

            const noticeData = {
                text,
                is_highlight: document.getElementById('notice-highlight').checked,
                play_sound: document.getElementById('notice-sound').checked
            };

            // 表示期間（オプション）
            const displayStart = document.getElementById('notice-display-start').value;
            const displayEnd = document.getElementById('notice-display-end').value;
            if (displayStart) noticeData.display_start = displayStart;
            if (displayEnd) noticeData.display_end = displayEnd;

            return {
                date: dateStr,
                notices: arrayUnion(noticeData)
            };
        },
        assignment: () => {
            const deadline = document.getElementById('assign-deadline').value;
            const task = document.getElementById('assign-task').value;
            if (!deadline || !task) throw new Error("期限と提出物を入力してください");
            return {
                date: deadline,
                assignments: arrayUnion({
                    deadline,
                    subject: document.getElementById('assign-subject').value,
                    task
                })
            };
        }
    };

    return builders[currentMode]();
}

function clearForm() {
    document.querySelectorAll('input[type="text"], textarea').forEach(el => el.value = '');
    const highlightCheckbox = document.getElementById('notice-highlight');
    if (highlightCheckbox) highlightCheckbox.checked = false;
    const soundCheckbox = document.getElementById('notice-sound');
    if (soundCheckbox) soundCheckbox.checked = false;

    // ドロップダウンをリセット
    const timeSelect = document.getElementById('sched-time-select');
    if (timeSelect) timeSelect.value = '';

    // カスタム時間入力を非表示
    const customGroup = document.getElementById('custom-time-group');
    if (customGroup) customGroup.style.display = 'none';

    // 表示期間フィールドをクリア
    const displayFields = [
        'sched-display-start', 'sched-display-end',
        'notice-display-start', 'notice-display-end'
    ];
    displayFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    // オプションセクションを閉じる
    document.querySelectorAll('.optional-fields').forEach(el => {
        el.classList.add('hidden');
        const header = el.previousElementSibling;
        if (header) header.textContent = '▶ 表示期間（オプション）';
    });
}
