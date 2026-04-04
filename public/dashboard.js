// dashboard.js - 管理者ダッシュボード（学校 > 学年 > クラス対応）

import {
    db, SCHOOL_ID, GRADE_ID, CLASS_ID, setSchoolContext,
    listSchoolsFn, listGradesFn, listClassesFn
} from "./config.js";
import { hasFullContext, renderContextSelector, redirectWithContext } from './context-selector.js';
import { UI } from "./ui.js";
import {
    getTodayString, startClock, formatDateKey,
    showModal, hideModal, escapeHtml
} from "./utils.js";
import {
    query, where, orderBy, limit,
    onSnapshot, updateDoc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { classDocRef, dailyDataCollectionRef, dailyDataDocRef } from './paths.js';
import { getDaysAgoStr, filterByDisplayRange } from './data-filter.js';

// ========================================
// グローバル
// ========================================

window.dashboard = {};

const appData = {
    className: "", weeklySchedules: {}, allSchedules: {},
    notices: [], assignments: [], ads: [],
    allNotices: [], allAssignments: []
};

let activeSchoolId = SCHOOL_ID;
let activeGradeId = GRADE_ID;
let activeClassId = CLASS_ID;

let availableSchools = [];
let availableGrades = [];
let availableClasses = [];

let currentEditType = null;
let currentTargetDate = null;
let currentIndex = null;

let listenersStarted = false;
let unsubscribers = [];
let currentCalendarDate = new Date();

// ========================================
// 初期化
// ========================================

window.dashboard.init = async function () {
    if (listenersStarted) return;
    listenersStarted = true;
    startClock('current-time', 'current-date');

    // URLパラメータが揃っていない場合はコンテキスト選択画面を表示
    if (!hasFullContext()) {
        document.getElementById('dashboardContent').style.display = 'none';
        document.getElementById('contextSelectorView').style.display = 'block';
        renderContextSelector('contextSelectorView', (schoolId, gradeId, classId) => {
            redirectWithContext(schoolId, gradeId, classId);
        });
        return;
    }

    await initSelectors();
    setupSaveButton();
};

document.addEventListener('DOMContentLoaded', () => {
    startClock('current-time', 'current-date');
});

// ========================================
// 3段セレクタ（学校 > 学年 > クラス）
// ========================================

async function initSelectors() {
    try {
        const result = await listSchoolsFn();
        availableSchools = result.data.schools || [];
    } catch (e) {
        console.error('学校一覧取得エラー:', e);
        availableSchools = [{ id: activeSchoolId, name: activeSchoolId }];
    }

    renderSelectors();

    if (activeSchoolId) {
        await loadGrades(activeSchoolId);
        if (activeGradeId) {
            await loadClasses(activeSchoolId, activeGradeId);
        }
    }

    if (activeSchoolId && activeGradeId && activeClassId) {
        startRealtimeListeners();
    } else {
        showSelectPrompt();
    }
}

function renderSelectors() {
    const container = document.getElementById('school-class-selector');
    if (!container) return;

    const schoolOpts = availableSchools.map(s =>
        `<option value="${s.id}" ${s.id === activeSchoolId ? 'selected' : ''}>${escapeHtml(s.name || s.id)}</option>`
    ).join('');

    const gradeOpts = availableGrades.map(g =>
        `<option value="${g.id}" ${g.id === activeGradeId ? 'selected' : ''}>${escapeHtml(g.name)}</option>`
    ).join('');

    const classOpts = availableClasses.map(c =>
        `<option value="${c.id}" ${c.id === activeClassId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
    ).join('');

    container.innerHTML = `
        <div class="selector-row" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <label>学校:</label>
            <select id="school-select" style="padding:6px;border-radius:6px;border:1px solid #ccc;">${schoolOpts}</select>
            <label>学年:</label>
            <select id="grade-select" style="padding:6px;border-radius:6px;border:1px solid #ccc;">
                <option value="">-- 選択 --</option>${gradeOpts}
            </select>
            <label>クラス:</label>
            <select id="class-select" style="padding:6px;border-radius:6px;border:1px solid #ccc;">
                <option value="">-- 選択 --</option>${classOpts}
            </select>
        </div>
    `;

    document.getElementById('school-select')?.addEventListener('change', async (e) => {
        activeSchoolId = e.target.value;
        activeGradeId = null;
        activeClassId = null;
        setSchoolContext(activeSchoolId, null, null);
        availableClasses = [];
        await loadGrades(activeSchoolId);
        updateGradeSelector();
        updateClassSelector();
        stopListeners();
        showSelectPrompt();
    });

    document.getElementById('grade-select')?.addEventListener('change', async (e) => {
        activeGradeId = e.target.value || null;
        activeClassId = null;
        setSchoolContext(activeSchoolId, activeGradeId, null);
        if (activeGradeId) {
            await loadClasses(activeSchoolId, activeGradeId);
        } else {
            availableClasses = [];
        }
        updateClassSelector();
        stopListeners();
        showSelectPrompt();
    });

    document.getElementById('class-select')?.addEventListener('change', (e) => {
        activeClassId = e.target.value || null;
        setSchoolContext(activeSchoolId, activeGradeId, activeClassId);
        if (activeClassId) {
            restartListeners();
        } else {
            stopListeners();
            showSelectPrompt();
        }
    });
}

async function loadGrades(schoolId) {
    try {
        const result = await listGradesFn({ schoolId });
        availableGrades = result.data.grades || [];
    } catch (e) {
        console.error('学年一覧取得エラー:', e);
        availableGrades = [];
    }
    updateGradeSelector();
}

async function loadClasses(schoolId, gradeId) {
    try {
        const result = await listClassesFn({ schoolId, gradeId });
        availableClasses = result.data.classes || [];
    } catch (e) {
        console.error('クラス一覧取得エラー:', e);
        availableClasses = [];
    }
    updateClassSelector();
}

function updateGradeSelector() {
    const sel = document.getElementById('grade-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- 選択 --</option>' +
        availableGrades.map(g =>
            `<option value="${g.id}" ${g.id === activeGradeId ? 'selected' : ''}>${escapeHtml(g.name)}</option>`
        ).join('');
}

function updateClassSelector() {
    const sel = document.getElementById('class-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- 選択 --</option>' +
        availableClasses.map(c =>
            `<option value="${c.id}" ${c.id === activeClassId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
        ).join('');
}

function showSelectPrompt() {
    const grid = document.getElementById('schedule-grid');
    const noticeList = document.getElementById('notice-list');
    const assignmentList = document.getElementById('assignment-list');

    const msg = '上のセレクタから学校・学年・クラスを選択してください';
    if (grid) grid.innerHTML = `<div style="padding:40px;text-align:center;color:#999;grid-column:1/-1;">${msg}</div>`;
    if (noticeList) noticeList.innerHTML = `<li style="color:#999;text-align:center;padding:20px;">${msg}</li>`;
    if (assignmentList) assignmentList.innerHTML = `<tr><td colspan="4" style="color:#999;text-align:center;padding:20px;">${msg}</td></tr>`;
}

// ========================================
// リスナー管理
// ========================================

function stopListeners() {
    unsubscribers.forEach(u => u());
    unsubscribers = [];
}

function restartListeners() {
    stopListeners();
    startRealtimeListeners();
}

function getConfigPath() {
    return classDocRef(activeSchoolId, activeGradeId, activeClassId);
}

function getDailyDataPath() {
    return dailyDataCollectionRef(activeSchoolId, activeGradeId, activeClassId);
}

// ========================================
// Firestore監視
// ========================================

function startRealtimeListeners() {
    if (!activeSchoolId || !activeGradeId || !activeClassId) return;

    const todayStr = getTodayString();

    const configRef = getConfigPath();
    const unsubConfig = onSnapshot(configRef, (snap) => {
        if (!snap.exists()) {
            appData.className = "";
            appData.ads = [];
        } else {
            const data = snap.data();
            appData.className = data.name || "";
            const settings = data.displaySettings || {};
            appData.ads = settings.ads || [];
        }
        updateClassNameDisplay();
        updateAdPreview();
        updateAdModalIfOpen();
    }, (error) => {
        console.error("設定監視エラー:", error);
    });
    unsubscribers.push(unsubConfig);

    const dailyRef = getDailyDataPath();
    const q = query(dailyRef, where("date", ">=", getDaysAgoStr(5)), orderBy("date", "asc"), limit(30));

    const unsubDaily = onSnapshot(q, (snapshot) => {
        processSnapshotData(snapshot, todayStr);
        renderAllSections(todayStr);
        if (document.getElementById('calendar-modal')?.style.display === 'flex') renderCalendar();
    }, (error) => {
        console.error("日次データ監視エラー:", error);
    });
    unsubscribers.push(unsubDaily);
}

function processSnapshotData(snapshot, todayStr) {
    appData.weeklySchedules = {};
    appData.notices = [];
    appData.assignments = [];
    appData.allSchedules = {};
    appData.allNotices = [];
    appData.allAssignments = [];

    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const dateKey = data.date;

        if (dateKey >= todayStr && data.schedules) {
            const filtered = data.schedules.filter(s => {
                const ds = s.display_start || dateKey;
                const de = s.display_end || dateKey;
                return todayStr >= ds && todayStr <= de;
            });
            if (filtered.length > 0) appData.weeklySchedules[dateKey] = filtered;
        }

        if (data.schedules && data.schedules.length > 0) {
            appData.allSchedules[dateKey] = data.schedules.map((s, idx) => ({
                ...s, _sourceDate: dateKey, _originalIndex: idx
            }));
        }

        if (data.notices && data.notices.length > 0) {
            data.notices.forEach((notice, idx) => {
                const ds = notice.display_start || dateKey;
                const de = notice.display_end || dateKey;
                const item = { ...notice, _sourceDate: dateKey, _originalIndex: idx };
                appData.allNotices.push(item);
                if (todayStr >= ds && todayStr <= de) appData.notices.push(item);
            });
        }

        if (data.assignments && data.assignments.length > 0) {
            data.assignments.forEach((a, idx) => {
                const item = { ...a, _sourceDate: dateKey, _originalIndex: idx };
                appData.assignments.push(item);
                appData.allAssignments.push(item);
            });
        }
    });

    appData.assignments.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
}

