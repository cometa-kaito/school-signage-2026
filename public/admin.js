// admin.js - データ送信ヘルパー（学校 > 学年 > クラス対応）

import { db, SCHOOL_ID, GRADE_ID, CLASS_ID } from './config.js';
import {
    doc, setDoc, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function submitDataToFirestore(mode) {
    const dateStr = document.getElementById('target-date')?.value;
    if (!dateStr) throw new Error("日付を選択してください");

    const docRef = doc(db, "schools", SCHOOL_ID, "grades", GRADE_ID, "classes", CLASS_ID, "daily_data", dateStr);
    let updateData = { date: dateStr };

    const handlers = {
        schedule: () => {
            const time = document.getElementById('sched-time')?.value || '';
            const content = document.getElementById('sched-content')?.value || '';
            const location = document.getElementById('sched-location')?.value || '';
            if (!content) throw new Error("内容を入力してください");
            return { schedules: arrayUnion({ time, content, location }) };
        },
        notice: () => {
            const text = document.getElementById('notice-text')?.value || '';
            const isHighlight = document.getElementById('notice-highlight')?.checked || false;
            if (!text) throw new Error("内容を入力してください");
            return { notices: arrayUnion({ text, is_highlight: isHighlight }) };
        },
        assignment: () => {
            const deadline = document.getElementById('assign-deadline')?.value || '';
            const subject = document.getElementById('assign-subject')?.value || '';
            const task = document.getElementById('assign-task')?.value || '';
            if (!deadline || !task) throw new Error("期限と提出物を入力してください");
            return { assignments: arrayUnion({ deadline, subject, task }) };
        }
    };

    const handler = handlers[mode];
    if (!handler) throw new Error(`Unknown mode: ${mode}`);
    Object.assign(updateData, handler());

    await setDoc(docRef, updateData, { merge: true });
    document.querySelectorAll('input[type="text"], textarea').forEach(el => { el.value = ''; });
    const cb = document.getElementById('notice-highlight');
    if (cb) cb.checked = false;
}

window.submitDataToFirestore = submitDataToFirestore;
