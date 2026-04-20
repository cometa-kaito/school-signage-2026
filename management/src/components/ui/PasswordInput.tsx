"use client";

import { useState } from "react";

interface PasswordInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  /** 入力欄本体に適用するクラス名（既存UIとの互換のため） */
  className?: string;
  /** 入力欄本体に適用するスタイル（既存UIとの互換のため） */
  inputStyle?: React.CSSProperties;
}

export function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  autoComplete = "new-password",
  className,
  inputStyle,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative", display: "flex", width: "100%" }}>
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        className={className}
        style={{
          flex: 1,
          paddingRight: 40,
          ...inputStyle,
        }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        title={visible ? "パスワードを隠す" : "パスワードを表示"}
        aria-label={visible ? "パスワードを隠す" : "パスワードを表示"}
        aria-pressed={visible}
        disabled={disabled}
        style={{
          position: "absolute",
          right: 4,
          top: "50%",
          transform: "translateY(-50%)",
          width: 32,
          height: 32,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          borderRadius: 4,
          cursor: disabled ? "not-allowed" : "pointer",
          color: "#666",
          padding: 0,
        }}
      >
        {visible ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <path d="M1 1l22 22" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
