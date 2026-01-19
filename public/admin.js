// admin.js - 認証対応版（config.jsからインポート）

import { db, SCHOOL_ID } from './config.js';
import { 
    doc, 
    setDoc, 
    arrayUnion 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * データをFirestoreに送信する
 * @param {string} mode - 'schedule' | 'notice' | 'assignment'
 */
async function submitDataToFirestore(mode) {
    const dateStr = document.getElementById('target-date').value;
    if (!dateStr) {
        throw new Error("日付を選択してください");
    }

    const docRef = doc(db, "schools", SCHOOL_ID, "daily_data", dateStr);
    let updateData = {};
    
    if (mode === 'schedule') {
        const time = document.getElementById('sched-time').value;
        const content = document.getElementById('sched-content').value;
        const loc = document.getElementById('sched-location').value;
        if (!content) {
            throw new Error("内容を入力してください");
        }
        updateData = {
            date: dateStr,
            schedules: arrayUnion({ time, content, location: loc })
        };
    } 
    else if (mode === 'notice') {
        const text = document.getElementById('notice-text').value;
        const isHigh = document.getElementById('notice-highlight').checked;
        if (!text) {
            throw new Error("内容を入力してください");
        }
        updateData = {
            date: dateStr,
            notices: arrayUnion({ text, is_highlight: isHigh })
        };
    }
    else if (mode === 'assignment') {
        const deadline = document.getElementById('assign-deadline').value;
        const subject = document.getElementById('assign-subject').value;
        const task = document.getElementById('assign-task').value;
        if (!deadline || !task) {
            throw new Error("期限と提出物を入力してください");
        }
        updateData = {
            date: dateStr,
            assignments: arrayUnion({ deadline, subject, task })
        };
    }

    await setDoc(docRef, updateData, { merge: true });
    
    // フォームクリア
    document.querySelectorAll('input[type="text"], textarea').forEach(el => el.value = '');
    const highlightCheckbox = document.getElementById('notice-highlight');
    if (highlightCheckbox) {
        highlightCheckbox.checked = false;
    }
}

// グローバルに公開
window.submitDataToFirestore = submitDataToFirestore;