// lib/utils.ts - ユーティリティ関数（utils.jsの純粋関数のみ移植）

export const DAYS_JP = ["日", "月", "火", "水", "木", "金", "土"] as const;
export const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** 今日の日付を YYYY-MM-DD 形式で取得 */
export function getTodayString(): string {
  return formatDateKey(new Date());
}

/** 日付を MM/DD (曜) 形式でフォーマット */
export function formatDateDisplay(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const day = DAYS_JP[date.getDay()];
  return `${mm}/${dd} (${day})`;
}

/** 日付を YYYY-MM-DD 形式でフォーマット */
export function formatDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** 指定日数後の日付を取得 */
export function getDateOffset(daysOffset: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date;
}

/** 期限までの残り日数を計算 */
export function calculateDaysLeft(deadlineStr: string): {
  days: number;
  text: string;
  cssClass: string;
} {
  const today = new Date(getTodayString());
  const deadline = new Date(deadlineStr);
  const diffTime = deadline.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / MS_PER_DAY);

  let text = "";
  let cssClass = "";

  if (diffDays === 0) {
    text = "本日締切";
    cssClass = "days-urgent";
  } else if (diffDays < 0) {
    text = `${-diffDays}日超過`;
    cssClass = "days-urgent";
  } else {
    text = `あと ${diffDays} 日`;
    cssClass = diffDays <= 3 ? "days-urgent" : "days-left";
  }

  return { days: diffDays, text, cssClass };
}

/**
 * 端末のヘルス状態を lastSeen から計算
 *   online : 5分以内
 *   recent : 1時間以内
 *   offline: それ以上、または lastSeen なし、または status=inactive
 */
export function computeDeviceHealth(
  lastSeen: string | null | undefined,
  status?: string
): { key: "online" | "recent" | "offline"; label: string; color: string } {
  if (status === "inactive") {
    return { key: "offline", label: "オフライン", color: "#c62828" };
  }
  if (!lastSeen) {
    return { key: "offline", label: "未接続", color: "#c62828" };
  }
  const now = Date.now();
  const t = new Date(lastSeen).getTime();
  if (!Number.isFinite(t)) {
    return { key: "offline", label: "オフライン", color: "#c62828" };
  }
  const diffMin = (now - t) / 60000;
  if (diffMin <= 5) {
    return { key: "online", label: "オンライン", color: "#2e7d32" };
  }
  if (diffMin <= 60) {
    return { key: "recent", label: "最近", color: "#f9a825" };
  }
  return { key: "offline", label: "オフライン", color: "#c62828" };
}

/** lastSeen を「〇分前 / 〇時間前 / YYYY-MM-DD HH:MM」で表示 */
export function formatLastSeen(lastSeen: string | null | undefined): string {
  if (!lastSeen) return "-";
  const t = new Date(lastSeen).getTime();
  if (!Number.isFinite(t)) return "-";
  const diffSec = (Date.now() - t) / 1000;
  if (diffSec < 60) return "たった今";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}時間前`;
  const d = new Date(t);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd} ${hh}:${mi}`;
}

/** 日付が週末かどうかを判定 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** HTMLエスケープ */
export function escapeHtml(text: string): string {
  if (!text) return "";
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/** タイムアウト付きPromise */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = "Timeout"
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
}

/** 遅延実行 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** デバウンス */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return function executedFunction(...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/** スロットル */
export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
