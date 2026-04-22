# キミテラス by Rebounder

学校・教室向けデジタルサイネージシステム（旧 DIGI+）。予定・連絡事項・提出物・広告をリアルタイムで表示し、管理画面から編集できます。マルチテナント対応（複数学校 / 複数学年 / 複数クラス）。

## 概要

教室に設置されたディスプレイ（Chromium系ブラウザ / キオスク）に学校情報を表示するWebアプリです。Firestoreのリアルタイム同期により、管理者の更新が即座にサイネージへ反映されます。学校ネットワークでFirestoreがブロックされる場合は静的JSONポーリングへ自動フォールバックします。

### 主な機能

- 今後3日間の予定表示（土日を自動スキップ）
- 連絡事項（重要マーク・自動スクロール対応）
- 提出物管理（期限切れ警告、残り日数表示）
- 広告ローテーション（画像/動画、表示時間設定可能）
- 静寂時間（Quiet Hours）：授業時間中は広告・音声を抑制
- 詳細表示モード（タップで全画面、20秒後自動復帰）
- モバイルレイアウト（幅 < 900px で自動切替）
- 画像のIndexedDBキャッシュ（オフライン耐性）
- キオスクモード対応

## システム構成

```
（リポジトリルート）
├── management/                # フロントエンド（Next.js + TypeScript, 静的エクスポート）
│   ├── next.config.ts         # output: 'export'
│   ├── public/                # 静的アセット
│   └── src/
│       ├── app/               # App Router
│       │   ├── page.tsx                   # サイネージ表示（/）
│       │   ├── manage/editor/             # エディター（/manage/editor）
│       │   ├── manage/editor-mobile/      # モバイルエディター
│       │   ├── manage/admin/              # 学校管理
│       │   ├── manage/class-settings/     # クラス設定（広告/静寂時間）
│       │   └── manage/login/              # ログイン
│       ├── components/        # auth/, context/, editor/, admin/, class-settings/, signage/, ui/
│       ├── lib/               # firebase.ts, firebase-functions.ts, paths.ts, auth.ts, image-cache.ts, data-filter.ts
│       ├── hooks/             # useAuth, useSchoolContext, useEditorData, useSignageData, useAdRotation 等
│       ├── providers/         # AuthProvider, SchoolContextProvider
│       └── types/             # school.ts, auth.ts
├── functions/                 # Firebase Cloud Functions (Node.js 20)
│   ├── index.js               # エントリポイント（再エクスポート）
│   ├── helpers/               # 共通ヘルパー
│   └── handlers/              # 機能別ハンドラー
├── scripts/                   # 運用スクリプト
├── firebase.json              # Hosting設定（management/out をデプロイ）
├── firestore.rules            # Firestoreセキュリティルール（RBAC対応）
└── storage.rules              # Storageセキュリティルール
```

## 技術スタック

| 区分 | 技術 |
|------|------|
| フロントエンド | Next.js (App Router) + TypeScript + React, CSS Modules, 静的エクスポート |
| バックエンド | Firebase Cloud Functions (Node.js 20) |
| データベース | Cloud Firestore |
| ファイル保存 | Cloud Storage |
| 認証 | Firebase Authentication |
| ホスティング | Firebase Hosting |
| 対象ブラウザ | Chromium系（教室ディスプレイ向け） |

## セットアップ

### 前提条件

- Node.js 20以上
- Firebase CLI (`npm install -g firebase-tools`)
- Firebaseプロジェクト

### 1. 依存関係のインストール

```bash
npm install
cd functions && npm install && cd ..
cd management && npm install && cd ..
```

### 2. Firebase設定

```bash
firebase login
firebase use --add
```

`management/src/lib/firebase.ts` の `firebaseConfig` を自分のプロジェクトの設定に更新してください。

### 3. ローカル開発

```bash
# 管理画面の開発サーバー
cd management && npm run dev

# Firebase エミュレータ（Hosting / Firestore / Functions / Storage）
npx firebase emulators:start
# 特定サービスのみ
npx firebase emulators:start --only hosting,firestore
```

### 4. ビルド & デプロイ

