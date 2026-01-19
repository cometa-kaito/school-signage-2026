// main.js - サイネージ表示用メインスクリプト

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    collection, 
    query, 
    where, 
    orderBy, 
    limit, 
    onSnapshot, 
    writeBatch 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { 
    getTodayString, 
    DAYS_JP, 
    startClock, 
    formatDateKey, 
    calculateDaysLeft,
    getDateOffset
} from './utils.js';

// Firebase設定
const firebaseConfig = {
    apiKey: "AIzaSyAp7saZyxtWOtaus2dL_QN5jiJjdwRd1pg",
    authDomain: "school-signage-2026.firebaseapp.com",
    projectId: "school-signage-2026",
    storageBucket: "school-signage-2026.firebasestorage.app",
    messagingSenderId: "1068967206228",
    appId: "1:1068967206228:web:14d24f8881a5cd1a0b3cc1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const SCHOOL_ID = "gn_tech";

// アプリデータ
const appData = {
    schoolName: "ロード中...",
    className: "",
    date: getTodayString(),
    weeklySchedules: {},
    notices: [],
    assignments: [],
    ads: [],
    quietHours: []  // 授業時間（音声・広告無効化時間）
};

// 広告ローテーション管理
let currentAdIndex = 0;
let adTimer = null;

// 通知音管理
let audioContext = null;
let isInitialLoad = true;  // 初回ロード中フラグ
let pendingUpdates = 0;    // 初回ロード完了待ちカウンター

/**
 * 現在が授業時間（Quiet Hours）内かどうかをチェック
 * @returns {boolean}
 */
function isQuietTime() {
    if (!appData.quietHours || appData.quietHours.length === 0) {
        return false;
    }
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    for (const period of appData.quietHours) {
        if (!period.start || !period.end) continue;
        
        const [startH, startM] = period.start.split(':').map(Number);
        const [endH, endM] = period.end.split(':').map(Number);
        
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        
        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
            return true;
        }
    }
    
    return false;
}

/**
 * 起動画面を表示
 */
function showStartupScreen() {
    const overlay = document.createElement('div');
    overlay.id = 'startup-overlay';
    overlay.innerHTML = `
        <div class="startup-content">
            <div class="startup-icon">📺</div>
            <h1>起動中</h1>
            <div class="startup-countdown"><span id="countdown">5</span></div>
            <p class="startup-hint">タップで今すぐ開始</p>
        </div>
    `;
    document.body.appendChild(overlay);

    // カウントダウン
    let remaining = 5;
    const countdownEl = overlay.querySelector('#countdown');
    const countdownTimer = setInterval(() => {
        remaining--;
        if (countdownEl) countdownEl.textContent = remaining;
        if (remaining <= 0) {
            clearInterval(countdownTimer);
            startSignage();
        }
    }, 1000);

    // タップで即座に起動
    const handleTap = (e) => {
        e.preventDefault();
        clearInterval(countdownTimer);
        startSignage();
    };
    
    overlay.addEventListener('click', handleTap);
    overlay.addEventListener('touchstart', handleTap, { passive: false });
}

/**
 * サイネージを開始
 */
function startSignage() {
    // AudioContext初期化を試みる（ブラウザ設定次第で成功する）
    initAudioContext();
    
    // テスト音を再生（有効化されていれば鳴る）
    playTestSound();
    
    // 起動画面を削除
    const overlay = document.getElementById('startup-overlay');
    if (overlay) {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 500);
    }
    
    // 音声状態を表示
    showAudioStatus();
    
    // 後からでもタップで音声を有効化できるようにする
    setupLateAudioEnable();
}

/**
 * 音声状態を画面に表示（デバッグ用）
 */
