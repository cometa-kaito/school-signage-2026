"use client";

import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";

/*
 * useVersionWatcher
 *
 * Kiosk クライアントが古いバンドルを表示し続ける問題への対処。
 *
 * 仕組み:
 *  1. 初回マウント時に /version.json を取得し、その値を「自分が表示している版」として記憶する。
 *  2. 一定間隔で /version.json を再取得し、初回値と異なればデプロイされた新バージョンとみなして
 *     location.reload() でフルリロードする（次の取得で新 HTML/JS/CSS が落ちてくる）。
 *
 * /version.json は build 時に scripts/write-version.js が生成するビルド時刻（ms）。
 * Cache-Control: no-cache を firebase.json で設定しており、毎回サーバへ取りに行く。
 */

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 分
const VERSION_URL = "/version.json";

async function fetchVersion(): Promise<string | null> {
  try {
    const res = await fetch(VERSION_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: unknown };
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

export function useVersionWatcher(intervalMs: number = DEFAULT_INTERVAL_MS) {
  const initialVersionRef = useRef<string | null>(null);
  const reloadingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (reloadingRef.current) return;
      const current = await fetchVersion();
      if (cancelled || !current) return;

      if (initialVersionRef.current === null) {
        // 初回 — 自分の版として記憶
        initialVersionRef.current = current;
        logger.debug("signage.version.init", { version: current });
        return;
      }

      if (current !== initialVersionRef.current) {
        // 新しいデプロイを検知 — リロードして新バンドルを取りに行く
        reloadingRef.current = true;
        logger.warn("signage.version.changed", {
          from: initialVersionRef.current,
          to: current,
        });
        window.location.reload();
      }
    };

    // 初回取得 → 以降ポーリング
    check();
    const timer = setInterval(check, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intervalMs]);
}
