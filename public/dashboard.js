// dashboard.js - 管理者ダッシュボード

import { db, storage, SCHOOL_ID } from "./config.js";
import { UI } from "./ui.js";
import { getTodayString, startClock, formatDateKey } from "./utils.js";
import { 
    doc, 
    collection, 
    query, 
    where, 
    orderBy, 
    limit, 
    onSnapshot, 
    updateDoc, 
    getDoc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ========================================
// グローバル公開用オブジェクト
// ========================================
window.dashboard = {};

// ========================================
// アプリ状態
// ========================================
const appData = {
    className: "",
    weeklySchedules: {},
    notices: [],
    assignments: [],
    ads: []
};

// 編集状態
let currentEditType = null;
let currentTargetDate = null;
let currentIndex = null;
let pendingAdAction = null;

// 初期化フラグ
let listenersStarted = false;

// ========================================
// 初期化（認証後に呼ばれる）
// ========================================
window.dashboard.init = function() {
    if (listenersStarted) return;
    listenersStarted = true;
    
    startRealtimeListeners();
    setupAdFileListener();
    setupSaveButton();
    startClock('current-time', 'current-date');
};

// DOMContentLoadedでは時計だけ開始
document.addEventListener('DOMContentLoaded', () => {
    // 時計は認証前でも動かす
    startClock('current-time', 'current-date');
});

// ========================================
// Firestore監視
// ========================================
function startRealtimeListeners() {
    const todayStr = getTodayString();

    // 設定・広告の監視
    const configRef = doc(db, "schools", SCHOOL_ID, "config", "display_settings");
    onSnapshot(configRef, (snap) => {
        if (!snap.exists()) {
            // ドキュメントが存在しない場合はデフォルト値を使用
            appData.className = "";
            appData.ads = [];
        } else {
            const data = snap.data();
            appData.className = data.class_name || "";
            appData.ads = data.ads || [];
        }
        
        updateClassNameDisplay();
        updateAdPreview();
        updateAdModalIfOpen();
    }, (error) => {
        console.error("設定の監視エラー:", error);
        // エラー時もUIは表示
        updateClassNameDisplay();
        updateAdPreview();
    });

    // 日次データの監視（5日前から - 提出物表示用）
    const dailyRef = collection(db, "schools", SCHOOL_ID, "daily_data");
    
    // 5日前の日付を計算
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const fiveDaysAgoStr = formatDateKey(fiveDaysAgo);
    
    const q = query(
        dailyRef, 
        where("date", ">=", fiveDaysAgoStr), 
        orderBy("date", "asc"), 
        limit(10)
    );

    onSnapshot(q, (snapshot) => {
        appData.weeklySchedules = {};
        appData.notices = [];
        appData.assignments = [];

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const dateKey = data.date;
            
            // スケジュール: 今日以降のみ
            if (dateKey >= todayStr && data.schedules) {
                appData.weeklySchedules[dateKey] = data.schedules;
            }
            
            // 連絡: 今日のみ
            if (dateKey === todayStr) {
                appData.notices = data.notices || [];
            }
            
            // 提出物: 全ての日付から集める（後でフィルタ）
            if (data.assignments && data.assignments.length > 0) {
                appData.assignments = appData.assignments.concat(data.assignments);
            }
        });
        
        // 提出物を期限でソート
        appData.assignments.sort((a, b) => {
            return new Date(a.deadline) - new Date(b.deadline);
        });

        renderAllSections(todayStr);
    }, (error) => {
        console.error("日次データの監視エラー:", error);
        // エラー時も空のUIを表示
        renderAllSections(todayStr);
    });
}

// ========================================
// UI更新関数
// ========================================
function updateClassNameDisplay() {
    const el = document.getElementById('class-name');
    if (el) el.textContent = appData.className;
}

function updateAdPreview() {
    const imgEl = document.getElementById('ad-image');
    if (!imgEl) return;
    
    imgEl.src = appData.ads.length > 0 
        ? appData.ads[0].url 
        : "https://placehold.jp/300x400.png?text=No%20Image";
}

