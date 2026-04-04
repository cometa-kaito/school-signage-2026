// calendar.js - サイネージ表示用カレンダーモーダル

import { DAYS_JP, formatDateKey, escapeHtml } from './utils.js';

let appDataRef = null;
let sortFn = null;
let currentMonth = new Date();

/**
 * カレンダーを初期化
 * @param {Object} appData - アプリデータ参照
 * @param {Function} sortSchedulesByTime - 予定ソート関数
 */
export function initCalendar(appData, sortSchedulesByTime) {
    appDataRef = appData;
    sortFn = sortSchedulesByTime;

    const btn = document.getElementById('calendar-btn');
    const closeBtn = document.getElementById('calendar-close-btn');
    const prevBtn = document.getElementById('calendar-prev-month');
    const nextBtn = document.getElementById('calendar-next-month');
    const modal = document.getElementById('calendar-modal');

    if (btn) btn.addEventListener('click', openCalendar);
    if (closeBtn) closeBtn.addEventListener('click', closeCalendar);
    if (prevBtn) prevBtn.addEventListener('click', () => { currentMonth.setMonth(currentMonth.getMonth() - 1); renderCalendar(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { currentMonth.setMonth(currentMonth.getMonth() + 1); renderCalendar(); });

    // モーダル背景クリックで閉じる
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeCalendar();
        });
    }
}

function openCalendar() {
    currentMonth = new Date();
    renderCalendar();
    const modal = document.getElementById('calendar-modal');
    if (modal) modal.style.display = 'flex';
}

function closeCalendar() {
    const modal = document.getElementById('calendar-modal');
    if (modal) modal.style.display = 'none';
}

function renderCalendar() {
    const container = document.getElementById('calendar-days');
    const titleEl = document.getElementById('calendar-month-title');
    const detailEl = document.getElementById('calendar-schedule-detail');
    if (!container || !titleEl) return;

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    titleEl.textContent = `${year}年${month + 1}月`;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDayOfWeek = new Date(year, month, 1).getDay();
    const todayStr = formatDateKey(new Date());

    let html = '';

    // 前月の空白セル
    for (let i = 0; i < startDayOfWeek; i++) {
        html += '<div class="calendar-day empty"></div>';
    }

    // 各日のセル
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = formatDateKey(date);
        const dow = date.getDay();
        const schedules = appDataRef?.weeklySchedules?.[dateStr] || [];

        let cls = 'calendar-day';
        if (dateStr === todayStr) cls += ' today';
        if (dow === 0) cls += ' sunday';
        else if (dow === 6) cls += ' saturday';
        if (schedules.length > 0) cls += ' has-schedule';

        html += `<div class="${cls}" data-date="${dateStr}">`;
        html += `<span class="day-number">${day}</span>`;
        if (schedules.length > 0) {
            html += `<span class="event-dot"></span>`;
        }
        html += '</div>';
    }

    container.innerHTML = html;

    // 日付クリックイベント
    container.querySelectorAll('.calendar-day:not(.empty)').forEach(el => {
        el.addEventListener('click', () => {
            // 選択状態を更新
            container.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
            el.classList.add('selected');
            showDayDetail(el.dataset.date);
        });
    });

    // 詳細をリセット
    if (detailEl) {
        detailEl.innerHTML = '<p class="calendar-detail-placeholder">日付を選択してください</p>';
    }
}

function showDayDetail(dateStr) {
    const detailEl = document.getElementById('calendar-schedule-detail');
    if (!detailEl || !appDataRef) return;

    const schedules = appDataRef.weeklySchedules?.[dateStr] || [];
    const [yr, mn, dy] = dateStr.split('-').map(Number);
    const date = new Date(yr, mn - 1, dy);
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const dow = DAYS_JP[date.getDay()];

    let html = `<h4>${m}月${d}日 (${dow})</h4>`;

    if (schedules.length === 0) {
        html += '<p class="no-schedule-detail">予定はありません</p>';
    } else {
        const sorted = sortFn ? sortFn(schedules) : schedules;
        html += '<ul class="schedule-detail-list">';
        for (const s of sorted) {
            html += `<li><span class="detail-time">${escapeHtml(s.time || '')}</span> ${escapeHtml(s.content || '')}</li>`;
        }
        html += '</ul>';
    }

    detailEl.innerHTML = html;
}
