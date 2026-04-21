// lib/logger.ts
// フロントエンド用ロガー
//
// 運用方針:
//  - エラー/警告は本番でも console に出す（ブラウザ DevTools やキオスク端末のログで追える）
//  - info/debug は本番では握りつぶす（キオスク端末のログ肥大を避ける）
//  - すべて1行の JSON 互換オブジェクトで出す → 将来の外部ログ送信差し替えを容易に
//
// 使い方:
//   import { logger } from "@/lib/logger";
//   logger.error("feature.operation_failed", { id: 42, message: err.message });

type LogContext = Record<string, unknown> | undefined;

const isProd = process.env.NODE_ENV === "production";

function emit(
  level: "debug" | "info" | "warn" | "error",
  event: string,
  context?: LogContext,
) {
  if (isProd && (level === "debug" || level === "info")) return;

  const payload = context ? { event, ...context } : { event };
  const method = level === "debug" ? "log" : level;

  // 構造化された1行ログ。開発中でも読みやすく、本番でも grep しやすい。
  (console[method] as (...a: unknown[]) => void)(`[${level}] ${event}`, payload);
}

export const logger = {
  debug: (event: string, context?: LogContext) => emit("debug", event, context),
  info: (event: string, context?: LogContext) => emit("info", event, context),
  warn: (event: string, context?: LogContext) => emit("warn", event, context),
  error: (event: string, context?: LogContext) => emit("error", event, context),
};
