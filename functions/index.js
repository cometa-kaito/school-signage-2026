/**
 * functions/index.js
 * マルチテナント対応 Cloud Functions エントリーポイント
 * 階層: 学校 > 学年 > クラス > daily_data
 */

const admin = require('firebase-admin');
admin.initializeApp();

// ========================================
// ハンドラーの読み込みとエクスポート
// ========================================

const schools = require('./handlers/schools');
const grades = require('./handlers/grades');
const classes = require('./handlers/classes');
const members = require('./handlers/members');
const devices = require('./handlers/devices');
const users = require('./handlers/users');
const editorAuth = require('./handlers/editor-auth');
const signageJson = require('./handlers/signage-json');
const migration = require('./handlers/migration');

// 学校管理
exports.createSchool = schools.createSchool;
exports.listSchools = schools.listSchools;
exports.updateSchool = schools.updateSchool;
exports.deleteSchool = schools.deleteSchool;

// 学年管理
exports.createGrade = grades.createGrade;
exports.listGrades = grades.listGrades;
exports.updateGrade = grades.updateGrade;
exports.deleteGrade = grades.deleteGrade;

// クラス管理
exports.createClass = classes.createClass;
exports.listClasses = classes.listClasses;
exports.updateClass = classes.updateClass;
exports.deleteClass = classes.deleteClass;

// メンバーシップ管理
exports.inviteMember = members.inviteMember;
exports.updateMembership = members.updateMembership;
exports.removeMember = members.removeMember;
exports.listMembers = members.listMembers;
exports.getMyMemberships = members.getMyMemberships;

// デバイス認証
exports.registerDevice = devices.registerDevice;
exports.authenticateDevice = devices.authenticateDevice;
exports.listDevices = devices.listDevices;
exports.revokeDeviceToken = devices.revokeDeviceToken;
exports.removeDevice = devices.removeDevice;

// ユーザー管理
exports.listUsers = users.listUsers;
exports.createAdminUser = users.createAdminUser;
exports.setAdminRole = users.setAdminRole;
exports.updateUser = users.updateUser;
exports.deleteUser = users.deleteUser;
exports.toggleUserStatus = users.toggleUserStatus;
exports.setEmailVerified = users.setEmailVerified;

// エディター認証
exports.loginAsEditor = editorAuth.loginAsEditor;
exports.setEditorPassword = editorAuth.setEditorPassword;

// サイネージデータJSON生成
exports.onClassDataChange = signageJson.onClassDataChange;
exports.onClassConfigChange = signageJson.onClassConfigChange;
exports.regenerateSignageJson = signageJson.regenerateSignageJson;

// マイグレーション
exports.migrateToGradeStructure = migration.migrateToGradeStructure;