// ========================================
// UI更新
// ========================================

function updateClassNameDisplay() {
    const el = document.getElementById('class-name');
    if (el) el.textContent = appData.className;
}

function updateAdPreview() {
    const img = document.getElementById('ad-image');
    if (img) img.src = appData.ads.length > 0 ? appData.ads[0].url : "https://placehold.jp/300x400.png?text=No%20Image";
}

function updateAdModalIfOpen() {
    const modal = document.getElementById('ad-modal');
    if (modal && modal.style.display === 'flex') UI.renderAdList(appData.ads);
}

function renderAllSections(todayStr) {
    const grid = document.getElementById('schedule-grid');
    const noticeList = document.getElementById('notice-list');
    const assignmentList = document.getElementById('assignment-list');
    if (grid) UI.renderSchedules(grid, appData.weeklySchedules);
    if (noticeList) UI.renderNotices(noticeList, appData.notices, todayStr);
    if (assignmentList) UI.renderAssignments(assignmentList, appData.assignments, todayStr);
}

// ========================================
// モーダル制御
// ========================================

window.dashboard.openEditModal = (type, dateStr, index) => {
    currentEditType = type;
    currentTargetDate = dateStr;
    currentIndex = index;

    let data;
    if (type === 'assignment') data = appData.assignments.find(i => i._sourceDate === dateStr && i._originalIndex === index);
    else if (type === 'notice') data = appData.notices.find(i => i._sourceDate === dateStr && i._originalIndex === index);
    else data = appData.weeklySchedules[dateStr]?.[index];

    UI.generateModalForm(type, "編集", data);
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

window.dashboard.closeModal = (id) => hideModal(id);

// ========================================
// 保存処理
// ========================================

function setupSaveButton() {
    document.getElementById('btn-save')?.addEventListener('click', handleSave);
}

async function handleSave() {
    try {
        if (currentEditType === 'config') await saveConfig();
        else await saveData();
        hideModal('edit-modal');
    } catch (e) {
        console.error("保存エラー:", e);
        alert("保存エラー: " + e.message);
    }
}

async function saveConfig() {
    const value = document.getElementById('inp-class')?.value || '';
    await updateDoc(getConfigPath(), { name: value });
}

async function saveData() {
    const docRef = dailyDataDocRef(activeSchoolId, activeGradeId, activeClassId, currentTargetDate);
    const snap = await getDoc(docRef);
    const docData = snap.exists() ? snap.data() : { date: currentTargetDate };

    const fieldMap = { schedule: 'schedules', notice: 'notices', assignment: 'assignments' };
    const field = fieldMap[currentEditType];
    const list = docData[field] || [];
    const newItem = getFormData();

    if (currentIndex !== null) list[currentIndex] = newItem;
    else list.push(newItem);

    if (snap.exists()) await updateDoc(docRef, { [field]: list });
    else { docData[field] = list; await setDoc(docRef, docData); }
}

function getFormData() {
    const map = {
        schedule: () => {
            const sel = document.getElementById('inp-time-select')?.value || '';
            const custom = document.getElementById('inp-time-custom')?.value || '';
            return {
                time: sel === 'その他' ? custom : sel,
                content: document.getElementById('inp-content')?.value || '',
                display_start: document.getElementById('inp-display-start')?.value || '',
                display_end: document.getElementById('inp-display-end')?.value || ''
            };
        },
        notice: () => ({
            text: document.getElementById('inp-text')?.value || '',
            is_highlight: document.getElementById('inp-high')?.checked || false,
            play_sound: document.getElementById('inp-sound')?.checked || false,
            display_start: document.getElementById('inp-display-start')?.value || '',
            display_end: document.getElementById('inp-display-end')?.value || ''
        }),
        assignment: () => ({
            deadline: document.getElementById('inp-dead')?.value || '',
            subject: document.getElementById('inp-sub')?.value || '',
            task: document.getElementById('inp-task')?.value || ''
        })
    };
    return map[currentEditType]?.() || {};
}

// ========================================
// 削除処理
// ========================================

window.dashboard.deleteItem = async (type, dateStr, index) => {
    if (!confirm("削除しますか？")) return;
    const fieldMap = { schedule: 'schedules', notice: 'notices', assignment: 'assignments' };
    try {
        const docRef = dailyDataDocRef(activeSchoolId, activeGradeId, activeClassId, dateStr);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const list = snap.data()[fieldMap[type]] || [];
            if (index >= 0 && index < list.length) {
                list.splice(index, 1);
                await updateDoc(docRef, { [fieldMap[type]]: list });
            }
        }
    } catch (e) {
        console.error("削除エラー:", e);
        alert("削除エラー: " + e.message);
    }
};

