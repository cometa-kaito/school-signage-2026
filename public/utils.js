// utils.js - 共通ユーティリティ関数

// ========================================
// 定数
// ========================================

/** 曜日の日本語配列 */
export const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];

/** ミリ秒定数 */
export const MS_PER_DAY = 1000 * 60 * 60 * 24;

// ========================================
// 日付関連
// ========================================

/**
 * 今日の日付を YYYY-MM-DD 形式で取得
 * @returns {string}
 */
export function getTodayString() {
    return formatDateKey(new Date());
}

/**
 * 日付を MM/DD (曜) 形式でフォーマット
 * @param {Date} date
 * @returns {string}
 */
export function formatDateDisplay(date) {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const day = DAYS_JP[date.getDay()];
    return `${mm}/${dd} (${day})`;
}

/**
 * 日付を YYYY-MM-DD 形式でフォーマット
 * @param {Date} date
 * @returns {string}
 */
export function formatDateKey(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * 指定日数後の日付を取得
 * @param {number} daysOffset - 今日からの日数
 * @returns {Date}
 */
export function getDateOffset(daysOffset) {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date;
}

/**
 * 期限までの残り日数を計算
 * @param {string} deadlineStr - YYYY-MM-DD 形式の期限日
 * @returns {{ days: number, text: string, cssClass: string }}
 */
export function calculateDaysLeft(deadlineStr) {
    const today = new Date(getTodayString());
    const deadline = new Date(deadlineStr);
    const diffTime = deadline - today;
    const diffDays = Math.ceil(diffTime / MS_PER_DAY);

    let text = '';
    let cssClass = '';

    if (diffDays === 0) {
        text = '本日締切';
        cssClass = 'days-urgent';
    } else if (diffDays < 0) {
        text = '期限切れ';
        cssClass = 'days-urgent';
    } else {
        text = `あと ${diffDays} 日`;
        cssClass = diffDays <= 3 ? 'days-urgent' : 'days-left';
    }

    return { days: diffDays, text, cssClass };
}

/**
 * 日付が週末かどうかを判定
 * @param {Date} date
 * @returns {boolean}
 */
export function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
}

// ========================================
// 時計関連
// ========================================

/**
 * 時計を開始（現在時刻を更新）
 * デスクトップ用とモバイル用の両方を更新
 * @param {string} timeElId - 時刻表示要素のID
 * @param {string} [dateElId] - 日付表示要素のID（オプション）
 * @returns {number} intervalId
 */
export function startClock(timeElId, dateElId = null) {
    const updateTime = () => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // デスクトップ用
        const timeEl = document.getElementById(timeElId);
        if (timeEl) {
            timeEl.textContent = timeStr;
        }

        // モバイル用
        const mobileTimeEl = document.getElementById('mobile-current-time');
        if (mobileTimeEl) {
            mobileTimeEl.textContent = timeStr;
        }

        const DAYS = ['日','月','火','水','木','金','土'];
        const dateStr = `${now.getMonth() + 1}月${now.getDate()}日`;
        const dayStr = DAYS[now.getDay()];

        if (dateElId) {
            const dateEl = document.getElementById(dateElId);
            if (dateEl) dateEl.textContent = dateStr;
        }

        // モバイル用日付
        const mobileDateEl = document.getElementById('mobile-current-date');
        if (mobileDateEl) mobileDateEl.textContent = dateStr;

        // 曜日
        const dayEl = document.getElementById('current-day');
        if (dayEl) dayEl.textContent = dayStr;
        const mobileDayEl = document.getElementById('mobile-current-day');
        if (mobileDayEl) mobileDayEl.textContent = dayStr;
    };

    updateTime();
    return setInterval(updateTime, 1000);
}

// ========================================
// 文字列関連
// ========================================

/**
 * HTMLエスケープ
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// DOM関連
// ========================================

/**
 * 要素を取得（存在しない場合はnull）
 * @param {string} id
 * @returns {HTMLElement|null}
 */
export function $(id) {
    return document.getElementById(id);
}

/**
 * 要素のテキストを設定
 * @param {string} id
 * @param {string} text
 */
export function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

/**
 * 要素のHTMLを設定
 * @param {string} id
 * @param {string} html
 */
export function setHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

// ========================================
// モーダル関連
// ========================================

/**
 * モーダルを表示
 * @param {string} id - モーダル要素のID
 */
export function showModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'flex';
}

/**
 * モーダルを非表示
 * @param {string} id - モーダル要素のID
 */
export function hideModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

// ========================================
// 非同期ユーティリティ
// ========================================

/**
 * タイムアウト付きPromise
 * @param {Promise} promise
 * @param {number} timeoutMs
 * @param {string} [errorMessage]
 * @returns {Promise}
 */
export function withTimeout(promise, timeoutMs, errorMessage = 'Timeout') {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]);
}

/**
 * 遅延実行
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// デバウンス・スロットル
// ========================================

/**
 * デバウンス関数
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * スロットル関数
 * @param {Function} func
 * @param {number} limit
 * @returns {Function}
 */
export function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}
