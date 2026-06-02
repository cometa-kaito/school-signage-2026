"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import styles from "@/styles/header.module.css";

interface HeaderProps {
  title?: string;
  children?: React.ReactNode;
}

export function Header({ title, children }: HeaderProps) {
  const pathname = usePathname();
  const isGuide = pathname === "/manage/guide";

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <Image
          src="/logo-text.png"
          alt="キミテラス"
          width={120}
          height={30}
          className={styles.logo}
          priority
        />
        {title && <h1 className={styles.title}>{title}</h1>}
        {children}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {!isGuide && (
          <a
            href="/manage/guide"
            className={styles.feedbackButton}
            title="つかい方とフィードバック"
            aria-label="フィードバックを送る・つかい方を見る"
          >
            <svg
              className={styles.feedbackIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            フィードバック
          </a>
        )}
        <LogoutButton />
      </div>
    </header>
  );
}