function showAudioStatus() {
    const status = document.createElement('div');
    status.id = 'audio-status';
    
    const state = audioContext ? audioContext.state : 'no context';
    const isEnabled = audioContext && audioContext.state === 'running';
    
    status.innerHTML = isEnabled 
        ? '🔊 音声ON' 
        : '🔇 音声OFF（タップで有効化）';
    status.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        background: ${isEnabled ? 'rgba(46, 204, 113, 0.9)' : 'rgba(231, 76, 60, 0.9)'};
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        z-index: 9999;
        cursor: pointer;
        transition: all 0.3s;
    `;
    
    // クリックで音声有効化を試みる
    status.addEventListener('click', () => {
        initAudioContext();
        playTestSound();
        updateAudioStatus();
    });
    
    document.body.appendChild(status);
}

/**
 * 音声状態表示を更新
 */
function updateAudioStatus() {
    const status = document.getElementById('audio-status');
    if (!status) return;
    
    const isEnabled = audioContext && audioContext.state === 'running';
    status.innerHTML = isEnabled 
        ? '🔊 音声ON' 
        : '🔇 音声OFF（タップで有効化）';
    status.style.background = isEnabled 
        ? 'rgba(46, 204, 113, 0.9)' 
        : 'rgba(231, 76, 60, 0.9)';
}

/**
 * 後から音声を有効化するためのリスナーを設定
 */
function setupLateAudioEnable() {
    const enableAudio = () => {
        if (!audioContext || audioContext.state === 'suspended') {
            initAudioContext();
            // 有効化されたら確認音
            if (audioContext && audioContext.state === 'running') {
                playTestSound();
                updateAudioStatus();
            }
        }
    };
    
    document.addEventListener('click', enableAudio);
    document.addEventListener('touchstart', enableAudio);
}

/**
 * AudioContextを初期化
 */
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

/**
 * テスト音（起動確認用）
 */
function playTestSound() {
    if (!audioContext) return;
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);
    } catch (e) {
        console.warn('テスト音の再生に失敗:', e);
    }
}

/**
 * 通知音を再生（Web Audio API使用）
 */
function playNotificationSound() {
    // 初回ロード中は鳴らさない
    if (isInitialLoad) return;
    
    // 更新通知バナーを表示（音声が無効でも表示）
    showUpdateBanner();
    
    // 授業時間中は音を鳴らさない
    if (isQuietTime()) {
        console.log('授業時間中のため通知音をスキップ');
        return;
    }
    
    // AudioContextがなければ音は鳴らさない（バナーのみ）
    if (!audioContext || audioContext.state === 'suspended') {
        return;
    }

    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // 2段階の音（ピンポン風）
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(830, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(1046, audioContext.currentTime + 0.15);

        // 音量エンベロープ
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        console.warn('通知音の再生に失敗:', e);
    }
}

/**
 * 初回ロード完了をマーク
 */
function markInitialLoadComplete() {
    pendingUpdates--;
    if (pendingUpdates <= 0) {
        // 少し遅延させて、初回データが全て揃ってからフラグを切り替え
        setTimeout(() => {
            isInitialLoad = false;
        }, 1000);
    }
}

/**
 * 更新通知バナーを表示
 */
function showUpdateBanner() {
    let banner = document.getElementById('update-banner');
    
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'update-banner';
        banner.innerHTML = '🔔 情報が更新されました';
        document.body.appendChild(banner);
    }

    // 既に表示中なら一度リセット
    banner.classList.remove('show');
    
    // 強制リフロー
    void banner.offsetWidth;
    
    banner.classList.add('show');
    
    setTimeout(() => {
        banner.classList.remove('show');
    }, 3000);
}

// DOM読み込み完了時の処理
document.addEventListener('DOMContentLoaded', () => {
    // 時計を開始
    startClock('current-time');
    
    // URLパラメータをチェック（キオスクモード）
    const urlParams = new URLSearchParams(window.location.search);
    const isKioskMode = urlParams.get('kiosk') === '1' || urlParams.get('autostart') === '1';
    
    if (isKioskMode) {
        // キオスクモード: 起動画面をスキップして即座に開始
        console.log('🖥️ キオスクモードで起動');
        startSignageKiosk();
    } else {
        // 通常モード: 起動画面を表示
        showStartupScreen();
    }
    
    // データ監視を開始（起動画面の裏で先にデータを取得）
    startRealtimeListeners();
    
    // ウィンドウリサイズ時に高さを再調整
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            adjustScrollAreas();
            stopAutoScroll();
            setTimeout(() => startAutoScroll(), 500);
        }, 250);
    });
});

/**
 * キオスクモード用のサイネージ開始
 * 起動画面なし、音声状態表示は自動で消える
 */
function startSignageKiosk() {
    // AudioContext初期化
    initAudioContext();
    
    // テスト音（小さめ）
    playTestSound();
    
    // 音声状態を一時的に表示（5秒後に自動で消える）
    showAudioStatusKiosk();
    
    // 後からでもタップで音声を有効化できるようにする
    setupLateAudioEnable();
}

/**
 * キオスクモード用の音声状態表示（自動で消える）
 */
function showAudioStatusKiosk() {
    const status = document.createElement('div');
    status.id = 'audio-status';
    
    const isEnabled = audioContext && audioContext.state === 'running';
    
    status.innerHTML = isEnabled 
        ? '🔊 音声ON' 
        : '🔇 音声OFF';
    
    const bgColor = isEnabled ? 'rgba(46, 204, 113, 0.9)' : 'rgba(231, 76, 60, 0.9)';
    status.style.cssText = 'position: fixed; bottom: 10px; right: 10px; background: ' + bgColor + '; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; z-index: 9999; transition: all 0.5s;';
    
    document.body.appendChild(status);
    
    // 5秒後に自動で消える
    setTimeout(function() {
        status.style.opacity = '0';
        setTimeout(function() { status.remove(); }, 500);
    }, 5000);
}

/**
 * Firestoreリアルタイム監視を開始
 */
function startRealtimeListeners() {
    const todayStr = getTodayString();
    
    // 2つのリスナーがあるので、両方の初回ロードを待つ
    pendingUpdates = 2;

    // 設定・広告の監視
    const configRef = doc(db, "schools", SCHOOL_ID, "config", "display_settings");
    onSnapshot(configRef, (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            appData.schoolName = data.school_name || "School Name";
            appData.className = data.class_name || "";
            appData.ads = data.ads || [];
            appData.quietHours = data.quiet_hours || [];
            
            updateUI();
            restartAdRotation();
            updateAdAreaVisibility();
            
            // 初回以降は通知音を再生
            if (!isInitialLoad) {
                playNotificationSound();
            } else {
                markInitialLoadComplete();
            }
        } else {
            // ドキュメントが存在しない場合も初回ロード完了とする
            markInitialLoadComplete();
        }
    }, (error) => {
        console.error('設定の監視エラー:', error);
        markInitialLoadComplete();
    });

    // 日次データの監視（5日前から3日後まで - 提出物表示用）
    const dailyRef = collection(db, "schools", SCHOOL_ID, "daily_data");
    
    // 5日前の日付を計算
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const fiveDaysAgoStr = formatDateKey(fiveDaysAgo);
    
    const q = query(
        dailyRef, 
        where("date", ">=", fiveDaysAgoStr),
        orderBy("date", "asc"),
        limit(10)
    );

    onSnapshot(q, (snapshot) => {
        appData.weeklySchedules = {};
        appData.notices = [];
        appData.assignments = [];

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const dateKey = data.date;

            // スケジュール: 今日以降3日分のみ
            if (dateKey >= todayStr && data.schedules) {
                appData.weeklySchedules[dateKey] = data.schedules;
            }

            // 連絡: 今日のみ
            if (dateKey === todayStr) {
                appData.notices = data.notices || [];
            }
            
            // 提出物: 全ての日付から集める（後でフィルタ）
            if (data.assignments && data.assignments.length > 0) {
                appData.assignments = appData.assignments.concat(data.assignments);
            }
        });
        
        // 提出物を期限でソート
        appData.assignments.sort((a, b) => {
            return new Date(a.deadline) - new Date(b.deadline);
        });

        updateUI();
        
        // 初回以降は通知音を再生
        if (!isInitialLoad) {
            playNotificationSound();
        } else {
            markInitialLoadComplete();
        }
    }, (error) => {
        console.error('日次データの監視エラー:', error);
        markInitialLoadComplete();
    });
}

/**
 * UI全体を更新
 */
function updateUI() {
    renderHeader();
    renderSchedules();
    renderNotices();
    renderAssignments();
    
    // DOMの更新後に高さを調整してからスクロール開始
    requestAnimationFrame(() => {
        adjustScrollAreas();
        setTimeout(() => {
            startAutoScroll();
        }, 300);
    });
}

/**
 * スクロール領域の高さを調整
 */
function adjustScrollAreas() {
    // 連絡リストの高さ調整
    const noticeSection = document.querySelector('.notice-section');
    const noticeList = document.getElementById('notice-list');
    if (noticeSection && noticeList) {
        const header = noticeSection.querySelector('h2');
        const headerHeight = header ? header.offsetHeight : 0;
        const padding = 20; // カードのパディング分
        const availableHeight = noticeSection.offsetHeight - headerHeight - padding;
        if (availableHeight > 50) {
            noticeList.style.maxHeight = availableHeight + 'px';
        }
    }
    
    // 提出物テーブルの高さ調整
    const assignmentSection = document.querySelector('.assignment-section');
    const tableWrapper = document.querySelector('.table-wrapper');
    if (assignmentSection && tableWrapper) {
        const header = assignmentSection.querySelector('h2');
        const headerHeight = header ? header.offsetHeight : 0;
        const padding = 20;
        const availableHeight = assignmentSection.offsetHeight - headerHeight - padding;
        if (availableHeight > 50) {
            tableWrapper.style.maxHeight = availableHeight + 'px';
        }
    }
    
    // スケジュール各列の高さ調整
    document.querySelectorAll('.schedule-day-column').forEach(column => {
        const scrollArea = column.querySelector('.schedule-scroll-area');
        const dateHeader = column.querySelector('.schedule-date-header');
        if (scrollArea && dateHeader) {
            const headerHeight = dateHeader.offsetHeight;
            const padding = 15;
            const availableHeight = column.offsetHeight - headerHeight - padding;
            if (availableHeight > 30) {
                scrollArea.style.maxHeight = availableHeight + 'px';
            }
        }
    });
    
    console.log('高さ調整完了');
}

/**
 * ヘッダー部分を描画
 */
function renderHeader() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const date = today.getDate();
    const day = DAYS_JP[today.getDay()];

    document.getElementById('current-date').textContent = `${month}月${date}日`;
    document.getElementById('current-day').textContent = `(${day})`;
    document.getElementById('class-name').textContent = appData.className;
}

/**
 * 予定セクションを描画
 * 土日をスキップして平日のみ3日分表示
 */
function renderSchedules() {
    const container = document.getElementById('schedule-grid');
    container.innerHTML = '';

    let displayedCount = 0;  // 表示した日数
    let dayOffset = 0;       // 今日からの日数オフセット

    while (displayedCount < 3) {
        const targetDate = getDateOffset(dayOffset);
        const dayOfWeek = targetDate.getDay();
        
        // 土日（0=日曜, 6=土曜）をスキップ
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            dayOffset++;
            continue;
        }

        const dateKey = formatDateKey(targetDate);
        const dayStr = DAYS_JP[dayOfWeek];
        const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
        const dd = String(targetDate.getDate()).padStart(2, '0');
        const displayDate = `${mm}/${dd} (${dayStr})`;

        const schedules = appData.weeklySchedules[dateKey] || [];
        const scheduleHtml = schedules.length > 0
            ? schedules.map(item => `
                <div class="schedule-list-item">
                    <span class="schedule-time">${item.time}</span>
                    <span class="schedule-content">${item.content}</span>
                </div>
            `).join('')
            : '<div class="no-schedule">予定なし</div>';

        const isToday = dayOffset === 0;
        const columnHtml = `
            <div class="schedule-day-column ${isToday ? 'is-today' : ''}">
                <div class="schedule-date-header">${displayDate}</div>
                <div class="schedule-scroll-area" data-autoscroll="true">${scheduleHtml}</div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', columnHtml);
        
        displayedCount++;
        dayOffset++;
    }
}

