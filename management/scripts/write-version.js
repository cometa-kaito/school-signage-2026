/*
 * write-version.js — ビルド時にデプロイ識別用の version.json を生成する。
 *
 * Kiosk クライアント（Google TV など）はキャッシュを抱えたまま動き続けるため、
 * デプロイ後にスタイル/JS の更新が反映されないことがある。
 * 各クライアントは public/version.json を定期的に取得し、
 * 起動時に取得した値と異なれば location.reload() する仕組みで自動更新する。
 *
 * 値はビルド時刻（ms）にしているので、毎ビルドで必ず変化する。
 */

const fs = require("fs");
const path = require("path");

const version = `${Date.now()}`;
const out = path.join(__dirname, "..", "public", "version.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ version }) + "\n");
console.log(`[write-version] ${version} -> ${path.relative(process.cwd(), out)}`);
