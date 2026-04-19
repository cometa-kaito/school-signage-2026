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
const users = require('./handlers/users');
const editorAuth = require('./handlers/editor-auth');
const signageJson = require('./handlers/signage-json');
const migration = require('./handlers/migration');

// 学校管理
exports.createSchool = schools.createSchool;
exports.listSchools = schools.listSchools;
exports.listSchoolsPublic = schools.listSchoolsPublic;
exports.updateSchool = schools.updateSchool;
exports.deleteSchool = schools.deleteSchool;
exports.setSchoolHierarchyMode = schools.setSchoolHierarchyMode;

// 学年管理
exports.createGrade = grades.createGrade;
exports.listGrades = grades.listGrades;
exports.updateGrade = grades.updateGrade;
exports.deleteGrade = grades.deleteGrade;

// 学科管理
const departments = require('./handlers/departments');
exports.createDepartment = departments.createDepartment;
exports.listDepartments = departments.listDepartments;
exports.updateDepartment = departments.updateDepartment;
exports.deleteDepartment = departments.deleteDepartment;

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
exports.onDeptClassDataChange = signageJson.onDeptClassDataChange;
exports.onDeptClassConfigChange = signageJson.onDeptClassConfigChange;
exports.regenerateSignageJson = signageJson.regenerateSignageJson;
exports.onSchoolMasterDataChange = signageJson.onSchoolMasterDataChange;
exports.onGradeMasterDataChange = signageJson.onGradeMasterDataChange;
exports.onDeptMasterDataChange = signageJson.onDeptMasterDataChange;
exports.onDeptGradeMasterDataChange = signageJson.onDeptGradeMasterDataChange;

// マスターコンテンツ
const masterContent = require('./handlers/master-content');
exports.copyMasterToClasses = masterContent.copyMasterToClasses;

// 学校詳細一括取得
const schoolDetail = require('./handlers/school-detail');
exports.getSchoolDetail = schoolDetail.getSchoolDetail;

// 管理者ダッシュボード概要
const adminOverview = require('./handlers/admin-overview');
exports.getAdminOverview = adminOverview.getAdminOverview;

// マイグレーション
exports.migrateToGradeStructure = migration.migrateToGradeStructure;

// フィードバック
const feedback = require('./handlers/feedback');
exports.submitFeedback = feedback.submitFeedback;
exports.listFeedback = feedback.listFeedback;