/**
 * 連絡セクションを描画
 */
function renderNotices() {
    const list = document.getElementById('notice-list');
    
    if (appData.notices.length === 0) {
        list.innerHTML = '<li class="no-notice">連絡事項はありません</li>';
        return;
    }

    list.innerHTML = appData.notices.map(item => `
        <li class="${item.is_highlight ? 'highlight' : ''}">
            ${item.is_highlight ? '【重要】' : ''} ${item.text}
        </li>
    `).join('');
}

/**
 * 提出物セクションを描画
 * 期限が5日前以降のものを表示
 */
function renderAssignments() {
    const list = document.getElementById('assignment-list');
    
    // 5日前の日付
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const fiveDaysAgoStr = formatDateKey(fiveDaysAgo);
    
    // 期限が5日前以降の提出物をフィルタ
    const filteredAssignments = appData.assignments.filter(item => {
        return item.deadline >= fiveDaysAgoStr;
    });

    if (filteredAssignments.length === 0) {
        list.innerHTML = '<tr><td colspan="3" class="no-assignment">提出物はありません</td></tr>';
        return;
    }

    list.innerHTML = filteredAssignments.map(item => {
        const { text, cssClass, days } = calculateDaysLeft(item.deadline);
        // 期限切れの場合は行に特別なクラスを追加
        const rowClass = days < 0 ? 'overdue-row' : '';
        return `
            <tr class="${rowClass}">
                <td>
                    ${item.deadline.slice(5)}
                    <br><span class="${cssClass}">${text}</span>
                </td>
                <td>${item.subject}</td>
                <td>${item.task}</td>
            </tr>
        `;
    }).join('');
}