```bash
# 静的エクスポートを生成（management/out/ に出力）
cd management && npx next build && cd ..

# デプロイ
npx firebase deploy --only hosting    # フロントエンド
npx firebase deploy --only functions  # Cloud Functions
npx firebase deploy                   # 全体（Hosting + Functions + Rules）
```

**本番URL**

- サイネージ表示: https://school-signage-2026.web.app/
- 管理画面: https://school-signage-2026.web.app/manage/editor

### デプロイチェックリスト

1. `serviceAccountKey.json` がpublicに公開されていないこと
2. `firebase.ts` の設定が正しいこと
3. `next build` が成功し `out/` が生成されること
4. デプロイ後、サイネージ（`/`）が正常表示されること
5. 管理画面（`/manage/editor`）でログイン・CRUDが動作すること
6. 旧URL（`/editor.html` 等）が新URLに301リダイレクトされること
7. 問題発生時のロールバック: `npx firebase hosting:rollback`

## URL構成

- `/?school=X&grade=Y&class=Z` — サイネージ表示（パラメータなしは管理画面にリダイレクト）
- `/manage/editor?school=X&grade=Y&class=Z` — エディター（予定/連絡/提出物のCRUD）
- `/manage/editor-mobile?school=X&grade=Y&class=Z` — モバイルエディター
- `/manage/admin` — 学校一覧（system_admin）
- `/manage/admin?school=X` — 学校詳細（学年/クラス/メンバー管理）
- `/manage/class-settings?school=X&grade=Y&class=Z` — クラス設定（広告/静寂時間）
- `/manage/login` — ログイン

## データモデル（3階層: 学校 > 学年 > クラス）

```
schools/{schoolId}
  ├── grades/{gradeId}                       # 学年
  │   ├── name: "電子工学科2年"
  │   ├── order: 1
  │   └── classes/{classId}                  # クラス
  │       ├── name: "A組"
  │       ├── displaySettings: { ads, quietHours }
  │       └── daily_data/{YYYY-MM-DD}        # 日次データ（予定・連絡・提出物）
  └── config/editor_auth                     # 学校パスワード（簡易ログイン）

memberships/{userId}_{schoolId}              # ユーザーと学校の紐づけ
  ├── role: "school_admin" | "teacher" | "editor"
  └── classIds: []
```

Firestoreドキュメントパスはフロントエンド側で `management/src/lib/paths.ts` に一元化されています:

- `classDocRef(schoolId, gradeId, classId)`
- `dailyDataDocRef(schoolId, gradeId, classId, dateStr)`
- `dailyDataCollectionRef(schoolId, gradeId, classId)`
- `schoolMasterDailyDataDocRef(schoolId, dateStr)`
- `gradeMasterDailyDataDocRef(schoolId, gradeId, dateStr)`

### daily_data ドキュメント例

```javascript
{
  date: "2026-04-22",
  schedules: [
    { time: "1限", content: "数学テスト", display_start: "", display_end: "" }
  ],
  notices: [
    { text: "明日は体育祭です", is_highlight: true }
  ],
  assignments: [
    { deadline: "2026-04-30", subject: "国語", task: "読書感想文" }
  ]
}
```

## RBAC（権限管理）

| ロール | できること |
|---|---|
| `system_admin` | 全学校の作成・管理 |
| `school_admin` | 自校の全学年・クラス・メンバー管理 |
| `teacher` | 担当クラスのコンテンツ編集 |
| `editor` | 担当クラスのコンテンツ編集（簡易ログイン） |

## レイアウトモード

- **サイネージモード** (幅 ≥ 900px): 2カラムグリッド、右側に広告
- **モバイルモード** (幅 < 900px): 上部バナー広告
- **詳細表示モード**: タップで広告を隠して全画面、20秒後自動復帰

## アーキテクチャ

- **AuthProvider**: `onAuthStateChanged` でFirebase Auth状態を管理
- **SchoolContextProvider**: 学校 / 学年 / クラスのコンテキスト（URLパラメータ → localStorage → デフォルト）
- **useEditorData hook**: Firestoreリアルタイムリスナー + CRUD + マスター編集レベル切替
- **useSignageData hook**: 3階層データマージ + Firestoreリアルタイム / 静的JSONフォールバック
- **CSS**: `globals.css` + ページ固有 CSS Modules (`.module.css`)

