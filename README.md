# School Signage (キミテラス by Rebounder)

学校・教室向けデジタルサイネージシステム。予定、連絡事項、提出物、広告をリアルタイムで表示・管理できます。

## 🎯 概要

このシステムは、教室に設置されたディスプレイに学校情報を表示するためのWebアプリケーションです。Firebase を使用したリアルタイム同期により、管理者が更新した情報は即座にサイネージ画面に反映されます。

### 主な機能

- 📅 **今後3日間の予定表示**（土日を自動スキップ）
- 📢 **各種連絡事項**（重要マーク対応）
- ⚠️ **提出物管理**（期限切れ警告、残り日数表示）
- 🖼️ **広告ローテーション**（最大5枚、表示時間設定可能）
- 🔔 **更新通知**（音声通知 + 視覚的バナー）
- 🔇 **授業時間モード**（Quiet Hours: 音声・広告の自動無効化）
- 📱 **自動スクロール**（コンテンツが多い場合に自動でスクロール）
- 🖥️ **キオスクモード対応**（自動起動用）

## 🏗️ システム構成

```
signage/
├── public/                    # フロントエンド（Firebase Hosting）
│   ├── index.html            # サイネージ表示画面
│   ├── dashboard.html        # 管理者ダッシュボード
│   ├── admin.html            # 管理者設定（ユーザー管理等）
│   ├── main.js               # サイネージ表示ロジック
│   ├── dashboard.js          # ダッシュボードロジック
│   ├── config.js             # Firebase設定 & 認証ヘルパー
│   ├── auth.js               # 認証UIコンポーネント
│   ├── ui.js                 # UI描画ヘルパー
│   ├── utils.js              # 共通ユーティリティ
│   └── *.css                 # スタイルシート
├── functions/                 # Firebase Cloud Functions
│   └── index.js              # ユーザー管理API
├── firebase.json              # Firebase設定
├── firestore.rules           # Firestoreセキュリティルール
├── storage.rules             # Storageセキュリティルール
└── setup-admin.js            # 初期管理者セットアップスクリプト
```

## 🔧 技術スタック

| 区分 | 技術 |
|------|------|
| フロントエンド | Vanilla JavaScript (ES Modules) |
| バックエンド | Firebase Cloud Functions (Node.js 20) |
| データベース | Cloud Firestore |
| ファイル保存 | Cloud Storage |
| 認証 | Firebase Authentication |
| ホスティング | Firebase Hosting |

## 📦 セットアップ

### 前提条件

- Node.js 20以上
- Firebase CLI (`npm install -g firebase-tools`)
- Firebaseプロジェクト

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd signage
```

### 2. 依存関係のインストール

```bash
npm install
cd functions && npm install && cd ..
```

### 3. Firebase設定

```bash
# Firebaseにログイン
firebase login

# プロジェクトを選択/作成
firebase use --add
```

### 4. Firebase設定の更新

`public/config.js` と `public/main.js` の `firebaseConfig` を自分のプロジェクトの設定に更新してください：

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 5. 初期管理者の作成

`serviceAccountKey.json` を Firebase Console からダウンロードし、プロジェクトルートに配置。

```bash
# setup-admin.js を編集して管理者情報を設定後
node setup-admin.js
```

### 6. デプロイ

```bash
# すべてをデプロイ
firebase deploy

# 個別にデプロイ
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

## 📱 使い方

### サイネージ画面（表示用）

- **URL**: `https://YOUR_PROJECT.web.app/`
- 認証不要で閲覧可能
- 起動時に5秒のカウントダウン（タップでスキップ可能）
- キオスクモード: `?kiosk=1` または `?autostart=1` を付与

### 管理者ダッシュボード

- **URL**: `https://YOUR_PROJECT.web.app/dashboard.html`
- 管理者認証必須（メール/パスワード または Google）
- 各項目をクリックで編集、「+ 追加」で新規作成

### 管理できる項目

| 項目 | 説明 |
|------|------|
| クラス名 | 画面右上に表示される名前 |
| 予定 | 日時と内容、表示期間を設定可能 |
| 連絡事項 | テキストと重要フラグ |
| 提出物 | 期限、科目、提出物名 |
| 広告画像 | 最大5枚、ローテーション表示 |

## 🗄️ データ構造

### Firestore

```
schools/
└── {SCHOOL_ID}/
    ├── config/
    │   └── display_settings    # クラス名、広告、授業時間設定
    └── daily_data/
        └── {YYYY-MM-DD}/       # 日付ごとのデータ
            ├── schedules[]     # 予定リスト
            ├── notices[]       # 連絡リスト
            └── assignments[]   # 提出物リスト
```