/**
 * 広告ローテーションを再開始
 */
function restartAdRotation() {
    if (adTimer) {
        clearTimeout(adTimer);
    }
    
    if (!appData.ads || appData.ads.length === 0) {
        return;
    }
    
    currentAdIndex = 0;
    showAd();
}

/**
 * 広告を表示
 */
function showAd() {
    const imgEl = document.getElementById('ad-image');
    const adArea = document.querySelector('.ad-area');
    
    // 授業時間中は広告を非表示
    if (isQuietTime()) {
        if (imgEl) imgEl.style.display = 'none';
        if (adArea) adArea.classList.add('quiet-mode');
        // 次のチェックのためにタイマーを設定
        adTimer = setTimeout(showAd, 60000); // 1分ごとにチェック
        return;
    }
    
    // 通常表示
    if (imgEl) imgEl.style.display = '';
    if (adArea) adArea.classList.remove('quiet-mode');
    
    if (appData.ads.length === 0) {
        return;
    }

    const ad = appData.ads[currentAdIndex];
    imgEl.src = ad.url;
    
    currentAdIndex = (currentAdIndex + 1) % appData.ads.length;
    const duration = (ad.duration_sec || 5) * 1000;
    adTimer = setTimeout(showAd, duration);
}

/**
 * 広告エリアの表示/非表示を更新
 */
