// lib/__tests__/auth.test.ts - 認証ヘルパーの単体テスト

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";

// ------------ モック（hoisted 変数で共有）--------------------------
const { mocks } = vi.hoisted(() => ({
  mocks: {
    signInWithEmailAndPassword: vi.fn(),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    setPersistence: vi.fn().mockResolvedValue(undefined),
    loginAsEditorFn: vi.fn(),
    getMyMembershipsFn: vi.fn(),
  },
}));

vi.mock("../firebase", () => ({ auth: { __fake: true } }));

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: mocks.signInWithEmailAndPassword,
  signInWithPopup: mocks.signInWithPopup,
  signOut: mocks.signOut,
  setPersistence: mocks.setPersistence,
  GoogleAuthProvider: class {},
  browserLocalPersistence: "local",
}));

vi.mock("../firebase-functions", () => ({
  loginAsEditorFn: mocks.loginAsEditorFn,
  getMyMembershipsFn: mocks.getMyMembershipsFn,
}));

// ---------------- ヘルパー -------------------------------------------
function makeUser(claims: Record<string, unknown>): User {
  return {
    uid: "u1",
    email: "a@example.com",
    getIdTokenResult: vi.fn().mockResolvedValue({ claims }),
  } as unknown as User;
}

// ---------------- テスト本体（import は vi.mock の後） ----------------
import {
  getUserClaims,
  getUserRoleLabel,
  hasAnyAccess,
  isUserAdmin,
  isUserTeacher,
  login,
  loginAsEditor,
  loginWithGoogle,
  logout,
} from "../auth";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("login (email/password)", () => {
  it("成功時は { success: true, user } を返す", async () => {
    const fakeUser = { uid: "u1" };
    mocks.signInWithEmailAndPassword.mockResolvedValue({ user: fakeUser });
    const result = await login("a@example.com", "pw");
    expect(result.success).toBe(true);
    expect(result.user).toBe(fakeUser);
  });

  it("既知エラーコードは日本語メッセージに変換", async () => {
    mocks.signInWithEmailAndPassword.mockRejectedValue({
      code: "auth/wrong-password",
    });
    const result = await login("a@example.com", "pw");
    expect(result.success).toBe(false);
    expect(result.error).toBe("パスワードが間違っています");
  });

  it("未知エラーコードはフォールバック文言を含む", async () => {
    mocks.signInWithEmailAndPassword.mockRejectedValue({
      code: "auth/unknown-xyz",
    });
    const result = await login("a@example.com", "pw");
    expect(result.success).toBe(false);
    expect(result.error).toContain("auth/unknown-xyz");
  });
});

describe("loginWithGoogle", () => {
  it("成功時は { success: true }", async () => {
    mocks.signInWithPopup.mockResolvedValue({ user: { uid: "u1" } });
    const result = await loginWithGoogle();
    expect(result.success).toBe(true);
  });

  it("ポップアップキャンセル時は日本語メッセージ", async () => {
    mocks.signInWithPopup.mockRejectedValue({
      code: "auth/popup-closed-by-user",
    });
    const result = await loginWithGoogle();
    expect(result.error).toBe("ログインがキャンセルされました");
  });
});

describe("logout", () => {
  it("成功時は { success: true }", async () => {
    mocks.signOut.mockResolvedValue(undefined);
    const result = await logout();
    expect(result.success).toBe(true);
  });

  it("失敗時は error を返す", async () => {
    mocks.signOut.mockRejectedValue(new Error("ネットワーク"));
    const result = await logout();
    expect(result.success).toBe(false);
    expect(result.error).toBe("ネットワーク");
  });
});

