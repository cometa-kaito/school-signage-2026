/**
 * helpers/auth.js の単体テスト
 *
 * vi.mock が CJS の require() を完全に横取りできないため、
 * paths.js が提供する db オブジェクトの collection メソッドを直接置換する。
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

class FakeHttpsError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'HttpsError';
    }
}

vi.mock('firebase-functions', () => {
    const httpsNs = { HttpsError: FakeHttpsError };
    const mod = {
        https: httpsNs,
        region: () => ({ https: httpsNs }),
    };
    return { default: mod, ...mod };
});

const membershipDocs = new Map();

let auth;

beforeAll(async () => {
    // 読み込み順: paths → auth の順に解決され、db は paths.js の
    // モジュールローカル const に束縛されている。
    // 動的 import で取得したオブジェクトの collection を差し替える。
    const paths = await import('../helpers/paths.js');
    paths.db.collection = () => ({
        doc: (membershipId) => ({
            get: async () => {
                const data = membershipDocs.get(membershipId);
                return {
                    exists: data !== undefined,
                    data: () => data,
                };
            },
        }),
    });
    auth = await import('../helpers/auth.js');
});

function ctx(token) {
    return token ? { auth: { uid: 'me', token } } : { auth: null };
}

beforeEach(() => {
    membershipDocs.clear();
});

describe('verifyAuth', () => {
    it('未認証は HttpsError', () => {
        expect(() => auth.verifyAuth(ctx(null))).toThrow(/ログインが必要/);
    });

    it('認証済みなら通過', () => {
        expect(() => auth.verifyAuth(ctx({}))).not.toThrow();
    });
});

describe('verifyAdmin', () => {
    it('admin=true は通過', () => {
        expect(() => auth.verifyAdmin(ctx({ admin: true }))).not.toThrow();
    });

    it('systemRole=system_admin は通過', () => {
        expect(() =>
            auth.verifyAdmin(ctx({ systemRole: 'system_admin' }))
        ).not.toThrow();
    });

    it('権限なしは permission-denied', () => {
        expect(() => auth.verifyAdmin(ctx({ teacher: true }))).toThrow(
            /管理者権限/
        );
    });

    it('未認証は先に unauthenticated', () => {
        expect(() => auth.verifyAdmin(ctx(null))).toThrow(/ログインが必要/);
    });
});

describe('verifySchoolAdmin', () => {
    it('systemAdmin 通過', async () => {
        await expect(
            auth.verifySchoolAdmin(ctx({ admin: true }), 's1')
        ).resolves.toBeUndefined();
    });

    it('membership.role=school_admin 通過', async () => {
        membershipDocs.set('me_s1', { role: 'school_admin' });
        await expect(
            auth.verifySchoolAdmin(ctx({}), 's1')
        ).resolves.toBeUndefined();
    });

    it('membership なしは permission-denied', async () => {
        await expect(
            auth.verifySchoolAdmin(ctx({}), 's1')
        ).rejects.toThrow(/この学校の管理者権限/);
    });

    it('teacher ロールは permission-denied', async () => {
        membershipDocs.set('me_s1', { role: 'teacher' });
        await expect(
            auth.verifySchoolAdmin(ctx({}), 's1')
        ).rejects.toThrow(/この学校の管理者権限/);
    });
});

describe('verifyClassAccess', () => {
    it('systemAdmin 通過', async () => {
        await expect(
            auth.verifyClassAccess(ctx({ admin: true }), 's1', 'c1')
        ).resolves.toBeUndefined();
    });

    it('school_admin 通過', async () => {
        membershipDocs.set('me_s1', { role: 'school_admin' });
        await expect(
            auth.verifyClassAccess(ctx({}), 's1', 'c1')
        ).resolves.toBeUndefined();
    });

    it('teacher 通過', async () => {
        membershipDocs.set('me_s1', { role: 'teacher' });
        await expect(
            auth.verifyClassAccess(ctx({}), 's1', 'c1')
        ).resolves.toBeUndefined();
    });

    it('editor 通過', async () => {
        membershipDocs.set('me_s1', { role: 'editor' });
        await expect(
            auth.verifyClassAccess(ctx({}), 's1', 'c1')
        ).resolves.toBeUndefined();
    });

    it('claim editor 通過（membership なし）', async () => {
        await expect(
            auth.verifyClassAccess(ctx({ editor: true, schoolId: 's1' }), 's1', 'c1')
        ).resolves.toBeUndefined();
    });

    it('membership なしは permission-denied', async () => {
        await expect(
            auth.verifyClassAccess(ctx({}), 's1', 'c1')
        ).rejects.toThrow(/アクセス権がありません/);
    });

    it('未知ロールは permission-denied', async () => {
        membershipDocs.set('me_s1', { role: 'guest' });
        await expect(
            auth.verifyClassAccess(ctx({}), 's1', 'c1')
        ).rejects.toThrow(/アクセス権/);
    });
});

describe('withAuth', () => {
    it('authCheck 成功 → handler の結果を返す', async () => {
        const handler = vi.fn().mockResolvedValue({ ok: true });
        const wrapped = auth.withAuth(handler, () => {});
        const result = await wrapped({ x: 1 }, ctx({ admin: true }));
        expect(result).toEqual({ ok: true });
    });

    it('authCheck throw → handler は呼ばれない', async () => {
        const handler = vi.fn();
        const wrapped = auth.withAuth(handler, () => {
            throw new FakeHttpsError('unauthenticated', 'x');
        });
        await expect(wrapped({}, ctx(null))).rejects.toThrow();
        expect(handler).not.toHaveBeenCalled();
    });

    it('handler の HttpsError は再送出', async () => {
        const handler = vi
            .fn()
            .mockRejectedValue(new FakeHttpsError('not-found', '見つからない'));
        const wrapped = auth.withAuth(handler, null);
        await expect(wrapped({}, ctx({ admin: true }))).rejects.toThrow(
            /見つからない/
        );
    });

    it('予期しない例外は internal エラーに変換', async () => {
        const handler = vi.fn().mockRejectedValue(new Error('boom'));
        const wrapped = auth.withAuth(handler, null);
        await expect(wrapped({}, ctx({ admin: true }))).rejects.toMatchObject({
            code: 'internal',
            message: 'boom',
        });
    });
});
