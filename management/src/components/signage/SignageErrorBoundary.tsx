// components/signage/SignageErrorBoundary.tsx
// サイネージ画面の部分的なクラッシュを封じ込めるための React クラス ErrorBoundary。
//
// キオスク端末で動く画面なので、広告・予定・連絡・提出物のどれか1区画がクラッシュしても
// 残りの区画は生かしておきたい。Next.js App Router の error.tsx は page 全体しか守れないため、
// 区画ごとに本コンポーネントで包む。

"use client";

import { Component, type ReactNode } from "react";
import { logger } from "@/lib/logger";

interface Props {
  section: string;
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class SignageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    logger.error("signage.error_boundary.caught", {
      section: this.props.section,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack ?? null,
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <div
        role="alert"
        style={{
          padding: "12px 16px",
          color: "#6b7280",
          background: "rgba(17, 24, 39, 0.04)",
          borderRadius: 6,
          fontSize: 13,
          textAlign: "center",
        }}
      >
        この区画を表示できませんでした
      </div>
    );
  }
}
