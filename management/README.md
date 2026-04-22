# キミテラス Management (Frontend)

キミテラス（学校向けデジタルサイネージ）のフロントエンド。Next.js (App Router) + TypeScript + React で構築し、`output: 'export'` による静的エクスポートを Firebase Hosting で配信します。

サイネージ表示画面と各種管理画面（エディター、学校管理、クラス設定）の両方を含みます。プロジェクト全体の概要は [`../README.md`](../README.md) を参照してください。

## 開発

```bash
npm install
npm run dev
```

http://localhost:3000 でサイネージ表示を確認できます。各管理画面のパスは下記参照。

Firestoreなどバックエンドと合わせて確認したい場合は、リポジトリルートの `signage/` でFirebaseエミュレータを起動してください:

```bash
cd .. && npx firebase emulators:start
```

## ビルド & デプロイ

```bash
# 静的エクスポートを out/ に生成
npx next build

# デプロイ（signage/firebase.json が management/out を参照）
cd .. && npx firebase deploy --only hosting
```

## ページ構成（App Router）

| パス | ファイル | 用途 |
|---|---|---|
| `/` | `src/app/page.tsx` | サイネージ表示 |
| `/manage/editor` | `src/app/manage/editor/` | エディター（予定/連絡/提出物のCRUD） |
| `/manage/editor-mobile` | `src/app/manage/editor-mobile/` | モバイル向けエディター |
| `/manage/admin` | `src/app/manage/admin/` | 学校 / 学年 / クラス / メンバー管理 |
| `/manage/class-settings` | `src/app/manage/class-settings/` | 広告 / 静寂時間 |
| `/manage/login` | `src/app/manage/login/` | ログイン |

URLパラメータ `school`, `grade`, `class` でコンテキストを指定します（`useSchoolContext` が URLパラメータ → localStorage → デフォルトの順で解決）。

## ディレクトリ

```
src/
├── app/          # App Router ページ
├── components/   # auth/, context/, editor/, admin/, class-settings/, signage/, ui/
├── lib/          # firebase.ts, firebase-functions.ts, paths.ts, auth.ts, image-cache.ts, data-filter.ts, utils.ts
├── hooks/        # useAuth, useSchoolContext, useEditorData, useSignageData, useAdRotation 等
├── providers/    # AuthProvider, SchoolContextProvider
└── types/        # school.ts, auth.ts
```

## 主要モジュール

- **`lib/firebase.ts`** — Firebase 初期化（プロジェクト設定はここ）
- **`lib/firebase-functions.ts`** — Cloud Functions 呼び出しラッパー
- **`lib/paths.ts`** — Firestore ドキュメントパスの一元管理（`classDocRef`, `dailyDataDocRef` など）
- **`lib/image-cache.ts`** — 広告画像の IndexedDB キャッシュ（オフライン耐性）
- **`lib/data-filter.ts`** — 表示期間フィルタ等のユーティリティ
- **`hooks/useEditorData`** — Firestore リアルタイムリスナー + CRUD + マスター編集レベル切替
- **`hooks/useSignageData`** — 3階層データマージ + Firestore / 静的JSON フォールバック

## スタイル

`globals.css` + ページ / コンポーネント固有の CSS Modules (`.module.css`)。Tailwind は使用していません。

## 注意

- `next.config.ts` で `output: 'export'` を指定しているため、サーバー機能（Route Handlers, ISR, middleware の動的処理）は使えません。
- 画像最適化を無効化しているため、`<img>` をそのまま使用しています。
- ブランド名は「キミテラス by Rebounder」。

詳細なデータモデル、RBAC、Cloud Functions 一覧、デプロイ手順はリポジトリルートの [`../README.md`](../README.md) を参照してください。
