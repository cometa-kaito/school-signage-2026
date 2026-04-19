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
            style={{
              fontSize: "var(--fs-sm)",
              color: "var(--color-text-muted)",
              textDecoration: "none",
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            つかい方・フィードバック
          </a>
        )}
        <LogoutButton />
      </div>
    </header>
  );
}
