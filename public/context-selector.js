// context-selector.js - 共通コンテキスト選択コンポーネント（学校→学年→クラス）

import { listSchoolsFn, listGradesFn, listClassesFn, getMyMembershipsFn, auth, isUserAdmin } from './config.js';

const HISTORY_KEY = 'contextHistory';
const MAX_HISTORY = 10;

// ========================================
// 履歴管理
// ========================================

function getHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch { return []; }
}

function saveToHistory(entry) {
    let history = getHistory();
    // 重複除外（同じschool+grade+class）
    history = history.filter(h =>
        !(h.schoolId === entry.schoolId && h.gradeId === entry.gradeId && h.classId === entry.classId)
    );
    history.unshift({ ...entry, timestamp: Date.now() });
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

// ========================================
// コンテキスト選択UI
// ========================================

export async function renderContextSelector(containerId, onSelected) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let schools = [], grades = [], classes = [];
    let selectedSchool = null, selectedGrade = null;

    // ユーザーの権限情報を取得
    const user = auth.currentUser;
    const isAdmin = user ? await isUserAdmin(user) : false;
    let memberships = [];
    let allowedSchoolIds = null; // null = 全学校許可（admin）
    let allowedClassIds = null;  // null = 全クラス許可（admin/school_admin）

    if (!isAdmin && user) {
        try {
            const r = await getMyMembershipsFn();
            memberships = r.data.memberships || [];
        } catch { memberships = []; }

        // エディター（パスワードログイン）の場合、claimsからschoolIdを取得
        if (memberships.length === 0 && user.uid.startsWith('editor_')) {
            const token = await user.getIdTokenResult();
            const schoolId = token.claims.schoolId;
            if (schoolId) {
                memberships = [{ schoolId, role: 'editor', classIds: [] }];
            }
        }

        allowedSchoolIds = memberships.map(m => m.schoolId);
        // teacher/editorはclassIdsで制限（school_adminは全クラス）
        const nonAdminMemberships = memberships.filter(m => m.role !== 'school_admin');
        if (nonAdminMemberships.length > 0 && memberships.every(m => m.role !== 'school_admin')) {
            allowedClassIds = memberships.flatMap(m => m.classIds || []);
        }
    }

    // 学校一覧取得（権限でフィルタ）
    try {
        const r = await listSchoolsFn();
        let allSchools = r.data.schools || [];
        schools = allowedSchoolIds ? allSchools.filter(s => allowedSchoolIds.includes(s.id)) : allSchools;
    } catch (e) {
        container.innerHTML = '<p style="color:red;">学校一覧の取得に失敗しました</p>';
        return;
    }

    // 学校が1つだけの場合は自動選択
    if (schools.length === 1 && !selectedSchool) {
        selectedSchool = schools[0].id;
        try {
            const r = await listGradesFn({ schoolId: selectedSchool });
            grades = r.data.grades || [];
        } catch { grades = []; }
    }

    function render() {
        const history = getHistory();

        const schoolOpts = schools.map(s =>
            `<option value="${s.id}" ${s.id === selectedSchool ? 'selected' : ''}>${s.name || s.id}</option>`
        ).join('');

        const gradeOpts = grades.map(g =>
            `<option value="${g.id}" ${g.id === selectedGrade ? 'selected' : ''}>${g.name}</option>`
        ).join('');

        const classItems = classes.map(c => {
            const origin = window.location.origin;
            return `<div class="context-class-card" data-school="${selectedSchool}" data-grade="${selectedGrade}" data-class="${c.id}" data-class-name="${c.name}" style="background:#f8f9fa;border:2px solid #e9ecef;border-radius:10px;padding:14px 18px;cursor:pointer;transition:all 0.2s;"
                 onmouseenter="this.style.borderColor='#667eea';this.style.boxShadow='0 2px 8px rgba(102,126,234,0.15)'"
                 onmouseleave="this.style.borderColor='#e9ecef';this.style.boxShadow='none'">
                <span style="font-weight:bold;">${c.name}</span>
            </div>`;
        }).join('');

        const historyHtml = history.length > 0 ? `
            <div style="margin-bottom:24px;">
                <h3 style="margin:0 0 10px;font-size:15px;color:#555;">最近の選択</h3>
                <div style="display:flex;flex-wrap:wrap;gap:10px;">
                    ${history.map(h => `
                        <div class="context-history-card" data-school="${h.schoolId}" data-grade="${h.gradeId}" data-class="${h.classId}" style="background:#eef2ff;border:2px solid #c7d2fe;border-radius:10px;padding:10px 16px;cursor:pointer;transition:all 0.2s;min-width:180px;"
                             onmouseenter="this.style.borderColor='#667eea';this.style.boxShadow='0 2px 8px rgba(102,126,234,0.15)'"
                             onmouseleave="this.style.borderColor='#c7d2fe';this.style.boxShadow='none'">
                            <div style="font-weight:bold;font-size:14px;">${h.schoolName} / ${h.gradeName} / ${h.className}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : '';

        container.innerHTML = `
            <div style="max-width:600px;margin:40px auto;padding:0 16px;">
                <h2 style="text-align:center;margin-bottom:24px;color:#333;">クラスを選択してください</h2>
                ${historyHtml}
                <div style="margin-bottom:16px;">
                    <label style="display:block;margin-bottom:4px;font-weight:bold;font-size:14px;">学校</label>
                    <select id="ctx-school" style="width:100%;padding:10px;border-radius:8px;border:1px solid #ddd;font-size:15px;">
                        <option value="">-- 学校を選択 --</option>
                        ${schoolOpts}
                    </select>
                </div>
                <div style="margin-bottom:16px;">
                    <label style="display:block;margin-bottom:4px;font-weight:bold;font-size:14px;">学年</label>
                    <select id="ctx-grade" style="width:100%;padding:10px;border-radius:8px;border:1px solid #ddd;font-size:15px;" ${!selectedSchool ? 'disabled' : ''}>
                        <option value="">-- 学年を選択 --</option>
                        ${gradeOpts}
                    </select>
                </div>
                ${selectedGrade && classes.length > 0 ? `
                    <div>
                        <label style="display:block;margin-bottom:8px;font-weight:bold;font-size:14px;">クラス</label>
                        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;">
                            ${classItems}
                        </div>
                    </div>
                ` : selectedGrade ? '<p style="color:#888;text-align:center;">クラスがありません</p>' : ''}
            </div>
        `;

        // イベント
        document.getElementById('ctx-school')?.addEventListener('change', async (e) => {
            selectedSchool = e.target.value || null;
            selectedGrade = null;
            grades = [];
            classes = [];
            if (selectedSchool) {
                try {
                    const r = await listGradesFn({ schoolId: selectedSchool });
                    grades = r.data.grades || [];
                } catch { grades = []; }
            }
            render();
        });

        document.getElementById('ctx-grade')?.addEventListener('change', async (e) => {
            selectedGrade = e.target.value || null;
            classes = [];
            if (selectedSchool && selectedGrade) {
                try {
                    const r = await listClassesFn({ schoolId: selectedSchool, gradeId: selectedGrade });
                    let allClasses = r.data.classes || [];
                    classes = allowedClassIds ? allClasses.filter(c => allowedClassIds.includes(c.id)) : allClasses;
                } catch { classes = []; }
            }
            render();
        });

        // クラスカードクリック
        container.querySelectorAll('.context-class-card').forEach(card => {
            card.addEventListener('click', () => {
                const schoolId = card.dataset.school;
                const gradeId = card.dataset.grade;
                const classId = card.dataset.class;
                const school = schools.find(s => s.id === schoolId);
                const grade = grades.find(g => g.id === gradeId);
                saveToHistory({
                    schoolId, gradeId, classId,
                    schoolName: school?.name || schoolId,
                    gradeName: grade?.name || gradeId,
                    className: card.dataset.className
                });
                onSelected(schoolId, gradeId, classId);
            });
        });

        // 履歴カードクリック
        container.querySelectorAll('.context-history-card').forEach(card => {
            card.addEventListener('click', () => {
                const { school, grade } = card.dataset;
                const classId = card.dataset.class;
                onSelected(school, grade, classId);
            });
        });
    }

    render();
}

// ========================================
// パラメータチェック
// ========================================

export function hasFullContext() {
    const params = new URLSearchParams(window.location.search);
    return !!(params.get('school') && params.get('grade') && params.get('class'));
}

export function redirectWithContext(schoolId, gradeId, classId) {
    const url = new URL(window.location.href);
    url.searchParams.set('school', schoolId);
    url.searchParams.set('grade', gradeId);
    url.searchParams.set('class', classId);
    window.location.href = url.toString();
}
