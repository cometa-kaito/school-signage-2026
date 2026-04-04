// calendar.js - カレンダーモーダル機能

import { formatDateKey, DAYS_JP } from './utils.js';

let calendarCurrentDate = new Date();
let calendarSelectedDate = null;
let appDataRef = null;
let sortSchedulesFn = null;

/**
 * カレンダー機能を初期化
 * @param {Object} appData - アプリデータへの参照
 * @param {Function} sortSchedulesByTime - スケジュールソート関数
 */
export function initCalendar(appData, sortSchedulesByTime) {
    appDataRef = appData;
    sortSchedulesFn = sortSchedulesByTime;

    const calendarBtn = document.getElementById('calendar-btn');
    const calendarModal = document.getElementById('calendar-modal');
    const closeBtn = document.getElementById('calendar-close-btn');
    const prevBtn = document.getElementById('calendar-prev-month');
    const nextBtn = document.getElementById('calendar-next-month');

    if (!calendarBtn || !calendarModal) return;

    calendarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        calendarCurrentDate = new Date();
        calendarSelectedDate = new Date();
        openCalendarModal();
    });

    closeBtn.addEventListener('click', closeCalendarModal);

    calendarModal.addEventListener('click', (e) => {
        if (e.target === calendarModal) {
            closeCalendarModal();
        }
    });

    prevBtn.addEventListener('click', () => {
        calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() - 1);
        renderCalendar();
    });

    nextBtn.addEventListener('click', () => {
        calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + 1);
        renderCalendar();
    });
}

/**
 * カレンダーモーダルを開く
 */
function openCalendarModal() {
    const modal = document.getElementById('calendar-modal');
    if (modal) {
        modal.classList.add('show');
        renderCalendar();
        showCalendarScheduleDetail(calendarSelectedDate);
    }
}

/**
 * カレンダーモーダルを閉じる
 */
function closeCalendarModal() {
    const modal = document.getElementById('calendar-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

/**
 * カレンダーを描画
 */
function renderCalendar() {
    const year = calendarCurrentDate.getFullYear();
    const month = calendarCurrentDate.getMonth();

    // タイトル更新
    const titleEl = document.getElementById('calendar-month-title');
    if (titleEl) {
        titleEl.textContent = `${year}年${month + 1}月`;
    }

    // 日付グリッド生成
    const daysContainer = document.getElementById('calendar-days');
    if (!daysContainer) return;

    daysContainer.innerHTML = '';

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const today = new Date();
    const todayStr = formatDateKey(today);

    // 前月の日を追加
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const dayNum = prevMonthLastDay - i;
        const date = new Date(year, month - 1, dayNum);
        const dayEl = createCalendarDayElement(date, dayNum, true);
        daysContainer.appendChild(dayEl);
    }

    // 当月の日を追加
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = formatDateKey(date);
        const isToday = dateStr === todayStr;
        const hasSchedule = appDataRef.weeklySchedules[dateStr] && appDataRef.weeklySchedules[dateStr].length > 0;

        const dayEl = createCalendarDayElement(date, day, false, isToday, hasSchedule);
        daysContainer.appendChild(dayEl);
    }

    // 次月の日を追加（6週分になるように）
    const totalCells = startDayOfWeek + daysInMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
        const date = new Date(year, month + 1, i);
        const dayEl = createCalendarDayElement(date, i, true);
        daysContainer.appendChild(dayEl);
    }
}

/**
 * カレンダーの日付要素を作成
 */
function createCalendarDayElement(date, dayNum, isOtherMonth, isToday = false, hasSchedule = false) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    dayEl.textContent = dayNum;

    const dayOfWeek = date.getDay();

    if (isOtherMonth) {
        dayEl.classList.add('other-month');
    }

    if (dayOfWeek === 0) {
        dayEl.classList.add('sunday');
    } else if (dayOfWeek === 6) {
        dayEl.classList.add('saturday');
    }

    if (isToday) {
        dayEl.classList.add('today');
    }

    if (hasSchedule) {
        dayEl.classList.add('has-schedule');
    }

    // 選択状態
    if (calendarSelectedDate && formatDateKey(date) === formatDateKey(calendarSelectedDate)) {
        dayEl.classList.add('selected');
    }

    dayEl.addEventListener('click', () => {
        calendarSelectedDate = date;
        renderCalendar();
        showCalendarScheduleDetail(date);
    });

    return dayEl;
}

/**
 * 選択した日付の予定詳細を表示
 */
function showCalendarScheduleDetail(date) {
    const detailContainer = document.getElementById('calendar-schedule-detail');
    if (!detailContainer) return;

    const dateStr = formatDateKey(date);
    const schedules = appDataRef.weeklySchedules[dateStr] || [];

    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = DAYS_JP[date.getDay()];

    // 時系列順にソート
    const sortedSchedules = sortSchedulesFn(schedules);

    if (sortedSchedules.length === 0) {
        detailContainer.innerHTML = `
            <div class="calendar-detail-date">${month}月${day}日 (${dayOfWeek})</div>
            <p class="calendar-no-schedule">予定はありません</p>
        `;
    } else {
        const itemsHtml = sortedSchedules.map(item => `
            <div class="calendar-detail-item">
                <span class="calendar-detail-time">${item.time || '終日'}</span>
                <span class="calendar-detail-content">${item.content}</span>
            </div>
        `).join('');

        detailContainer.innerHTML = `
            <div class="calendar-detail-date">${month}月${day}日 (${dayOfWeek})</div>
            ${itemsHtml}
        `;
    }
}
