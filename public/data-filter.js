// data-filter.js - データフィルタリングの共通ロジック

import { formatDateKey } from './utils.js';

/**
 * N日前の日付文字列を取得
 * @param {number} daysBack - 何日前か（デフォルト: 5）
 * @returns {string} YYYY-MM-DD形式の日付文字列
 */
export function getDaysAgoStr(daysBack = 5) {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    return formatDateKey(d);
}

/**
 * display_start/display_endによるフィルタリング
 * 各アイテムのdisplay_start～display_endの範囲に今日が含まれるかチェック
 *
 * @param {Array} items - フィルタ対象のアイテム配列
 * @param {string} todayStr - 今日の日付文字列（YYYY-MM-DD）
 * @param {string} dateKey - アイテムが属する日付キー（デフォルト範囲として使用）
 * @returns {Array} フィルタされたアイテム配列
 */
export function filterByDisplayRange(items, todayStr, dateKey) {
    if (!items || !Array.isArray(items)) return [];
    return items.filter(item => {
        const displayStart = item.display_start || dateKey;
        const displayEnd = item.display_end || dateKey;
        return todayStr >= displayStart && todayStr <= displayEnd;
    });
}

/**
 * 提出物を最近のもののみフィルタリング
 * @param {Array} assignments - 提出物配列
 * @param {number} daysBack - 何日前まで含めるか（デフォルト: 5）
 * @returns {Array} フィルタされた提出物配列
 */
export function filterRecentAssignments(assignments, daysBack = 5) {
    if (!assignments || !Array.isArray(assignments)) return [];
    const cutoff = getDaysAgoStr(daysBack);
    return assignments.filter(item => item.deadline >= cutoff);
}