describe("loginAsEditor", () => {
  it("CloudFunction 成功 → Firebase ログインする", async () => {
    mocks.loginAsEditorFn.mockResolvedValue({
      data: {
        success: true,
        email: "editor@example.com",
        signInPassword: "one-time-secret-abc123",
      },
    });
    mocks.signInWithEmailAndPassword.mockResolvedValue({ user: { uid: "u1" } });
    const result = await loginAsEditor("pw", "s1");
    expect(result.success).toBe(true);
    // 編集者パスワード("pw")ではなく、サーバ発行の使い捨てパスワードでサインインする
    expect(mocks.signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      "editor@example.com",
      "one-time-secret-abc123"
    );
  });

  it("CloudFunction が success=false ならエラー", async () => {
    mocks.loginAsEditorFn.mockResolvedValue({ data: { success: false } });
    const result = await loginAsEditor("pw", "s1");
    expect(result.success).toBe(false);
  });

  it("CloudFunction が例外 → エラーメッセージを返す", async () => {
    mocks.loginAsEditorFn.mockRejectedValue(new Error("unauthorized"));
    const result = await loginAsEditor("pw", "s1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("unauthorized");
  });
});

describe("getUserClaims", () => {
  it("claims をそのまま返す", async () => {
    const claims = await getUserClaims(makeUser({ admin: true }));
    expect(claims.admin).toBe(true);
  });

  it("例外時は空オブジェクト", async () => {
    const user = {
      getIdTokenResult: vi.fn().mockRejectedValue(new Error("x")),
    } as unknown as User;
    expect(await getUserClaims(user)).toEqual({});
  });
});

describe("isUserAdmin", () => {
  it("null は false", async () => {
    expect(await isUserAdmin(null)).toBe(false);
  });

  it("admin=true は true", async () => {
    expect(await isUserAdmin(makeUser({ admin: true }))).toBe(true);
  });

  it("systemRole=system_admin は true", async () => {
    expect(
      await isUserAdmin(makeUser({ systemRole: "system_admin" }))
    ).toBe(true);
  });

  it("普通のユーザーは false", async () => {
    expect(await isUserAdmin(makeUser({}))).toBe(false);
    expect(await isUserAdmin(makeUser({ teacher: true }))).toBe(false);
  });
});

describe("isUserTeacher", () => {
  it("teacher / editor / admin / system_admin いずれかで true", async () => {
    expect(await isUserTeacher(makeUser({ teacher: true }))).toBe(true);
    expect(await isUserTeacher(makeUser({ editor: true }))).toBe(true);
    expect(await isUserTeacher(makeUser({ admin: true }))).toBe(true);
    expect(
      await isUserTeacher(makeUser({ systemRole: "system_admin" }))
    ).toBe(true);
  });

  it("null / 無権限は false", async () => {
    expect(await isUserTeacher(null)).toBe(false);
    expect(await isUserTeacher(makeUser({}))).toBe(false);
  });
});

describe("hasAnyAccess", () => {
  it("admin は true", async () => {
    expect(await hasAnyAccess(makeUser({ admin: true }))).toBe(true);
  });

  it("teacher は true", async () => {
    expect(await hasAnyAccess(makeUser({ teacher: true }))).toBe(true);
  });

  it("権限なし + membership あり → true", async () => {
    mocks.getMyMembershipsFn.mockResolvedValue({
      data: { memberships: [{ id: "m1", role: "school_admin" }] },
    });
    expect(await hasAnyAccess(makeUser({}))).toBe(true);
  });

  it("権限なし + membership なし → false", async () => {
    mocks.getMyMembershipsFn.mockResolvedValue({ data: { memberships: [] } });
    expect(await hasAnyAccess(makeUser({}))).toBe(false);
  });

  it("CloudFunctions 失敗時は false（権限なし扱い）", async () => {
    mocks.getMyMembershipsFn.mockRejectedValue(new Error("network"));
    expect(await hasAnyAccess(makeUser({}))).toBe(false);
  });

  it("null は false", async () => {
    expect(await hasAnyAccess(null)).toBe(false);
  });
});

describe("getUserRoleLabel", () => {
  it("system_admin は「システム管理者」", async () => {
    expect(
      await getUserRoleLabel(makeUser({ systemRole: "system_admin" }))
    ).toBe("システム管理者");
  });

  it("teacher は「教員」", async () => {
    expect(await getUserRoleLabel(makeUser({ teacher: true }))).toBe("教員");
  });

  it("membership が school_admin なら「学校管理者」", async () => {
    mocks.getMyMembershipsFn.mockResolvedValue({
      data: { memberships: [{ id: "m1", role: "school_admin" }] },
    });
    expect(await getUserRoleLabel(makeUser({}))).toBe("学校管理者");
  });

  it("null は空文字", async () => {
    expect(await getUserRoleLabel(null)).toBe("");
  });
});
