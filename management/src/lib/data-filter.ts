// lib/data-filter.ts - データフィルタリング（data-filter.jsの移植）

import { formatDateKey } from "./utils";

interface FilterableItem {
  display_start?: string;
  display_end?: string;
  [key: string]: unknown;
}

/** N日前の日付文字列を取得 */
export function getDaysAgoStr(daysBack = 5): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return formatDateKey(d);
}

/** display_start/display_endによるフィルタリング */
export function filterByDisplayRange<T extends FilterableItem>(
  items: T[] | undefined,
  todayStr: string,
  dateKey: string
): T[] {
  if (!items || !Array.isArray(items)) return [];
  return items.filter((item) => {
    const displayStart = item.display_start || dateKey;
    const displayEnd = item.display_end || dateKey;
    return todayStr >= displayStart && todayStr <= displayEnd;
  });
}

/** 提出物を最近のもののみフィルタリング */
export function filterRecentAssignments<
  T extends FilterableItem & { deadline: string },
>(items: T[] | undefined, daysBack = 5): T[] {
  if (!items || !Array.isArray(items)) return [];
  const cutoff = getDaysAgoStr(daysBack);
  return items.filter((item) => item.deadline >= cutoff);
}
