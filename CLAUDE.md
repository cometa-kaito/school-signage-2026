# キミテラス開発ガードレール（Claude Code 用）

このプロジェクトは Firebase（Firestore / Cloud Functions / Auth / Storage / Hosting）を継続利用する。
Firebase は柔軟である一方、**コードと実データ・実権限のズレが実行時まで露見しない**特性があるため、
以下3つの規律を**例外なく**守ること。守らなければ本番で壊れる。

---

## ルール1: `firestore.rules` を変更したら必ず emulator テストを書く

### 適用条件
`firestore.rules` の **1行でも** 編集・追加・削除した場合（コメント・空白の修正は除く）。

### やること
1. `@firebase/rules-unit-testing` を使った Vitest テストを作成または更新する
   - 配置場所: `__tests__/firestore.rules.test.js`（ルート直下、`firestore.rules` と同階層）
   - 未導入なら `npm i -D @firebase/rules-unit-testing vitest` でセットアップ
2. **変更したルールが想定通りに「許可」「拒否」する両方** をテストで証明する
   - 例: `school_admin` は許可される ✅ + `teacher` は拒否される ✅ の両方
3. テスト実行: `firebase emulators:exec --only firestore "npx vitest run firestore.rules.test.js"`
4. PR には emulator テスト結果（pass）を貼る

### NG パターン
- 「ルールだけ変更してテストは後回し」 → **後回しは永遠に来ない**
- 「許可ケースだけテスト」 → 拒否ケースが緩んでいることに気づけない
- ルール変更の影響範囲が分からないとき → 関連する既存ルールのテストを**先に書いてから**変更する（リファクタリングの原則）

### 理由
Firestore セキュリティルールは独自 DSL で型もコンパイル時検証もない。
過去に [firestore.rules](firestore.rules) は RBAC が複雑化しており、
1文字のミスで「全員にデータ漏洩」または「全員から閲覧不能」が起きる構造。

---

## ルール2: 新しいクエリを書いたら `firestore.indexes.json` を確認

### 適用条件
以下のいずれかを **書いた / 変更した** 場合:
- `query()` + `where()` を**2つ以上**組み合わせている
- `where()` + `orderBy()` を組み合わせている
- `where()` + `array-contains` + 他の条件を組み合わせている
- 既存クエリに `where` / `orderBy` を**追加した**

### やること
1. **必要な複合インデックスを `firestore.indexes.json` に追記する**
   - ファイルがなければルートに新規作成し、[firebase.json](firebase.json) の `firestore` セクションに `"indexes": "firestore.indexes.json"` を追加
2. テンプレート:
   ```json
   {
     "indexes": [
       {
         "collectionGroup": "<コレクション名>",
         "queryScope": "COLLECTION",
         "fields": [
           { "fieldPath": "<field1>", "order": "ASCENDING" },
           { "fieldPath": "<field2>", "order": "ASCENDING" }
         ]
       }
     ],
     "fieldOverrides": []
   }
   ```
3. デプロイ前に確認: `npx firebase deploy --only firestore:indexes --dry-run`
4. PR の説明欄に「追加クエリと対応インデックス」を明記

### NG パターン
- 「単一フィールドだから不要」と判断して終わる → `where + orderBy` は別フィールドなら必要
- ローカルの emulator で動いたから OK と判断 → emulator はインデックスを要求しない、本番だけ落ちる
- 「とりあえずデプロイして本番のエラーログから追加」 → 本番ユーザーに `FAILED_PRECONDITION` を見せることになる

### 理由
Firestore は複合インデックスがないと**実行時に**`FAILED_PRECONDITION: requires an index` でクエリが失敗する。
emulator では検出できず、本番初回アクセスで初めて発覚する。
Cloud Console のエラーログにインデックス作成リンクが出るが、それは「事故った後」。

---

## ルール3: 型 (`types/`) と実データの一致を PR ごとに見直す

### 適用条件
以下のいずれかを行った PR:
- `management/src/types/` 配下のファイルを変更した
- Firestore に書き込むコード（`setDoc` / `updateDoc` / `addDoc` / `set` in functions）を変更・追加した
- Cloud Functions で新規ドキュメントを作成・更新するコードを追加した

### やること
1. **書き込み箇所と型定義の差分チェック**
   - 例: `Schedule` 型に `location?: string` を追加 → `setDoc` 側で `location` を書いていない箇所がないか確認
   - 例: `setDoc` で `is_highlight` を書いている → `Notice` 型に同フィールドが定義されているか確認
2. **既存ドキュメントとの後方互換チェック**
   - 新フィールドを追加した場合: 既存ドキュメントには存在しない → `optional (?)` か、読み出し側にデフォルト値を必ず付ける
   - フィールドを削除・リネームした場合: 既存ドキュメントの読み出しが壊れないか確認、必要なら**移行スクリプトを `scripts/` に追加**してから PR を出す
3. **書き込み箇所には型注釈を必ず付ける**
   - ❌ `await setDoc(ref, { ... })` （型推論されないオブジェクトリテラル）
   - ✅ `await setDoc<DailyData>(ref, payload)` または `const payload: DailyData = { ... }`
4. PR 説明欄に「型変更とデータ整合性の確認結果」を明記
   - 後方互換あり/なし、移行スクリプトの要否を明示

### NG パターン
- 型だけ変更して書き込みコードを直さない（または逆）
- `as any` / `as unknown as Foo` で型エラーを揉み消す（**禁止**、根本原因を直す）
- 既存データに新フィールドが「あるはず」で書いて落ちる
- 移行が必要なのに移行スクリプトを書かずにマージする

### 理由
Firestore はスキーマレスなので、**型と実データのズレが本番で初めてバグる**。
Postgres と違って `\d table` で正解を確認する手段がなく、Claude Code が判断材料を持ちにくい。
型を「真実の単一ソース」として扱うルールを敷かないと、コードベースが急速に腐る。

---

## 補足: PR チェックリストへの組み込み

PR を作成するときは、以下を PR 説明欄に必ず記載すること:

```markdown
## Firebase ガードレール確認

- [ ] firestore.rules を変更した → emulator テスト追加・実行済み（または「変更なし」）
- [ ] 新規/変更クエリあり → firestore.indexes.json 更新済み（または「インデックス不要」と理由）
- [ ] 型 or 書き込みコードを変更 → types/ と書き込み箇所の整合性確認済み（または「変更なし」）
```

3つすべて「変更なし」「不要」になる PR もある（ドキュメント修正など）。
**該当する変更があるのに記載がない PR はマージしない。**

---

## 参考: 既存テスト構成

- Functions ユニットテスト: [functions/__tests__/](functions/__tests__/) （Vitest）
- Frontend ユニットテスト: [management/src/lib/__tests__/](management/src/lib/__tests__/) （Vitest）
- Firestore Rules テスト: **未整備** — ルール1の初回適用時にセットアップする
- Firestore インデックス定義: **未整備** — ルール2の初回適用時に作成する
