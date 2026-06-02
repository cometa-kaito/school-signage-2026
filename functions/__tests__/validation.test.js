/**
 * helpers/validation.js の単体テスト
 *
 * firebase-functions の HttpsError を最小限にモックし、純粋ロジックを検証する。
 */

import { describe, it, expect, vi } from 'vitest';

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

const validation = await import('../helpers/validation.js');

describe('getErrorMessage', () => {
    it('既知エラーコードは日本語メッセージに変換', () => {
        expect(
            validation.getErrorMessage({ code: 'auth/email-already-exists' })
        ).toBe('このメールアドレスは既に使用されています');
    });

    it('未知エラーコードは error.message をそのまま返す', () => {
        expect(
            validation.getErrorMessage({ code: 'auth/unknown', message: 'fallback' })
        ).toBe('fallback');
    });
});

describe('validateRequired', () => {
    it('全フィールド揃っていればエラーにならない', () => {
        expect(() =>
            validation.validateRequired({ a: 1, b: 'x' }, ['a', 'b'])
        ).not.toThrow();
    });

    it('欠けているフィールドがあれば HttpsError', () => {
        expect(() =>
            validation.validateRequired({ a: 1 }, ['a', 'b'])
        ).toThrow(/bは必須/);
    });

    it('空文字も欠落扱い（truthy チェック）', () => {
        expect(() =>
            validation.validateRequired({ a: '' }, ['a'])
        ).toThrow(/aは必須/);
    });
});

describe('preventSelfAction', () => {
    it('別UIDなら通過', () => {
        expect(() =>
            validation.preventSelfAction('u1', 'u2', '削除')
        ).not.toThrow();
    });

    it('同一UIDなら HttpsError', () => {
        expect(() =>
            validation.preventSelfAction('u1', 'u1', '削除')
        ).toThrow(/自分自身を削除/);
    });
});

describe('validateEditorPasswordStrength', () => {
    // 許可ケース
    it('4文字以上の英字のみを許可', () => {
        expect(() => validation.validateEditorPasswordStrength('abcd')).not.toThrow();
    });

    it('英字のみ（数字なし）でも許可', () => {
        expect(() => validation.validateEditorPasswordStrength('password')).not.toThrow();
    });

    it('数字のみでも許可', () => {
        expect(() => validation.validateEditorPasswordStrength('1234')).not.toThrow();
    });

    // 拒否ケース
    it('4文字未満は拒否', () => {
        expect(() => validation.validateEditorPasswordStrength('abc')).toThrow(/4文字以上/);
    });

    it('文字列以外は拒否', () => {
        expect(() => validation.validateEditorPasswordStrength(undefined)).toThrow(/入力してください/);
    });

    it('空白のみは拒否', () => {
        expect(() => validation.validateEditorPasswordStrength('     ')).toThrow(/空白のみ/);
    });
});

describe('validatePasswordStrength (管理者用は据え置き)', () => {
    it('8文字以上 + 英字と数字を含めば許可', () => {
        expect(() => validation.validatePasswordStrength('abcd1234')).not.toThrow();
    });

    it('英字のみ（数字なし）は拒否（編集者用とは異なり厳格なまま）', () => {
        expect(() => validation.validatePasswordStrength('abcdefgh')).toThrow(/英字と数字/);
    });

    it('8文字未満は拒否', () => {
        expect(() => validation.validatePasswordStrength('abc123')).toThrow(/8文字以上/);
    });
});
