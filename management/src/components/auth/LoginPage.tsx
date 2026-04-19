"use client";

import { useState } from "react";
import Image from "next/image";
import { login, loginWithGoogle, loginAsEditor } from "@/lib/auth";
import { useSchoolContextValue } from "@/providers/SchoolContextProvider";
import styles from "@/styles/auth.module.css";

interface LoginPageProps {
  mode: "admin" | "editor";
}

export function LoginPage({ mode }: LoginPageProps) {
  const [activeTab, setActiveTab] = useState<"editor" | "admin">(
    mode === "admin" ? "admin" : "editor"
  );

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.logoContainer}>
          <Image
            src="/logo-full.png"
            alt="キミテラス"
            width={140}
            height={140}
            priority
          />
        </div>
        <p className={styles.loginSubtitle}>先生用 管理画面</p>

        {mode === "editor" && (
          <div className={styles.tabBar}>
            <button
              className={`${styles.tab} ${activeTab === "editor" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("editor")}
            >
              エディター
            </button>
            <button
              className={`${styles.tab} ${activeTab === "admin" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("admin")}
            >
              管理者
            </button>
          </div>
        )}

        {activeTab === "editor" ? <EditorLoginForm /> : <AdminLoginForm />}
      </div>
    </div>
  );
}

function EditorLoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { schoolId } = useSchoolContextValue();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError("");

    const result = await loginAsEditor(password, schoolId || "gn_tech");
    if (!result.success) {
      setError(result.error || "ログインに失敗しました");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.loginForm}>
      {error && <div className={styles.errorMsg}>{error}</div>}
      <div className={styles.formGroup}>
        <label htmlFor="editor-password">パスワード</label>
        <input
          id="editor-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="先生用のパスワード"
          disabled={loading}
        />
      </div>
      <button type="submit" className={styles.btnPrimary} disabled={loading}>
        {loading ? "ログインしています…" : "ログインする"}
      </button>
    </form>
  );
}

function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError("");

    const result = await login(email, password);
    if (!result.success) {
      setError(result.error || "ログインに失敗しました");
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    const result = await loginWithGoogle();
    if (!result.success) {
      setError(result.error || "Googleログインに失敗しました");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.loginForm}>
      {error && <div className={styles.errorMsg}>{error}</div>}
      <div className={styles.formGroup}>
        <label htmlFor="admin-email">メールアドレス</label>
        <input
          id="admin-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="メールアドレス"
          disabled={loading}
        />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="admin-password">パスワード</label>
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード"
          disabled={loading}
        />
      </div>
      <button type="submit" className={styles.btnPrimary} disabled={loading}>
        {loading ? "ログインしています…" : "ログインする"}
      </button>
      <div className={styles.divider}>
        <span>または</span>
      </div>
      <button
        type="button"
        className={styles.btnGoogle}
        onClick={handleGoogleLogin}
        disabled={loading}
      >
        Google でログイン
      </button>
    </form>
  );
}
