"use client";

import Image from "next/image";
import { LogoutButton } from "@/components/auth/LogoutButton";
import styles from "@/styles/header.module.css";

interface HeaderProps {
  title?: string;
  children?: React.ReactNode;
}

export function Header({ title, children }: HeaderProps) {
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
      <LogoutButton />
    </header>
  );
}
