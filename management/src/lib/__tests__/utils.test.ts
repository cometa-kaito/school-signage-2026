import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DAYS_JP,
  calculateDaysLeft,
  debounce,
  delay,
  escapeHtml,
  formatDateDisplay,
  formatDateKey,
  getDateOffset,
  getTodayString,
  isWeekend,
  throttle,
  withTimeout,
} from "../utils";

describe("formatDateKey", () => {
  it("2桁ゼロ埋めの YYYY-MM-DD を返す", () => {
    expect(formatDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(formatDateKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("formatDateDisplay", () => {
  it("MM/DD (曜) 形式を返す", () => {
    // 2026-04-20 は月曜日
    expect(formatDateDisplay(new Date(2026, 3, 20))).toBe("04/20 (月)");
  });

  it("曜日表記が DAYS_JP と一致する", () => {
    const sun = new Date(2026, 3, 19); // 日曜
    expect(formatDateDisplay(sun)).toContain(`(${DAYS_JP[0]})`);
  });
});

describe("getTodayString", () => {
  it("YYYY-MM-DD 形式を返す", () => {
    expect(getTodayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("getDateOffset", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 20)); // 2026-04-20
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("0 は当日、正の値は未来、負の値は過去", () => {
    expect(formatDateKey(getDateOffset(0))).toBe("2026-04-20");
    expect(formatDateKey(getDateOffset(1))).toBe("2026-04-21");
    expect(formatDateKey(getDateOffset(-1))).toBe("2026-04-19");
    expect(formatDateKey(getDateOffset(10))).toBe("2026-04-30");
  });
});

describe("calculateDaysLeft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 20, 9, 0, 0)); // 2026-04-20 09:00
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("当日は本日締切かつ urgent", () => {
    const r = calculateDaysLeft("2026-04-20");
    expect(r.days).toBe(0);
    expect(r.text).toBe("本日締切");
    expect(r.cssClass).toBe("days-urgent");
  });

  it("未来の日付は残り日数を返す", () => {
    const r = calculateDaysLeft("2026-04-25");
    expect(r.days).toBe(5);
    expect(r.text).toBe("あと 5 日");
    expect(r.cssClass).toBe("days-left");
  });

  it("残り3日以内は urgent", () => {
    expect(calculateDaysLeft("2026-04-21").cssClass).toBe("days-urgent");
    expect(calculateDaysLeft("2026-04-23").cssClass).toBe("days-urgent");
    expect(calculateDaysLeft("2026-04-24").cssClass).toBe("days-left");
  });

  it("過去日は超過として表示", () => {
    const r = calculateDaysLeft("2026-04-18");
    expect(r.days).toBe(-2);
    expect(r.text).toBe("2日超過");
    expect(r.cssClass).toBe("days-urgent");
  });
});

describe("isWeekend", () => {
  it("土日は true", () => {
    expect(isWeekend(new Date(2026, 3, 18))).toBe(true); // 土
    expect(isWeekend(new Date(2026, 3, 19))).toBe(true); // 日
  });
  it("平日は false", () => {
    expect(isWeekend(new Date(2026, 3, 20))).toBe(false); // 月
    expect(isWeekend(new Date(2026, 3, 24))).toBe(false); // 金
  });
});

describe("escapeHtml", () => {
  it("HTML特殊文字をエスケープする", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
    expect(escapeHtml("a & b")).toBe("a &amp; b");
    expect(escapeHtml("'single'")).toBe("&#039;single&#039;");
  });
  it("空文字・undefinedは空文字を返す", () => {
    expect(escapeHtml("")).toBe("");
    expect(escapeHtml(undefined as unknown as string)).toBe("");
  });
});

describe("withTimeout", () => {
  it("時間内に完了すれば値を返す", async () => {
    const result = await withTimeout(Promise.resolve(42), 100);
    expect(result).toBe(42);
  });

  it("時間切れで reject する", async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 200));
    await expect(withTimeout(slow, 50, "timed out")).rejects.toThrow(
      "timed out"
    );
  });
});

describe("delay", () => {
  it("指定ms後に resolve する", async () => {
    vi.useFakeTimers();
    const p = delay(100);
    vi.advanceTimersByTime(100);
    await expect(p).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});

describe("debounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("連続呼び出しは最後の1回だけ実行される", () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d();
    d();
    d();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("throttle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("制限時間内の複数呼び出しは1回のみ実行", () => {
    const fn = vi.fn();
    const t = throttle(fn, 100);
    t();
    t();
    t();
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    t();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