// ========================================
// カレンダー機能
// ========================================

window.dashboard.openCalendar = () => { currentCalendarDate = new Date(); renderCalendar(); showModal('calendar-modal'); };
window.dashboard.prevMonth = () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1); renderCalendar(); };
window.dashboard.nextMonth = () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1); renderCalendar(); };

function renderCalendar() {
    const container = document.getElementById('calendar-container');
    const label = document.getElementById('calendar-month-label');
    if (!container || !label) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    label.textContent = `${year}年${month + 1}月`;

    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDayOfWeek = firstDay.getDay();
    const todayStr = formatDateKey(new Date());

    let html = '<div class="calendar-grid">';
    ['日','月','火','水','木','金','土'].forEach((d, i) => {
        const cls = i === 0 ? 'sunday' : i === 6 ? 'saturday' : '';
        html += `<div class="calendar-header ${cls}">${d}</div>`;
    });
    for (let i = 0; i < startDayOfWeek; i++) html += '<div class="calendar-cell empty"></div>';

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = formatDateKey(date);
        const dow = date.getDay();
        const schedules = appData.allSchedules[dateStr] || [];

        let cls = 'calendar-cell';
        if (dateStr === todayStr) cls += ' today';
        if (dow === 0) cls += ' sunday'; else if (dow === 6) cls += ' saturday';
        if (schedules.length > 0) cls += ' has-events';

        html += `<div class="${cls}" onclick="window.dashboard.showDayDetail('${dateStr}')">`;
        html += `<div class="calendar-day-number">${day}</div>`;
        if (schedules.length > 0) {
            html += '<div class="calendar-events">';
            schedules.slice(0, 2).forEach(s => {
                html += `<div class="calendar-event-item">${escapeHtml(s.time)} ${escapeHtml(s.content)}</div>`;
            });
            if (schedules.length > 2) html += `<div class="calendar-event-more">+${schedules.length - 2}件</div>`;
            html += '</div>';
        }
        html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;

    // 日詳細をリセット
    const detail = document.getElementById('calendar-day-detail');
    if (detail) detail.style.display = 'none';
}