function updateAdModalIfOpen() {
    const adModal = document.getElementById('ad-modal');
    if (adModal && adModal.style.display === 'flex') {
        UI.renderAdList(appData.ads);
    }
}

function renderAllSections(todayStr) {
    const scheduleGrid = document.getElementById('schedule-grid');
    const noticeList = document.getElementById('notice-list');
    const assignmentList = document.getElementById('assignment-list');
    
    if (scheduleGrid) UI.renderSchedules(scheduleGrid, appData.weeklySchedules);
    if (noticeList) UI.renderNotices(noticeList, appData.notices, todayStr);
    if (assignmentList) UI.renderAssignments(assignmentList, appData.assignments, todayStr);
}

// ========================================
// モーダル制御
// ========================================
window.dashboard.openAdManager = () => {
    UI.renderAdList(appData.ads);
    showModal('ad-modal');
};

window.dashboard.openEditModal = (type, dateStr, index) => {
    currentEditType = type;
    currentTargetDate = dateStr;
    currentIndex = index;
    
    const dataMap = {
        schedule: appData.weeklySchedules[dateStr]?.[index],
        notice: appData.notices[index],
        assignment: appData.assignments[index]
    };
    
    UI.generateModalForm(type, "編集", dataMap[type]);
    showModal('edit-modal');
};

window.dashboard.openAddModal = (type, dateStr) => {
    currentEditType = type;
    currentTargetDate = dateStr || getTodayString();
    currentIndex = null;
    
    UI.generateModalForm(type, "追加", null);
    showModal('edit-modal');
};

window.dashboard.openConfigModal = () => {
    currentEditType = 'config';
    UI.generateModalForm('config', "クラス名設定", appData.className);
    showModal('edit-modal');
};

window.dashboard.closeModal = (id) => {
    hideModal(id);
};

function showModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'flex';
}

function hideModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

// ========================================
// 保存処理
// ========================================
function setupSaveButton() {
    const saveBtn = document.getElementById('btn-save');
    if (saveBtn) {
        saveBtn.addEventListener('click', handleSave);
    }
}

async function handleSave() {
    try {
        if (currentEditType === 'config') {
            await saveConfig();
        } else {
            await saveData();
        }
        hideModal('edit-modal');
    } catch (e) {
        console.error("保存エラー:", e);
        alert("保存エラー: " + e.message);
    }
}

async function saveConfig() {
    const value = document.getElementById('inp-class')?.value || '';
    const configRef = doc(db, "schools", SCHOOL_ID, "config", "display_settings");
    await updateDoc(configRef, { class_name: value });
}

async function saveData() {
    const docRef = doc(db, "schools", SCHOOL_ID, "daily_data", currentTargetDate);
    const snap = await getDoc(docRef);
    const docData = snap.exists() ? snap.data() : { date: currentTargetDate };

    const fieldMap = {
        schedule: 'schedules',
        notice: 'notices',
        assignment: 'assignments'
    };
    
    const field = fieldMap[currentEditType];
    const list = docData[field] || [];
    const newItem = getFormData();

    if (currentIndex !== null) {
        list[currentIndex] = newItem;
    } else {
        list.push(newItem);
    }

    if (snap.exists()) {
        await updateDoc(docRef, { [field]: list });
    } else {
        docData[field] = list;
        await setDoc(docRef, docData);
    }
}

