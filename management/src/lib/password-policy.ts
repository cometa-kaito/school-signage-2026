// lib/password-policy.ts
// パスワード強度ポリシー (フロント/バック共通の定義)
// サーバー側の同一検証: functions/helpers/validation.js::validatePasswordStrength

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_POLICY_LABEL = `${PASSWORD_MIN_LENGTH}文字以上、英字と数字を含む`;

/**
 * パスワード強度の検証。OK なら null、NG ならエラーメッセージを返す。
 * UIではこの戻り値を表示に流用できる。
 */
export function checkPasswordStrength(password: string): string | null {
  if (typeof password !== "string" || password.length === 0) {
    return "パスワードを入力してください";
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `パスワードは${PASSWORD_MIN_LENGTH}文字以上必要です`;
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "パスワードは英字と数字の両方を含む必要があります";
  }
  if (/^\s*$/.test(password)) {
    return "パスワードに空白のみは使えません";
  }
  return null;
}

// --- エディター用パスワードポリシー ---------------------------------------
// 管理者ユーザー用 (checkPasswordStrength) より緩い。
// 教員・エディターが使いやすいように 4文字以上 のみを必須とし、
// 英字のみ（数字なし）でも許可する。
// サーバー側の同一検証: functions/helpers/validation.js::validateEditorPasswordStrength

export const EDITOR_PASSWORD_MIN_LENGTH = 4;

export const EDITOR_PASSWORD_POLICY_LABEL = `${EDITOR_PASSWORD_MIN_LENGTH}文字以上（英字のみでも可）`;

/**
 * エディター用パスワードの検証。OK なら null、NG ならエラーメッセージを返す。
 * 要件: 4文字以上 / 空白のみ不可。文字種の制約はなし（英字のみでも可）。
 */
export function checkEditorPasswordStrength(password: string): string | null {
  if (typeof password !== "string" || password.length === 0) {
    return "パスワードを入力してください";
  }
  if (password.length < EDITOR_PASSWORD_MIN_LENGTH) {
    return `パスワードは${EDITOR_PASSWORD_MIN_LENGTH}文字以上必要です`;
  }
  if (/^\s*$/.test(password)) {
    return "パスワードに空白のみは使えません";
  }
  return null;
}