window.dashboard.showDayDetail = (dateStr) => {
    const schedules = appData.allSchedules[dateStr] || [];
    const date = new Date(dateStr);
    const m = date.getMonth() + 1, d = date.getDate();
    const dow = ['日','月','火','水','木','金','土'][date.getDay()];

    const detailContainer = document.getElementById('calendar-day-detail');
    const detailTitle = document.getElementById('calendar-day-title');
    const detailContent = document.getElementById('calendar-day-content');

    if (!detailContainer) {
        // フォールバック
        let msg = `${m}/${d} (${dow}) の予定:\n\n`;
        if (schedules.length === 0) msg += '予定はありません';
        else schedules.forEach((s, i) => { msg += `${i+1}. [${s.time}] ${s.content}\n`; });
        msg += '\n\n予定を追加しますか？';
        if (confirm(msg)) { hideModal('calendar-modal'); window.dashboard.openAddModal('schedule', dateStr); }
        return;
    }

    detailTitle.textContent = `${m}/${d} (${dow}) の予定`;

    if (schedules.length === 0) {
        detailContent.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">予定はありません</p>';
    } else {
        detailContent.innerHTML = schedules.map(s => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #eee;gap:8px;">
                <div style="flex:1;"><span style="font-weight:600;color:#667eea;">[${escapeHtml(s.time)}]</span> <span>${escapeHtml(s.content)}</span></div>
                <div style="display:flex;gap:4px;flex-shrink:0;">
                    <button class="btn-icon" onclick="window.dashboard.calendarEdit('${dateStr}', ${s._originalIndex})" title="編集">✏️</button>
                    <button class="btn-icon btn-danger" onclick="window.dashboard.calendarDelete('${dateStr}', ${s._originalIndex})" title="削除">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    detailContent.insertAdjacentHTML('beforeend', `
        <div style="padding:12px;text-align:center;">
            <button class="btn-add-area" onclick="window.dashboard.calendarAdd('${dateStr}')" style="display:inline-block;padding:8px 20px;">
                <span class="icon-add">＋</span> 予定を追加
            </button>
        </div>
    `);
    detailContainer.style.display = 'block';
};

window.dashboard.calendarEdit = (dateStr, idx) => { hideModal('calendar-modal'); window.dashboard.openEditModal('schedule', dateStr, idx); };
window.dashboard.calendarDelete = async (dateStr, idx) => { if (!confirm("削除しますか？")) return; await window.dashboard.deleteItem('schedule', dateStr, idx); };
window.dashboard.calendarAdd = (dateStr) => { hideModal('calendar-modal'); window.dashboard.openAddModal('schedule', dateStr); };

// ========================================
// 入力履歴機能
// ========================================

window.dashboard.showHistory = (type) => {
    const container = document.getElementById('history-content');
    const title = document.getElementById('history-title');
    if (!container || !title) return;

    if (type === 'notice') {
        title.textContent = '📢 連絡の入力履歴';
        const items = [...appData.allNotices].sort((a, b) => b._sourceDate.localeCompare(a._sourceDate));
        if (items.length === 0) {
            container.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">履歴がありません</p>';
        } else {
            container.innerHTML = items.map(item => `
                <div style="padding:10px 14px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                    <div style="flex:1;">
                        <span style="font-size:12px;color:#999;">${item._sourceDate}</span>
                        ${item.is_highlight ? '<span style="color:#e53935;font-weight:600;font-size:12px;margin-left:6px;">【重要】</span>' : ''}
                        <div style="margin-top:2px;">${escapeHtml(item.text)}</div>
                    </div>
                    <button class="btn-icon" onclick="window.dashboard.reuseNotice(${JSON.stringify(item.text).replace(/"/g, '&quot;')}, ${item.is_highlight})" title="再利用">📋</button>
                </div>
            `).join('');
        }
    } else if (type === 'assignment') {
        title.textContent = '⚠️ 提出物の入力履歴';
        const items = [...appData.allAssignments].sort((a, b) => b._sourceDate.localeCompare(a._sourceDate));
        if (items.length === 0) {
            container.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">履歴がありません</p>';
        } else {
            container.innerHTML = items.map(item => `
                <div style="padding:10px 14px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                    <div style="flex:1;">
                        <span style="font-size:12px;color:#999;">期限: ${item.deadline}</span>
                        <div style="margin-top:2px;"><strong>${escapeHtml(item.subject)}</strong> — ${escapeHtml(item.task)}</div>
                    </div>
                    <button class="btn-icon" onclick="window.dashboard.reuseAssignment('${escapeHtml(item.subject)}', '${escapeHtml(item.task)}')" title="再利用">📋</button>
                </div>
            `).join('');
        }
    }
    showModal('history-modal');
};

window.dashboard.reuseNotice = (text, isHighlight) => {
    hideModal('history-modal');
    window.dashboard.openAddModal('notice', getTodayString());
    setTimeout(() => {
        const t = document.getElementById('inp-text'); if (t) t.value = text;
        const h = document.getElementById('inp-high'); if (h) h.checked = isHighlight;
    }, 100);
};

window.dashboard.reuseAssignment = (subject, task) => {
    hideModal('history-modal');
    window.dashboard.openAddModal('assignment', getTodayString());
    setTimeout(() => {
        const s = document.getElementById('inp-sub'); if (s) s.value = subject;
        const t = document.getElementById('inp-task'); if (t) t.value = task;
    }, 100);
};

// ========================================
// イベント委譲（data-action属性ベース）
// ui.jsのonclick="window.dashboard.*"を廃止し、data-*属性で管理
// ========================================

document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const { action, type, date, index } = target.dataset;
    const idx = index !== undefined ? parseInt(index, 10) : undefined;

    switch (action) {
        case 'edit':
            e.stopPropagation();
            window.dashboard.openEditModal(type, date, idx);
            break;
        case 'delete':
            e.stopPropagation();
            window.dashboard.deleteItem(type, date, idx);
            break;
        case 'add':
            window.dashboard.openAddModal(type, date);
            break;
        case 'ad-replace':
            window.dashboard.triggerAdUpload('replace', idx);
            break;
        case 'ad-delete':
            window.dashboard.deleteAd(idx);
            break;
    }
});
