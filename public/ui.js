// ui.js - ダッシュボード用UI描画ヘルパー

import {
    DAYS_JP,
    getTodayString,
    formatDateKey,
    getDateOffset,
    calculateDaysLeft,
    isWeekend,
    escapeHtml
} from './utils.js';

// ========================================
// 定数
// ========================================

const MAX_ADS = 5;

const TIME_OPTIONS = [
    { value: '', label: '-- 選択 --' },
    { value: '終日', label: '終日 (All Day)' },
    { value: '朝学習', label: '朝学習' },
    { value: '1限', label: '1限' },
    { value: '2限', label: '2限' },
    { value: '3限', label: '3限' },
    { value: '4限', label: '4限' },
    { value: '5限', label: '5限' },
    { value: '6限', label: '6限' },
    { value: '放課後', label: '放課後' },
    { value: 'その他', label: 'その他（自由入力）' }
];

// ========================================
// UIオブジェクト
// ========================================

export const UI = {
    /**
     * 予定セクションを描画
     * 土日をスキップして平日のみ3日分表示
     */
    renderSchedules(container, weeklySchedules) {
        container.innerHTML = '';

        let displayedCount = 0;
        let dayOffset = 0;

        while (displayedCount < 3) {
            const targetDate = getDateOffset(dayOffset);

            if (isWeekend(targetDate)) {
                dayOffset++;
                continue;
            }

            const dateKey = formatDateKey(targetDate);
            const dayOfWeek = targetDate.getDay();
            const dayStr = DAYS_JP[dayOfWeek];
            const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
            const dd = String(targetDate.getDate()).padStart(2, '0');

            const schedules = weeklySchedules[dateKey] || [];
            const isToday = dayOffset === 0;

            const listHtml = schedules.length > 0
                ? schedules.map((item, idx) => `
                    <div class="schedule-list-item editable"
                         data-action="edit" data-type="schedule" data-date="${dateKey}" data-index="${idx}">
                        <span class="schedule-time">${escapeHtml(item.time)}</span>
                        <span class="schedule-content">${escapeHtml(item.content)}</span>
                        <span class="btn-delete-item"
                              data-action="delete" data-type="schedule" data-date="${dateKey}" data-index="${idx}">×</span>
                    </div>
                `).join('')
                : '<div class="no-schedule">予定なし</div>';

            const columnHtml = `
                <div class="schedule-day-column ${isToday ? 'is-today' : ''}">
                    <div class="schedule-date-header">${mm}/${dd} (${dayStr})</div>
                    <div class="schedule-scroll-area">${listHtml}</div>
                    <div class="btn-add-area"
                         data-action="add" data-type="schedule" data-date="${dateKey}">
                        <span class="icon-add">＋</span> 予定を追加
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', columnHtml);

            displayedCount++;
            dayOffset++;
        }
    },

    /**
     * 連絡セクションを描画
     */
    renderNotices(container, notices, todayStr) {
        // 既存の追加ボタンを削除
        const parent = container.parentElement;
        const existingAdd = parent?.querySelector('#notice-add-area');
        if (existingAdd) existingAdd.remove();

        if (notices.length === 0) {
            container.innerHTML = '<li class="no-notice">連絡事項はありません</li>';
        } else {
            container.innerHTML = notices.map((item) => {
                const sourceDate = item._sourceDate || todayStr;
                const originalIndex = item._originalIndex !== undefined ? item._originalIndex : 0;

                return `
                    <li class="editable ${item.is_highlight ? 'highlight' : ''}"
                        data-action="edit" data-type="notice" data-date="${sourceDate}" data-index="${originalIndex}">
                        ${item.is_highlight ? '【重要】' : ''} ${escapeHtml(item.text)}
                        <span class="btn-delete-item"
                              data-action="delete" data-type="notice" data-date="${sourceDate}" data-index="${originalIndex}">×</span>
                    </li>
                `;
            }).join('');
        }

        // 追加ボタンを挿入
        container.insertAdjacentHTML('afterend', `
            <div id="notice-add-area" class="btn-add-area"
                 data-action="add" data-type="notice" data-date="${todayStr}">
                <span class="icon-add">＋</span> 連絡を追加
            </div>
        `);
    },

    /**
     * 提出物セクションを描画
     * 期限5日前以降のものを表示
     */
    renderAssignments(container, assignments, todayStr) {
        // 既存の追加ボタンを削除
        const wrapper = container.closest('.table-wrapper') || container.parentElement;
        const existingAdd = wrapper?.parentElement?.querySelector('#assignment-add-area');
        if (existingAdd) existingAdd.remove();

        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        const fiveDaysAgoStr = formatDateKey(fiveDaysAgo);

        const filteredAssignments = assignments.filter(item => item.deadline >= fiveDaysAgoStr);

        if (filteredAssignments.length === 0) {
            container.innerHTML = '<tr><td colspan="4" class="no-assignment">提出物はありません</td></tr>';
        } else {
            container.innerHTML = filteredAssignments.map((item) => {
                const { text, cssClass, days } = calculateDaysLeft(item.deadline);
                const rowClass = days < 0 ? 'overdue-row' : '';
                const sourceDate = item._sourceDate || todayStr;
                const originalIndex = item._originalIndex !== undefined ? item._originalIndex : 0;

                return `
                    <tr class="editable ${rowClass}"
                        data-action="edit" data-type="assignment" data-date="${sourceDate}" data-index="${originalIndex}">
                        <td>
                            ${escapeHtml(item.deadline.slice(5))}
                            <br><span class="${cssClass}">${text}</span>
                        </td>
                        <td>${escapeHtml(item.subject)}</td>
                        <td>${escapeHtml(item.task)}</td>
                        <td>
                            <span class="btn-delete-item"
                                  data-action="delete" data-type="assignment" data-date="${sourceDate}" data-index="${originalIndex}">×</span>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // 追加ボタンを挿入
        wrapper.insertAdjacentHTML('afterend', `
            <div id="assignment-add-area" class="btn-add-area"
                 data-action="add" data-type="assignment" data-date="${todayStr}">
                <span class="icon-add">＋</span> 提出物を追加
            </div>
        `);
    },

    /**
     * 広告管理リストを描画
     */
    renderAdList(ads) {
        const container = document.getElementById('ad-list-container');
        const addBtnWrapper = document.getElementById('ad-add-btn-wrapper');
        const limitAlert = document.getElementById('ad-limit-alert');

        if (!container) return;

        if (ads.length === 0) {
            container.innerHTML = '<p class="no-ads">画像は登録されていません</p>';
        } else {
            container.innerHTML = ads.map((ad, index) => `
                <div class="ad-item">
                    <img src="${ad.url}" class="ad-thumb" alt="広告画像 ${index + 1}"
                         onerror="this.src='https://placehold.jp/80x60.png?text=Error'" />
                    <div class="ad-info">
                        <p>画像 ${index + 1}</p>
                    </div>
                    <div class="ad-actions">
                        <button class="btn btn-sm btn-edit"
                                data-action="ad-replace" data-index="${index}">変更</button>
                        <button class="btn btn-sm btn-del"
                                data-action="ad-delete" data-index="${index}">削除</button>
                    </div>
                </div>
            `).join('');
        }

        // 5枚制限チェック
        const isAtLimit = ads.length >= MAX_ADS;
        if (addBtnWrapper) {
            addBtnWrapper.style.display = isAtLimit ? 'none' : 'block';
        }
        if (limitAlert) {
            limitAlert.style.display = isAtLimit ? 'block' : 'none';
        }
    },

    /**
     * モーダルフォームを生成
     */
    generateModalForm(type, title, data) {
        const modalBody = document.getElementById('modal-body');
        const modalHeader = document.getElementById('modal-header');
        const modalTitle = document.getElementById('modal-title');
        const modalDescription = document.getElementById('modal-description');

        const headerEl = modalHeader || modalTitle;
        if (!modalBody || !headerEl) return;

        // タイトル設定
        const typeLabels = {
            schedule: '予定',
            notice: '連絡',
            assignment: '提出物',
            config: '設定'
        };
        headerEl.textContent = `${typeLabels[type] || ''}を${title}`;

        // 説明文（あれば）
        if (modalDescription) {
            const descriptions = {
                schedule: '時間と内容を入力してください',
                notice: '連絡内容を入力してください',
                assignment: '期限と詳細を入力してください',
                config: 'クラス名を設定してください'
            };
            modalDescription.textContent = descriptions[type] || '';
        }

        // フォーム生成
        const formGenerators = {
            schedule: () => this.generateScheduleForm(data),
            notice: () => this.generateNoticeForm(data),
            assignment: () => this.generateAssignmentForm(data),
            config: () => this.generateConfigForm(data)
        };

        modalBody.innerHTML = formGenerators[type]?.() || '';

        // その他選択時のハンドラー設定
        if (type === 'schedule') {
            this.setupTimeSelectHandler();
        }
    },

    /**
     * 予定フォームを生成
     */
    generateScheduleForm(data) {
        const currentTime = data?.time || '';
        const isCustomTime = currentTime && !TIME_OPTIONS.some(opt => opt.value === currentTime);
        const selectedValue = isCustomTime ? 'その他' : currentTime;

        const optionsHtml = TIME_OPTIONS.map(opt =>
            `<option value="${opt.value}" ${selectedValue === opt.value ? 'selected' : ''}>${opt.label}</option>`
        ).join('');

        const customDisplay = (selectedValue === 'その他' || isCustomTime) ? 'block' : 'none';

        return `
            <div class="input-group">
                <label for="inp-time-select">時間</label>
                <select id="inp-time-select">${optionsHtml}</select>
            </div>
            <div class="input-group" id="custom-time-group" style="display: ${customDisplay};">
                <label for="inp-time-custom">自由入力</label>
                <input type="text" id="inp-time-custom"
                       value="${isCustomTime ? escapeHtml(currentTime) : ''}"
                       placeholder="例: 昼休み, 13:30">
            </div>
            <div class="input-group">
                <label for="inp-content">内容</label>
                <input type="text" id="inp-content"
                       value="${escapeHtml(data?.content || '')}"
                       placeholder="例: 数学テスト">
            </div>
            <div class="input-group display-range-group">
                <label>📅 表示期間（空欄＝この日のみ表示）</label>
                <p class="input-hint">この予定を表示し始める日と表示を終える日を指定できます。例えば、前日から表示したい場合などに使います。</p>
                <div style="display:flex;gap:8px;align-items:center;">
                    <input type="date" id="inp-display-start" value="${data?.display_start || ''}" style="flex:1;">
                    <span>〜</span>
                    <input type="date" id="inp-display-end" value="${data?.display_end || ''}" style="flex:1;">
                </div>
            </div>
        `;
    },

    /**
     * 連絡フォームを生成
     */
    generateNoticeForm(data) {
        return `
            <div class="input-group">
                <label for="inp-text">内容</label>
                <textarea id="inp-text" rows="3">${escapeHtml(data?.text || '')}</textarea>
            </div>
            <div class="input-group checkbox-inline">
                <label class="checkbox-label">
                    <input type="checkbox" id="inp-high" ${data?.is_highlight ? 'checked' : ''}>
                    <span>重要として表示</span>
                </label>
            </div>
            <div class="input-group checkbox-inline">
                <label class="checkbox-label">
                    <input type="checkbox" id="inp-sound" ${data?.play_sound ? 'checked' : ''}>
                    <span>🔔 通知音を鳴らす</span>
                </label>
            </div>
            <div class="input-group display-range-group">
                <label>📅 表示期間（空欄＝この日のみ表示）</label>
                <p class="input-hint">この連絡を表示し始める日と表示を終える日を指定できます。</p>
                <div style="display:flex;gap:8px;align-items:center;">
                    <input type="date" id="inp-display-start" value="${data?.display_start || ''}" style="flex:1;">
                    <span>〜</span>
                    <input type="date" id="inp-display-end" value="${data?.display_end || ''}" style="flex:1;">
                </div>
            </div>
        `;
    },

    /**
     * 提出物フォームを生成
     */
    generateAssignmentForm(data) {
        return `
            <div class="input-group">
                <label for="inp-dead">期限日</label>
                <input type="date" id="inp-dead" value="${data?.deadline || ''}">
            </div>
            <div class="input-group">
                <label for="inp-sub">科目</label>
                <input type="text" id="inp-sub" value="${escapeHtml(data?.subject || '')}">
            </div>
            <div class="input-group">
                <label for="inp-task">提出物名</label>
                <input type="text" id="inp-task" value="${escapeHtml(data?.task || '')}">
            </div>
        `;
    },

    /**
     * 設定フォームを生成
     */
    generateConfigForm(className) {
        return `
            <div class="input-group">
                <label for="inp-class">クラス名</label>
                <input type="text" id="inp-class"
                       value="${escapeHtml(className || '')}"
                       placeholder="例: 3年A組">
            </div>
        `;
    },

    /**
     * 時間セレクトのイベントハンドラーを設定
     */
    setupTimeSelectHandler() {
        const select = document.getElementById('inp-time-select');
        const customGroup = document.getElementById('custom-time-group');

        if (select && customGroup) {
            const toggleHandler = () => {
                customGroup.style.display = select.value === 'その他' ? 'block' : 'none';
            };

            select.addEventListener('change', toggleHandler);

            // グローバル関数としても登録（互換性のため）
            window.toggleCustomTimeInput = toggleHandler;
        }
    }
};