### display_settings ドキュメント

```javascript
{
  class_name: "1年A組",
  ads: [
    { id: "ad_xxx", type: "image", url: "...", duration_sec: 10 }
  ],
  quiet_hours: [
    { start: "08:50", end: "09:40" },  // 1限
    { start: "09:50", end: "10:40" }   // 2限
    // ...
  ]
}
```

### daily_data ドキュメント

```javascript
{
  date: "2025-01-20",
  schedules: [
    { time: "1限", content: "数学テスト", display_start: "", display_end: "" }
  ],
  notices: [
    { text: "明日は体育祭です", is_highlight: true }
  ],
  assignments: [
    { deadline: "2025-01-25", subject: "国語", task: "読書感想文" }
  ]
}
```

## 🔒 セキュリティ

### 認証・権限

- **サイネージ画面**: 認証不要（公開コンテンツ）
- **管理画面**: 管理者権限（Custom Claims: `admin: true`）が必須
- **Cloud Functions**: 管理者のみ実行可能

### Firestoreルール概要

| コレクション | 読み取り | 書き込み |
|--------------|----------|----------|
| schools/{id}/config/* | 全員 | 認証済み管理者 |
| schools/{id}/daily_data/* | 全員 | 認証済み管理者 |
| settings/* | 管理者 | 管理者 |
| users/* | 本人 or 管理者 | 管理者 |

### Storageルール概要

- `/images/**`, `/videos/**`, `/media/**`: 読み取り公開、アップロードは管理者のみ
- ファイルサイズ制限: 画像50MB、動画100MB
- `/private/**`: 管理者のみアクセス可能

## 🛠️ Cloud Functions

| 関数名 | 説明 |
|--------|------|
| `listUsers` | ユーザー一覧取得 |
| `createAdminUser` | ユーザー作成 |
| `setAdminRole` | 管理者権限の付与/削除 |
| `updateUser` | ユーザー情報更新 |
| `deleteUser` | ユーザー削除 |
| `toggleUserStatus` | ユーザーの有効/無効切替 |
| `setEmailVerified` | メール検証ステータス更新 |

## 🖥️ キオスクモード設定（Raspberry Pi等）

### Chromiumでの自動起動例

```bash
# /home/pi/.config/lxsession/LXDE-pi/autostart
@chromium-browser --kiosk --disable-infobars https://YOUR_PROJECT.web.app/?kiosk=1
```

### 推奨設定

- 画面解像度: 1920×1080（フルHD）以上
- ブラウザ: Chromium / Chrome
- 自動更新: ブラウザのキャッシュクリア + リロードを定期実行

## 🔊 音声通知について

- **ブラウザ制約**: 初回ユーザー操作前は音声再生がブロックされる場合があります
- **起動画面**: タップすることでAudioContextが有効化されます
- **キオスクモード**: 自動起動の場合、音声が無効になることがあります
- **画面右下**: 🔊/🔇 アイコンで音声状態を確認可能

## ⚙️ カスタマイズ

### 学校IDの変更

`public/config.js` の `SCHOOL_ID` を変更：

```javascript
export const SCHOOL_ID = "your_school_id";
```

### スタイルの変更

- `public/style.css`: サイネージ画面のスタイル
- `public/dashboard-style.css`: ダッシュボードのスタイル
- `public/auth-style.css`: ログイン画面のスタイル

### 授業時間（Quiet Hours）の設定

管理画面から、または Firestore で直接 `display_settings.quiet_hours` を編集：

```javascript
quiet_hours: [
  { start: "08:50", end: "09:40" },  // 1限
  { start: "09:50", end: "10:40" },  // 2限
  // 必要に応じて追加
]
```

## 🐛 トラブルシューティング

### ログインできない

1. Firebase Authentication でユーザーが作成されているか確認
2. Custom Claims に `admin: true` が設定されているか確認
3. ブラウザのコンソールでエラーを確認

### データが表示されない

1. Firestore にデータが存在するか確認
2. `SCHOOL_ID` が正しいか確認
3. セキュリティルールがデプロイされているか確認

### 画像がアップロードできない

1. Storage のセキュリティルールを確認
2. ファイルサイズが50MB以下か確認
3. ファイル形式が画像（image/*）か確認

## 📄 ライセンス

Proprietary - All rights reserved.

## 👥 開発

Rebounder Team

---

**キミテラス by Rebounder** - 教室をスマートに。