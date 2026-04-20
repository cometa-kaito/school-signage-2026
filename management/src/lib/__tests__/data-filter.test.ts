import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  filterByDisplayRange,
  filterRecentAssignments,
  getDaysAgoStr,
} from "../data-filter";

describe("getDaysAgoStr", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 20, 9, 0, 0)); // 2026-04-20
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("デフォルトは5日前", () => {
    expect(getDaysAgoStr()).toBe("2026-04-15");
  });

  it("0 は当日", () => {
    expect(getDaysAgoStr(0)).toBe("2026-04-20");
  });

  it("任意の日数を指定できる", () => {
    expect(getDaysAgoStr(7)).toBe("2026-04-13");
    expect(getDaysAgoStr(30)).toBe("2026-03-21");
  });
});

describe("filterByDisplayRange", () => {
  const today = "2026-04-20";
  const dateKey = "2026-04-20";

  it("display_start/endが未設定なら dateKey と一致する日のみ通す", () => {
    const items = [{ id: "a" }, { id: "b" }];
    expect(filterByDisplayRange(items, today, dateKey)).toHaveLength(2);
    expect(filterByDisplayRange(items, today, "2026-04-19")).toHaveLength(0);
  });

  it("display_start/end の範囲内のみ通す", () => {
    const items = [
      { id: "past", display_start: "2026-04-01", display_end: "2026-04-10" },
      { id: "now", display_start: "2026-04-15", display_end: "2026-04-25" },
      { id: "future", display_start: "2026-05-01", display_end: "2026-05-10" },
    ];
    const result = filterByDisplayRange(items, today, dateKey);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("now");
  });

  it("undefined や 非配列は空配列を返す", () => {
    expect(filterByDisplayRange(undefined, today, dateKey)).toEqual([]);
    expect(
      filterByDisplayRange(
        "notarray" as unknown as undefined,
        today,
        dateKey
      )
    ).toEqual([]);
  });

  it("境界: 開始日当日と終了日当日は含む", () => {
    const items = [
      { id: "start", display_start: today, display_end: "2026-04-25" },
      { id: "end", display_start: "2026-04-15", display_end: today },
    ];
    expect(filterByDisplayRange(items, today, dateKey)).toHaveLength(2);
  });
});

describe("filterRecentAssignments", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 20, 9, 0, 0)); // 2026-04-20
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("デフォルト: 2日前より古い締切は除外", () => {
    const items = [
      { id: "old", deadline: "2026-04-17" }, // 3日前 → 除外
      { id: "recent", deadline: "2026-04-18" }, // 2日前 → 含める
      { id: "today", deadline: "2026-04-20" },
      { id: "future", deadline: "2026-04-25" },
    ];
    const result = filterRecentAssignments(items);
    expect(result.map((i) => i.id)).toEqual(["recent", "today", "future"]);
  });

  it("undefined / 非配列 は空配列を返す", () => {
    expect(filterRecentAssignments(undefined)).toEqual([]);
  });

  it("daysBack カスタム指定", () => {
    const items = [
      { id: "a", deadline: "2026-04-10" },
      { id: "b", deadline: "2026-04-19" },
    ];
    expect(filterRecentAssignments(items, 0).map((i) => i.id)).toEqual([]);
    expect(filterRecentAssignments(items, 365).map((i) => i.id)).toEqual([
      "a",
      "b",
    ]);
  });
});