### サイネージ表示の主要コンポーネント

- `SignagePage.tsx` — メインオーケストレータ（スタートアップ画面、レイアウト切替、詳細モード）
- `ScheduleGrid.tsx` — 3日分のスケジュール表示
- `NoticeList.tsx` — 連絡事項（自動スクロール）
- `AssignmentTable.tsx` — 提出物テーブル
- `AdDisplay.tsx` / `MobileAdArea.tsx` — 広告表示（画像/動画ローテーション）
- `CalendarModal.tsx` — カレンダーモーダル

## Cloud Functions

| カテゴリ | 関数 |
|---|---|
| 学校管理 | `createSchool`, `listSchools`, `updateSchool`, `deleteSchool` |
| 学年管理 | `createGrade`, `listGrades`, `updateGrade`, `deleteGrade` |
| クラス管理 | `createClass`, `listClasses`, `updateClass`, `deleteClass` |
| メンバー管理 | `inviteMember`, `updateMembership`, `removeMember`, `listMembers`, `getMyMemberships` |
| ユーザー管理 | `listUsers`, `createAdminUser`, `setAdminRole`, `updateUser`, `deleteUser`, `toggleUserStatus`, `setEmailVerified` |
| エディター認証 | `loginAsEditor`, `setEditorPassword` |
| JSON生成トリガー | `onClassDataChange`, `onClassConfigChange` |
| 手動 | `regenerateSignageJson`, `migrateToGradeStructure` |

## 学校ネットワーク対応

### Firestore接続フォールバック

サイネージ表示画面（`useSignageData` hook）はFirestoreへの接続を5秒でテストし、失敗した場合は静的JSONポーリングモードに自動切替（Firebase Storageから3秒間隔でJSON取得）。学校のプロキシやファイアウォールでWebSocket/gRPCがブロックされる環境でも動作します。

### 画像キャッシュ

広告画像をIndexedDBにキャッシュ（`lib/image-cache.ts`）。ネットワーク断でも直前のキャッシュから表示可能。

### 音声自動再生制限

ブラウザの自動再生ポリシーにより、最初のユーザー操作（タップ/クリック）があるまで通知音は再生されません。キオスクモードでは初回タップ後に有効化されます。

## キオスクモード設定（Raspberry Pi等）

```bash
# /home/pi/.config/lxsession/LXDE-pi/autostart
@chromium-browser --kiosk --disable-infobars https://school-signage-2026.web.app/?school=YOUR_SCHOOL&grade=YOUR_GRADE&class=YOUR_CLASS
```

推奨：解像度1920×1080以上、Chromium / Chrome、定期的なキャッシュクリア + リロード。

## テスト手順（デプロイ後の確認）

1. **サイネージ表示** (`/`): 予定・連絡・提出物の表示、広告ローテーション、自動スクロール
2. **エディター** (`/manage/editor`): ログイン、各種CRUD、カレンダー、レスポンシブ
3. **学校管理** (`/manage/admin`): 管理者ログイン、学校 / 学年 / クラス / メンバーの管理
4. **クラス設定** (`/manage/class-settings`): 広告アップロード・削除・並替、静寂時間設定
5. **旧URLリダイレクト**: `/editor.html` → `/manage/editor` 等
6. **モバイル表示**: 幅 < 900px で自動切替
7. **静寂時間**: 授業時間設定時に広告非表示

## トラブルシューティング

- **ログインできない**: Firebase Authentication でユーザーが存在するか、ロール / メンバーシップが付与されているか、ブラウザコンソールのエラーを確認
- **データが表示されない**: `school` / `grade` / `class` URLパラメータが正しいか、Firestoreにデータがあるか、セキュリティルールがデプロイ済みか確認
- **画像がアップロードできない**: Storageルールを確認、ファイルサイズ・形式（image/*）を確認

## 注意事項

- ブランド名は「キミテラス by Rebounder」
- `serviceAccountKey.json` がリポジトリに含まれているため取り扱い注意（公開しないこと）
- デフォルト学校ID: `DEFAULT_SCHOOL_ID = "gn_tech"`

## ライセンス

Proprietary - All rights reserved.

## 開発

Rebounder Team

---

**キミテラス by Rebounder** — 教室をスマートに。