function updateAdAreaVisibility() {
    const adArea = document.querySelector('.ad-area');
    const imgEl = document.getElementById('ad-image');
    
    if (isQuietTime()) {
        if (imgEl) imgEl.style.display = 'none';
        if (adArea) adArea.classList.add('quiet-mode');
    } else {
        if (imgEl) imgEl.style.display = '';
        if (adArea) adArea.classList.remove('quiet-mode');
    }
}

// ========================================
// 自動スクロール機能
// ========================================
const autoScrollers = new Map();
const USER_PAUSE_DURATION = 5000;

/**
 * 自動スクロールを開始
 */
function startAutoScroll() {
    // 既存のスクローラーを停止
    stopAutoScroll();
    
    // スクロール対象の要素を収集
    const scrollTargets = [
        ...document.querySelectorAll('.schedule-scroll-area'),
        document.getElementById('notice-list'),
        document.querySelector('.table-wrapper')
    ].filter(el => el);
    
    console.log('自動スクロール対象:', scrollTargets.length, '個');
    
    scrollTargets.forEach((el, i) => {
        const overflow = el.scrollHeight - el.clientHeight;
        console.log(`要素${i}: scrollHeight=${el.scrollHeight}, clientHeight=${el.clientHeight}, overflow=${overflow}`);
        
        const scroller = new AutoScroller(el, 25);
        autoScrollers.set(el, scroller);
        scroller.start();
    });
}