function getFormData() {
    const formDataMap = {
        schedule: () => {
            const selectValue = document.getElementById('inp-time-select')?.value || '';
            const customValue = document.getElementById('inp-time-custom')?.value || '';
            const time = selectValue === 'その他' ? customValue : selectValue;
            
            return {
                time,
                content: document.getElementById('inp-content')?.value || '',
                display_start: document.getElementById('inp-display-start')?.value || '',
                display_end: document.getElementById('inp-display-end')?.value || ''
            };
        },
        notice: () => ({
            text: document.getElementById('inp-text')?.value || '',
            is_highlight: document.getElementById('inp-high')?.checked || false,
            display_start: document.getElementById('inp-display-start')?.value || '',
            display_end: document.getElementById('inp-display-end')?.value || ''
        }),
        assignment: () => ({
            deadline: document.getElementById('inp-dead')?.value || '',
            subject: document.getElementById('inp-sub')?.value || '',
            task: document.getElementById('inp-task')?.value || ''
        })
    };
    
    return formDataMap[currentEditType]?.() || {};
}

// ========================================
// 削除処理
// ========================================
window.dashboard.deleteItem = async (type, dateStr, index) => {
    if (!confirm("削除しますか？")) return;

    const fieldMap = {
        schedule: 'schedules',
        notice: 'notices',
        assignment: 'assignments'
    };

    try {
        const field = fieldMap[type];
        const docRef = doc(db, "schools", SCHOOL_ID, "daily_data", dateStr);
        const snap = await getDoc(docRef);
        
        if (snap.exists()) {
            const list = snap.data()[field] || [];
            list.splice(index, 1);
            await updateDoc(docRef, { [field]: list });
        }
    } catch (e) {
        console.error("削除エラー:", e);
        alert("削除エラー: " + e.message);
    }
};

// ========================================
// 画像アップロード処理
// ========================================
window.dashboard.triggerAdUpload = (type, index = null) => {
    pendingAdAction = { type, index };
    const fileInput = document.getElementById('ad-file-input');
    
    if (fileInput) {
        fileInput.click();
    } else {
        alert("エラー: file-inputが見つかりません");
    }
};

function setupAdFileListener() {
    const fileInput = document.getElementById('ad-file-input');
    if (!fileInput) return;

    fileInput.addEventListener('change', handleFileSelect);
}

async function handleFileSelect(e) {
    const file = e.target.files[0];
    const fileInput = e.target;
    
    if (!file) return;
    if (!confirm("画像をアップロードしますか？")) {
        fileInput.value = '';
        return;
    }

    try {
        const url = await uploadImage(file);
        await updateAdsInFirestore(url);
        alert("画像を更新しました！");
    } catch (e) {
        console.error("アップロードエラー:", e);
        handleUploadError(e);
    }
    
    fileInput.value = '';
}

async function uploadImage(file) {
    const fileName = `ads/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, fileName);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
}

async function updateAdsInFirestore(url) {
    const configRef = doc(db, "schools", SCHOOL_ID, "config", "display_settings");
    const snap = await getDoc(configRef);
    const ads = snap.data()?.ads || [];

    const newAd = {
        id: `ad_${Date.now()}`,
        type: "image",
        url: url,
        duration_sec: 10
    };

    if (pendingAdAction.type === 'add') {
        if (ads.length < 5) ads.push(newAd);
    } else if (pendingAdAction.type === 'replace') {
        if (ads[pendingAdAction.index]) {
            ads[pendingAdAction.index] = newAd;
        }
    }

    await updateDoc(configRef, { ads });
}

function handleUploadError(error) {
    if (error.code === 'storage/unauthorized') {
        alert("エラー: アップロード権限がありません。Firebase Storageのルールを確認してください。");
    } else {
        alert("アップロード失敗: " + error.message);
    }
}

// ========================================
// 広告削除
// ========================================
window.dashboard.deleteAd = async (index) => {
    if (!confirm("画像を削除しますか？")) return;

    try {
        const configRef = doc(db, "schools", SCHOOL_ID, "config", "display_settings");
        const snap = await getDoc(configRef);
        const ads = snap.data()?.ads || [];
        
        ads.splice(index, 1);
        await updateDoc(configRef, { ads });
        alert("削除しました");
    } catch (e) {
        console.error("削除エラー:", e);
        alert("削除エラー: " + e.message);
    }
};