// utils.js - 共通ユーティリティ関数

/**
 * 曜日の日本語配列
 */
export const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * 今日の日付を YYYY-MM-DD 形式で取得
 * @returns {string}
 */
export function getTodayString() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
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
 * 時計を開始（現在時刻を更新）
 * @param {string} timeElId - 時刻表示要素のID
 * @param {string} [dateElId] - 日付表示要素のID（オプション）
 */
export function startClock(timeElId, dateElId = null) {
    const updateTime = () => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ja-JP', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const timeEl = document.getElementById(timeElId);
        if (timeEl) {
            timeEl.textContent = timeStr;
        }

        if (dateElId) {
            const dateEl = document.getElementById(dateElId);
            if (dateEl) {
                dateEl.textContent = `${now.getMonth() + 1}月${now.getDate()}日`;
            }
        }
    };
    
    updateTime();
    setInterval(updateTime, 1000);
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
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
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
 * HTMLエスケープ
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}