/**
 * 自動スクロールを停止
 */
function stopAutoScroll() {
    autoScrollers.forEach(scroller => scroller.destroy());
    autoScrollers.clear();
}

/**
 * 自動スクローラークラス
 */
class AutoScroller {
    constructor(element, pixelsPerSecond = 25) {
        this.element = element;
        this.speed = pixelsPerSecond;
        this.animationId = null;
        this.timeoutId = null;
        this.direction = 1;
        this.isPaused = false;
        this.isUserPaused = false;
        this.lastTime = 0;
        this.pauseAtEnds = 2500;
        this.startDelay = 2000;
        
        this.handleUserInteraction = this.handleUserInteraction.bind(this);
        this.element.addEventListener('mousedown', this.handleUserInteraction);
        this.element.addEventListener('touchstart', this.handleUserInteraction, { passive: true });
        this.element.addEventListener('wheel', this.handleUserInteraction, { passive: true });
    }
    
    handleUserInteraction() {
        console.log('ユーザー操作検出 - 一時停止');
        this.pauseForUser();
    }
    
    pauseForUser() {
        this.isUserPaused = true;
        this.pause();
        
        if (this.timeoutId) clearTimeout(this.timeoutId);
        this.timeoutId = setTimeout(() => {
            this.isUserPaused = false;
            console.log('自動スクロール再開');
            this.resume();
        }, USER_PAUSE_DURATION);
    }
    
    start() {
        console.log('AutoScroller.start() 呼び出し');
        this.timeoutId = setTimeout(() => {
            this.checkAndScroll();
        }, this.startDelay);
    }
    
    pause() {
        this.isPaused = true;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    resume() {
        if (this.isUserPaused) return;
        this.isPaused = false;
        this.checkAndScroll();
    }
    
    destroy() {
        this.pause();
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.element.removeEventListener('mousedown', this.handleUserInteraction);
        this.element.removeEventListener('touchstart', this.handleUserInteraction);
        this.element.removeEventListener('wheel', this.handleUserInteraction);
    }
    
    checkAndScroll() {
        if (this.isPaused || this.isUserPaused) return;
        
        const el = this.element;
        const overflow = el.scrollHeight - el.clientHeight;
        
        console.log('checkAndScroll: overflow =', overflow);
        
        if (overflow <= 3) {
            this.timeoutId = setTimeout(() => this.checkAndScroll(), 3000);
            return;
        }
        
        console.log('スクロール開始');
        this.animate();
    }
    
    animate() {
        if (this.isPaused || this.isUserPaused) return;
        
        const el = this.element;
        const overflow = el.scrollHeight - el.clientHeight;
        
        if (overflow <= 3) {
            this.timeoutId = setTimeout(() => this.checkAndScroll(), 3000);
            return;
        }
        
        this.lastTime = performance.now();
        
        const step = (currentTime) => {
            if (this.isPaused || this.isUserPaused) return;
            
            const deltaTime = (currentTime - this.lastTime) / 1000;
            this.lastTime = currentTime;
            
            const actualSpeed = this.direction === 1 ? this.speed : this.speed * 1.5;
            el.scrollTop += actualSpeed * deltaTime * this.direction;
            
            if (this.direction === 1 && el.scrollTop >= overflow) {
                el.scrollTop = overflow;
                this.direction = -1;
                console.log('下端到達 - 反転');
                this.timeoutId = setTimeout(() => this.animate(), this.pauseAtEnds);
                return;
            }
            
            if (this.direction === -1 && el.scrollTop <= 0) {
                el.scrollTop = 0;
                this.direction = 1;
                console.log('上端到達 - 反転');
                this.timeoutId = setTimeout(() => this.animate(), this.pauseAtEnds);
                return;
            }
            
            this.animationId = requestAnimationFrame(step);
        };
        
        this.animationId = requestAnimationFrame(step);
    }
}