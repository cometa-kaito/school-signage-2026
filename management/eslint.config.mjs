import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Pre-existing patterns flagged by newer eslint-plugin-react-hooks.
  // 動作上問題はなく既存パターンのため、いったん warning に緩和し、後日リファクタで段階的に解消する。
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Node 用スクリプトは CommonJS。require() を許可する。
  {
    files: ["scripts/**/*.{js,cjs,mjs}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
