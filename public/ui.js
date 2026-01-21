// ui.js - ダッシュボード用UI描画ヘルパー

import { DAYS_JP, formatDateKey, getDateOffset, escapeHtml } from './utils.js';

/**
 * UI描画ヘルパーモジュール
 */
export const UI = {
    /**
     * 予定セクションを描画
     * 土日をスキップして平日のみ3日分表示
     * @param {HTMLElement} container 
     * @param {Object} weeklySchedules 
     */
    renderSchedules(container, weeklySchedules) {
        container.innerHTML = '';

        let displayedCount = 0;
        let dayOffset = 0;

        while (displayedCount < 3) {
            const targetDate = getDateOffset(dayOffset);
            const dayOfWeek = targetDate.getDay();
            
            // 土日（0=日曜, 6=土曜）をスキップ
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                dayOffset++;
                continue;
            }

            const dateKey = formatDateKey(targetDate);
            const dayStr = DAYS_JP[dayOfWeek];
            const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
            const dd = String(targetDate.getDate()).padStart(2, '0');

            const schedules = weeklySchedules[dateKey] || [];

            const listHtml = schedules.map((item, idx) => `
                <div class="schedule-list-item editable" 
                     onclick="window.dashboard.openEditModal('schedule', '${dateKey}', ${idx})">
                    <span class="schedule-time">${escapeHtml(item.time)}</span>
                    <span class="schedule-content">${escapeHtml(item.content)}</span>
                    <span class="btn-delete-item" 
                          onclick="event.stopPropagation(); window.dashboard.deleteItem('schedule', '${dateKey}', ${idx})">×</span>
                </div>
            `).join('');

            const isToday = dayOffset === 0;
            const columnHtml = `
                <div class="schedule-day-column ${isToday ? 'is-today' : ''}">
                    <div class="schedule-date-header">${mm}/${dd} (${dayStr})</div>
                    <div>
                        ${listHtml}
                        <div class="btn-add-area" 
                             onclick="window.dashboard.openAddModal('schedule', '${dateKey}')">+ 追加</div>
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
     * @param {HTMLElement} container 
     * @param {Array} notices 
     * @param {string} todayStr 
     */
    renderNotices(container, notices, todayStr) {
        if (notices.length === 0) {
            container.innerHTML = '<li class="no-notice">連絡事項はありません</li>';
            return;
        }

        container.innerHTML = notices.map((item, idx) => `
            <li class="editable ${item.is_highlight ? 'highlight' : ''}" 
                onclick="window.dashboard.openEditModal('notice', '${todayStr}', ${idx})">
                ${item.is_highlight ? '【重要】' : ''} ${escapeHtml(item.text)}
                <span class="btn-delete-item" 
                      onclick="event.stopPropagation(); window.dashboard.deleteItem('notice', '${todayStr}', ${idx})">×</span>
            </li>
        `).join('');
    },

    /**
     * 提出物セクションを描画
     * 期限5日前以降のものを表示
     * @param {HTMLElement} container 
     * @param {Array} assignments 
     * @param {string} todayStr 
     */
    renderAssignments(container, assignments, todayStr) {
        // 5日前の日付
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        const fiveDaysAgoStr = formatDateKey(fiveDaysAgo);
        
        // 期限が5日前以降の提出物をフィルタ
        const filteredAssignments = assignments.filter(item => {
            return item.deadline >= fiveDaysAgoStr;
        });
        
        if (filteredAssignments.length === 0) {
            container.innerHTML = '<tr><td colspan="4" class="no-assignment">提出物はありません</td></tr>';
            return;
        }

        container.innerHTML = filteredAssignments.map((item, idx) => {
            // 残り日数を計算
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const deadline = new Date(item.deadline);
            deadline.setHours(0, 0, 0, 0);
            const diffTime = deadline - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let daysText = '';
            let daysClass = '';
            if (diffDays < 0) {
                daysText = `${Math.abs(diffDays)}日超過`;
                daysClass = 'days-urgent';
            } else if (diffDays === 0) {
                daysText = '今日';
                daysClass = 'days-urgent';
            } else if (diffDays === 1) {
                daysText = '明日';
                daysClass = 'days-urgent';
            } else if (diffDays <= 3) {
                daysText = `あと${diffDays}日`;
                daysClass = 'days-urgent';
            } else {
                daysText = `あと${diffDays}日`;
                daysClass = 'days-left';
            }
            
            const rowClass = diffDays < 0 ? 'overdue-row' : '';
            
            // 削除・編集時には元のドキュメント日付とインデックスを使用
            const sourceDate = item._sourceDate || todayStr;
            const originalIndex = item._originalIndex !== undefined ? item._originalIndex : idx;
            
            return `
            <tr class="editable ${rowClass}" 
                onclick="window.dashboard.openEditModal('assignment', '${sourceDate}', ${originalIndex})">
                <td>
                    ${item.deadline.slice(5)}
                    <br><span class="${daysClass}">${daysText}</span>
                </td>
                <td>${escapeHtml(item.subject)}</td>
                <td>${escapeHtml(item.task)}</td>
                <td>
                    <span class="btn-delete-item" 
                          onclick="event.stopPropagation(); window.dashboard.deleteItem('assignment', '${sourceDate}', ${originalIndex})">×</span>
                </td>
            </tr>
        `}).join('');
    },

    /**
     * 広告管理リストを描画
     * @param {Array} ads 
     */
    renderAdList(ads) {
        const container = document.getElementById('ad-list-container');
        const addBtnWrapper = document.getElementById('ad-add-btn-wrapper');
        const limitAlert = document.getElementById('ad-limit-alert');

        if (!container) return;

        container.innerHTML = '';

        if (ads.length === 0) {
            container.innerHTML = '<p class="no-ads">画像は登録されていません</p>';
        } else {
            ads.forEach((ad, index) => {
                const div = document.createElement('div');
                div.className = 'ad-item';
                div.innerHTML = `
                    <img src="${ad.url}" class="ad-thumb" alt="広告画像 ${index + 1}">
                    <div class="ad-info">
                        <p>画像 ${index + 1}</p>
                    </div>
                    <div class="ad-actions">
                        <button class="btn-sm btn-edit" 
                                onclick="window.dashboard.triggerAdUpload('replace', ${index})">変更</button>
                        <button class="btn-sm btn-del" 
                                onclick="window.dashboard.deleteAd(${index})">削除</button>
                    </div>
                `;
                container.appendChild(div);
            });
        }

        // 5枚制限チェック
        const isAtLimit = ads.length >= 5;
        if (addBtnWrapper) {
            addBtnWrapper.style.display = isAtLimit ? 'none' : 'block';
        }
        if (limitAlert) {
            limitAlert.style.display = isAtLimit ? 'block' : 'none';
        }
    },

    /**
     * モーダルフォームを生成
     * @param {string} type - 'schedule' | 'notice' | 'assignment' | 'config'
     * @param {string} title 
     * @param {Object|string|null} data 
     */
    generateModalForm(type, title, data) {
        const modalBody = document.getElementById('modal-body');
        const modalTitle = document.getElementById('modal-title');
        
        if (!modalBody || !modalTitle) return;
        
        modalTitle.textContent = title;

        const timeOptions = [
            { value: '終日', label: '終日 (All Day)' },
            { value: '1限', label: '1限' },
            { value: '2限', label: '2限' },
            { value: '3限', label: '3限' },
            { value: '4限', label: '4限' },
            { value: '5限', label: '5限' },
            { value: '6限', label: '6限' },
            { value: 'その他', label: 'その他（自由入力）' }
        ];

        // 現在のデータが定義済みの選択肢にあるかチェック
        const currentTime = data?.time || '';
        const isCustomTime = currentTime && !timeOptions.some(opt => opt.value === currentTime);
        const selectedValue = isCustomTime ? 'その他' : currentTime;

        const formGenerators = {
            schedule: () => `
                <div class="input-group">
                    <label for="inp-time-select">時間</label>
                    <select id="inp-time-select" onchange="window.toggleCustomTimeInput && window.toggleCustomTimeInput()">
                        <option value="">-- 選択 --</option>
                        ${timeOptions.map(opt => 
                            `<option value="${opt.value}" ${selectedValue === opt.value ? 'selected' : ''}>${opt.label}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="input-group" id="custom-time-group" style="display: ${selectedValue === 'その他' || isCustomTime ? 'block' : 'none'};">
                    <label for="inp-time-custom">自由入力</label>
                    <input type="text" id="inp-time-custom" 
                           value="${isCustomTime ? currentTime : ''}" 
                           placeholder="例: 放課後, 13:30">
                </div>
                <div class="input-group">
                    <label for="inp-content">内容</label>
                    <input type="text" id="inp-content" 
                           value="${data?.content || ''}" 
                           placeholder="例: 数学テスト">
                </div>
                <div class="input-group">
                    <label for="inp-display-start">表示開始日（オプション）</label>
                    <input type="date" id="inp-display-start" value="${data?.display_start || ''}">
                </div>
                <div class="input-group">
                    <label for="inp-display-end">表示終了日（オプション）</label>
                    <input type="date" id="inp-display-end" value="${data?.display_end || ''}">
                </div>
            `,
            notice: () => `
                <div class="input-group">
                    <label for="inp-text">内容</label>
                    <textarea id="inp-text" rows="3">${data?.text || ''}</textarea>
                </div>
                <div class="input-group checkbox-inline">
                    <label class="checkbox-label">
                        <input type="checkbox" id="inp-high" 
                               ${data?.is_highlight ? 'checked' : ''}> 
                        <span>重要として表示</span>
                    </label>
                </div>
                <div class="input-group">
                    <label for="inp-display-start">表示開始日（オプション）</label>
                    <input type="date" id="inp-display-start" value="${data?.display_start || ''}">
                </div>
                <div class="input-group">
                    <label for="inp-display-end">表示終了日（オプション）</label>
                    <input type="date" id="inp-display-end" value="${data?.display_end || ''}">
                </div>
            `,
            assignment: () => `
                <div class="input-group">
                    <label for="inp-dead">期限日</label>
                    <input type="date" id="inp-dead" value="${data?.deadline || ''}">
                </div>
                <div class="input-group">
                    <label for="inp-sub">科目</label>
                    <input type="text" id="inp-sub" value="${data?.subject || ''}">
                </div>
                <div class="input-group">
                    <label for="inp-task">提出物名</label>
                    <input type="text" id="inp-task" value="${data?.task || ''}">
                </div>
            `,
            config: () => `
                <div class="input-group">
                    <label for="inp-class">クラス名</label>
                    <input type="text" id="inp-class" value="${data || ''}">
                </div>
            `
        };

        const generator = formGenerators[type];
        modalBody.innerHTML = generator ? generator() : '';

        // その他選択時の自由入力表示切り替え関数をグローバルに登録
        window.toggleCustomTimeInput = () => {
            const select = document.getElementById('inp-time-select');
            const customGroup = document.getElementById('custom-time-group');
            if (select && customGroup) {
                customGroup.style.display = select.value === 'その他' ? 'block' : 'none';
            }
        };
    }
};