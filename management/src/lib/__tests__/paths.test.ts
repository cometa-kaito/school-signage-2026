// lib/__tests__/paths.test.ts - Firestoreパス構築の単体テスト
//
// firebase-admin は副作用が重いので `firebase/firestore` の doc/collection を
// 薄くモックしてパス引数のみ検証する。

import { describe, expect, it, vi } from "vitest";

vi.mock("../firebase", () => ({ db: { __fake: true } }));

vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...segments: string[]) => ({
    type: "doc",
    path: segments.join("/"),
  }),
  collection: (_db: unknown, ...segments: string[]) => ({
    type: "collection",
    path: segments.join("/"),
  }),
}));

import {
  classDocRef,
  dailyDataCollectionRef,
  dailyDataDocRef,
  departmentDocRef,
  departmentMasterDailyDataCollectionRef,
  departmentMasterDailyDataDocRef,
  gradeConfigRef,
  gradeDocRef,
  gradeMasterDailyDataCollectionRef,
  gradeMasterDailyDataDocRef,
  schoolConfigRef,
  schoolDocRef,
  schoolMasterDailyDataCollectionRef,
  schoolMasterDailyDataDocRef,
  scheduleTemplatesRef,
} from "../paths";

type RefLike = { path: string };

describe("schoolDocRef / schoolConfigRef", () => {
  it("学校ドキュメントのパス", () => {
    expect((schoolDocRef("s1") as unknown as RefLike).path).toBe("schools/s1");
  });

  it("configサブドキュメントのパス", () => {
    expect(
      (schoolConfigRef("s1", "editor_auth") as unknown as RefLike).path
    ).toBe("schools/s1/config/editor_auth");
  });

  it("scheduleTemplatesRef は config/schedule_templates を指す", () => {
    expect((scheduleTemplatesRef("s1") as unknown as RefLike).path).toBe(
      "schools/s1/config/schedule_templates"
    );
  });
});

describe("クラスモード（departmentId なし）", () => {
  it("学年ドキュメント", () => {
    expect((gradeDocRef("s1", "g1") as unknown as RefLike).path).toBe(
      "schools/s1/grades/g1"
    );
  });

  it("クラスドキュメント", () => {
    expect((classDocRef("s1", "g1", "c1") as unknown as RefLike).path).toBe(
      "schools/s1/grades/g1/classes/c1"
    );
  });

  it("日次データ", () => {
    expect(
      (dailyDataDocRef("s1", "g1", "c1", "2026-04-20") as unknown as RefLike)
        .path
    ).toBe("schools/s1/grades/g1/classes/c1/daily_data/2026-04-20");
  });

  it("日次データコレクション", () => {
    expect(
      (dailyDataCollectionRef("s1", "g1", "c1") as unknown as RefLike).path
    ).toBe("schools/s1/grades/g1/classes/c1/daily_data");
  });

  it("学年マスター", () => {
    expect(
      (
        gradeMasterDailyDataDocRef(
          "s1",
          "g1",
          "2026-04-20"
        ) as unknown as RefLike
      ).path
    ).toBe("schools/s1/grades/g1/master_daily_data/2026-04-20");
  });

  it("学校マスター", () => {
    expect(
      (
        schoolMasterDailyDataDocRef("s1", "2026-04-20") as unknown as RefLike
      ).path
    ).toBe("schools/s1/master_daily_data/2026-04-20");
  });

  it("学校マスターコレクション", () => {
    expect(
      (schoolMasterDailyDataCollectionRef("s1") as unknown as RefLike).path
    ).toBe("schools/s1/master_daily_data");
  });

  it("学年コンフィグ", () => {
    expect(
      (gradeConfigRef("s1", "g1", "display_settings") as unknown as RefLike)
        .path
    ).toBe("schools/s1/grades/g1/config/display_settings");
  });
});

describe("学科モード（departmentId あり）", () => {
  it("学科ドキュメント", () => {
    expect((departmentDocRef("s1", "d1") as unknown as RefLike).path).toBe(
      "schools/s1/departments/d1"
    );
  });

  it("学年ドキュメント（学科配下）", () => {
    expect((gradeDocRef("s1", "g1", "d1") as unknown as RefLike).path).toBe(
      "schools/s1/departments/d1/grades/g1"
    );
  });

  it("クラスドキュメント（学科配下）", () => {
    expect(
      (classDocRef("s1", "g1", "c1", "d1") as unknown as RefLike).path
    ).toBe("schools/s1/departments/d1/grades/g1/classes/c1");
  });

  it("日次データ（学科配下）", () => {
    expect(
      (
        dailyDataDocRef(
          "s1",
          "g1",
          "c1",
          "2026-04-20",
          "d1"
        ) as unknown as RefLike
      ).path
    ).toBe(
      "schools/s1/departments/d1/grades/g1/classes/c1/daily_data/2026-04-20"
    );
  });

  it("学科マスター", () => {
    expect(
      (
        departmentMasterDailyDataDocRef(
          "s1",
          "d1",
          "2026-04-20"
        ) as unknown as RefLike
      ).path
    ).toBe("schools/s1/departments/d1/master_daily_data/2026-04-20");
  });

  it("学科マスターコレクション", () => {
    expect(
      (
        departmentMasterDailyDataCollectionRef(
          "s1",
          "d1"
        ) as unknown as RefLike
      ).path
    ).toBe("schools/s1/departments/d1/master_daily_data");
  });

  it("学年マスターコレクション（学科配下）", () => {
    expect(
      (
        gradeMasterDailyDataCollectionRef(
          "s1",
          "g1",
          "d1"
        ) as unknown as RefLike
      ).path
    ).toBe("schools/s1/departments/d1/grades/g1/master_daily_data");
  });

  it("学年コンフィグ（学科配下）", () => {
    expect(
      (
        gradeConfigRef(
          "s1",
          "g1",
          "display_settings",
          "d1"
        ) as unknown as RefLike
      ).path
    ).toBe("schools/s1/departments/d1/grades/g1/config/display_settings");
  });
});

describe("departmentId フォールバック", () => {
  it("null/undefined は クラスモード扱い", () => {
    expect((gradeDocRef("s1", "g1", null) as unknown as RefLike).path).toBe(
      "schools/s1/grades/g1"
    );
    expect(
      (gradeDocRef("s1", "g1", undefined) as unknown as RefLike).path
    ).toBe("schools/s1/grades/g1");
  });

  it("空文字列もクラスモード扱い（falsy）", () => {
    expect((gradeDocRef("s1", "g1", "") as unknown as RefLike).path).toBe(
      "schools/s1/grades/g1"
    );
  });
});
