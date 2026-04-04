// main.js - サイネージ表示用メインスクリプト

import { db, firebaseConfig, SCHOOL_ID, GRADE_ID, CLASS_ID, getStaticJsonUrl, setSchoolContext, loginAsDevice } from './config.js';
import {
    query,
    where,
    orderBy,
    limit,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    getTodayString,
    DAYS_JP,
    startClock,
    formatDateKey,
    calculateDaysLeft,
    getDateOffset,
    isWeekend,
    debounce
} from './utils.js';
import { ImageCache } from './image-cache.js';
import { classDocRef, dailyDataCollectionRef } from './paths.js';
import { getDaysAgoStr, filterByDisplayRange, filterRecentAssignments } from './data-filter.js';
import { AutoScroller, startAutoScroll as _startAutoScroll, stopAutoScroll as _stopAutoScroll } from './auto-scroller.js';
import { initCalendar as _initCalendar } from './calendar.js';

// ========================================
// 定数
// ========================================

const CONTENT_POLLING_INTERVAL = 3000;   // コンテンツ: 3秒
const IMAGE_POLLING_INTERVAL = 300000;   // 画像: 5分
// USER_PAUSE_DURATION は auto-scroller.js に移動

// ========================================
// アプリ状態
// ========================================

const appData = {
    schoolName: "ロード中...",
    className: "",
    date: getTodayString(),
    weeklySchedules: {},
    notices: [],
    assignments: [],
    ads: [],
    quietHours: []
};

// 広告ローテーション管理
let currentAdIndex = 0;
let adTimer = null;

// 通知音管理
let audioContext = null;
let isInitialLoad = true;
let pendingUpdates = 0;

// データ取得モード
let useStaticJson = false;
let contentPollingTimer = null;
let imagePollingTimer = null;

// 自動スクロール管理
const autoScrollers = new Map();

// 変更検知用ハッシュ
let lastJsonHash = '';
let lastAdsHash = '';

// 前回のnoticeデータ（音通知用）
let previousNoticesHash = '';

// ========================================
// 起動・初期化
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    // ページ読み込み時にスクロールを上部にリセット（複数回実行で確実に）
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // 少し遅延させて再度スクロールリセット（レンダリング完了後）
    setTimeout(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
    }, 100);

    forceLayout();
    updateLayoutMode(); // レイアウトモードを初期化
    startClock('current-time');

    const urlParams = new URLSearchParams(window.location.search);
    const isKioskMode = urlParams.get('kiosk') === '1' || urlParams.get('autostart') === '1';
    const forceStaticJson = urlParams.get('static') === '1';
    const deviceTokenParam = urlParams.get('token');

    // デバイストークンがURLパラメータにある場合はlocalStorageに保存
    if (deviceTokenParam) {
        localStorage.setItem('deviceToken', deviceTokenParam);
        console.log('デバイストークンをURLから取得・保存');
        // トークンをURLから消す（セキュリティ）
        const cleanUrl = new URL(window.location);
        cleanUrl.searchParams.delete('token');
        history.replaceState(null, '', cleanUrl);
    }

    // デバイストークン認証を試行
    const storedDeviceToken = localStorage.getItem('deviceToken');
    if (storedDeviceToken) {
        console.log('デバイストークンで認証中...');
        const authResult = await loginAsDevice(storedDeviceToken);
        if (authResult.success) {
            console.log(`デバイス認証成功: school=${authResult.schoolId}, class=${authResult.classId}`);
        } else {
            console.warn('デバイス認証失敗:', authResult.error);
            // トークンが無効な場合は削除
            localStorage.removeItem('deviceToken');
        }
    }

    if (isKioskMode) {
        console.log('キオスクモードで起動');
        startSignageKiosk();
    } else {
        showStartupScreen();
    }

    if (forceStaticJson) {
        console.log('強制静的JSONモードで起動');
        useStaticJson = true;
        startStaticJsonPolling();
    } else {
        const firestoreAvailable = await testFirestoreConnection();
        if (firestoreAvailable) {
            console.log('Firestoreモードで起動');
            useStaticJson = false;
            startRealtimeListeners();
        } else {
            console.log('静的JSONモードにフォールバック');
            useStaticJson = true;
            startStaticJsonPolling();
        }
    }

    setupResizeHandler();
});

/**
 * リサイズハンドラーを設定
 */
function setupResizeHandler() {
    const handleResize = debounce(() => {
        updateLayoutMode();
        adjustScrollAreas();
        stopAutoScroll();
        setTimeout(() => startAutoScroll(), 500);
    }, 250);

    window.addEventListener('resize', handleResize);
}

/**
 * 画面サイズに応じてレイアウトモードを切り替え
 *
 * レイアウト判定基準:
 * - モバイルモード（縦スクロール、上部広告）:
 *   - スマホ縦画面
 *   - スマホ横画面（幅900px未満）
 *   - 小さめタブレット（幅900px未満）
 * - サイネージモード（2カラム、右側広告）:
 *   - 大きめタブレット以上（幅900px以上）
 */
function updateLayoutMode() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // 幅900px未満はモバイルモード（スマホ縦/横、小さめタブレット）
    // 幅900px以上はサイネージモード（大きめタブレット、PC、サイネージ）
    const isMobileMode = width < 900;

    if (isMobileMode) {
        console.log('モバイルモード:', width, 'x', height);
        document.body.classList.add('vertical-mode');
        // 強制レイアウトを削除
        const existingStyle = document.getElementById('force-layout-style');
        if (existingStyle) {
            existingStyle.remove();
        }
    } else {
        console.log('サイネージモード:', width, 'x', height);
        document.body.classList.remove('vertical-mode');
        // サイネージモードでは強制レイアウトを適用
        forceLayout();
    }
}

// ========================================
// 起動画面
// ========================================

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
    initAudioContext();

    const overlay = document.getElementById('startup-overlay');
    if (overlay) {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 500);
    }

    setupLateAudioEnable();
}

/**
 * キオスクモード用のサイネージ開始
 */
function startSignageKiosk() {
    initAudioContext();
    setupLateAudioEnable();
}

// ========================================
// オーディオ管理
// ========================================

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
 * 通知音を再生
 */
function playNotificationSound() {
    if (isInitialLoad) return;

    if (!audioContext || audioContext.state === 'suspended') {
        return;
    }

    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(830, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(1046, audioContext.currentTime + 0.15);

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        console.warn('通知音の再生に失敗:', e);
    }
}

/**
 * 通知データをチェックして音を再生するか判断
 * play_sound: trueが設定されたnoticeがあり、前回から変化がある場合に音を鳴らす
 */
function checkAndPlayNotificationSound() {
    showUpdateBanner();

    // 現在のnoticesでplay_sound: trueのものをハッシュ化
    const soundNotices = appData.notices.filter(n => n.play_sound === true);
    const currentHash = JSON.stringify(soundNotices.map(n => n.text));

    // 前回と同じなら音を鳴らさない
    if (currentHash === previousNoticesHash) {
        return;
    }

    previousNoticesHash = currentHash;

    // play_sound: trueの通知がある場合のみ音を鳴らす
    if (soundNotices.length > 0) {
        console.log('通知音を再生: play_sound が有効な通知があります');
        playNotificationSound();
    }
}

/**
 * 現在が授業時間（Quiet Hours）内かどうかをチェック
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
 * 後から音声を有効化するためのリスナーを設定
 */
function setupLateAudioEnable() {
    const enableAudio = () => {
        if (!audioContext || audioContext.state === 'suspended') {
            initAudioContext();
            if (audioContext && audioContext.state === 'running') {
                playTestSound();
                updateAudioStatus();
            }
        }
    };

    document.addEventListener('click', enableAudio);
    document.addEventListener('touchstart', enableAudio);
}

// ========================================
// 通知バナー
// ========================================

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

    banner.classList.remove('show');
    void banner.offsetWidth;
    banner.classList.add('show');

    setTimeout(() => {
        banner.classList.remove('show');
    }, 3000);
}

/**
 * 初回ロード完了をマーク
 */
function markInitialLoadComplete() {
    pendingUpdates--;
    if (pendingUpdates <= 0) {
        setTimeout(() => {
            isInitialLoad = false;
        }, 1000);
    }
}

// ========================================
// レイアウト
// ========================================

/**
 * レイアウトを強制的に2カラムに設定（Firefox対応）
 * 縦長モードの場合は適用しない
 */
function forceLayout() {
    const existingStyle = document.getElementById('force-layout-style');

    // 縦長モードの場合は強制レイアウトを削除して終了
    if (document.body.classList.contains('vertical-mode')) {
        if (existingStyle) {
            existingStyle.remove();
        }
        return;
    }

    if (existingStyle) {
        existingStyle.remove();
    }

    const style = document.createElement('style');
    style.id = 'force-layout-style';
    style.textContent = `
        .container {
            display: grid !important;
            width: 100% !important;
            height: 100vh !important;
            padding-top: 32px !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
        }
        .ad-area {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            height: calc(100vh - 32px) !important;
            min-height: 0 !important;
            max-height: calc(100vh - 32px) !important;
            position: relative !important;
            overflow: hidden !important;
            background: linear-gradient(-45deg, #141E30, #243B55, #2c3e50, #4ca1af) !important;
        }
        .info-area {
            height: calc(100vh - 32px) !important;
            min-height: 0 !important;
            max-height: calc(100vh - 32px) !important;
            overflow: hidden !important;
        }
        .ad-container {
            width: 100% !important;
            flex: 1 !important;
            min-height: 0 !important;
            overflow: hidden !important;
        }
        #ad-link {
            max-height: 100% !important;
        }
        #ad-image {
            display: block !important;
            max-width: 100% !important;
            max-height: 100% !important;
            width: auto !important;
            height: auto !important;
            object-fit: contain !important;
            margin: 0 auto !important;
        }
        /* サイネージモード: 予定を最優先で表示 */
        .content-grid {
            grid-template-rows: auto 1fr !important;
        }
        .schedule-section {
            min-height: auto !important;
            max-height: 60vh !important;
            overflow: visible !important;
        }
        .schedule-grid-container {
            min-height: 120px !important;
            overflow: visible !important;
        }
        .schedule-day-column {
            min-height: 100px !important;
            overflow: visible !important;
        }
        .schedule-scroll-area {
            min-height: 80px !important;
            overflow: visible !important;
        }
        .no-schedule {
            min-height: 70px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }
        /* 連絡・提出物は残りスペースに収める、見切れてもOK */
        .notice-section,
        .assignment-section {
            overflow: hidden !important;
            min-height: 0 !important;
        }
    `;
    document.head.appendChild(style);
}

// ========================================
// Firestore接続
// ========================================

/**
 * Firestore接続をテスト
 */
async function testFirestoreConnection() {
    try {
        console.log('Firestore接続テスト中...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(
            `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`,
            { method: 'GET', signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (response.ok || response.status === 401 || response.status === 403) {
            console.log('Firestore接続テスト: 成功');
            return true;
        }
        console.log('Firestore接続テスト: 失敗 (status:', response.status, ')');
        return false;
    } catch (error) {
        console.log('Firestore接続テスト: 失敗', error.message);
        return false;
    }
}

/**
 * Firestoreリアルタイム監視を開始
 */
function startRealtimeListeners() {
    const todayStr = getTodayString();
    pendingUpdates = 2;

    // 設定・広告の監視（学年 > クラス）
    const classRef = classDocRef(SCHOOL_ID, GRADE_ID, CLASS_ID);
    onSnapshot(classRef, async (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            const settings = data.displaySettings || {};
            appData.schoolName = data.schoolName || "School Name";
            appData.className = data.name || "";
            appData.ads = settings.ads || [];
            appData.quietHours = settings.quietHours || [];

            updateUI();
            await syncImageCache(appData.ads);
            restartAdRotation();
            updateAdAreaVisibility();

            if (!isInitialLoad) {
                playNotificationSound();
            } else {
                markInitialLoadComplete();
            }
        } else {
            markInitialLoadComplete();
        }
    }, (error) => {
        console.error('クラス設定の監視エラー:', error);
        markInitialLoadComplete();
    });

    // 日次データの監視（学年 > クラス）
    const dailyRef = dailyDataCollectionRef(SCHOOL_ID, GRADE_ID, CLASS_ID);
    const fiveDaysAgoStr = getDaysAgoStr(5);

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

            if (dateKey >= todayStr && data.schedules) {
                const filteredSchedules = filterByDisplayRange(data.schedules, todayStr, dateKey);
                if (filteredSchedules.length > 0) {
                    appData.weeklySchedules[dateKey] = filteredSchedules;
                }
            }

            if (dateKey === todayStr) {
                appData.notices = data.notices || [];
            }

            if (data.assignments && data.assignments.length > 0) {
                appData.assignments = appData.assignments.concat(data.assignments);
            }
        });

        appData.assignments.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

        updateUI();

        if (!isInitialLoad) {
            checkAndPlayNotificationSound();
        } else {
            markInitialLoadComplete();
        }
    }, (error) => {
        console.error('日次データの監視エラー:', error);
        markInitialLoadComplete();
    });
}

// ========================================
// 静的JSONポーリング
// ========================================

/**
 * 静的JSONポーリングを開始
 */
function startStaticJsonPolling() {
    console.log('静的JSONポーリングを開始');
    console.log(`  コンテンツ更新間隔: ${CONTENT_POLLING_INTERVAL / 1000}秒`);
    console.log(`  画像更新間隔: ${IMAGE_POLLING_INTERVAL / 1000}秒`);

    fetchStaticJson(true);

    contentPollingTimer = setInterval(() => {
        fetchStaticJson(false);
    }, CONTENT_POLLING_INTERVAL);

    imagePollingTimer = setInterval(() => {
        if (appData.ads && appData.ads.length > 0) {
            console.log('画像キャッシュを更新チェック...');
            syncImageCache(appData.ads);
        }
    }, IMAGE_POLLING_INTERVAL);
}

/**
 * 静的JSONを取得してUIを更新
 */
async function fetchStaticJson(isInitial) {
    try {
        const jsonUrl = getStaticJsonUrl(SCHOOL_ID, GRADE_ID, CLASS_ID);
        const url = `${jsonUrl}?t=${Date.now()}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const jsonData = await response.json();

        const contentHash = JSON.stringify({
            config: jsonData.config,
            dailyData: jsonData.dailyData
        });
        const adsHash = JSON.stringify(jsonData.config?.ads || []);

        if (!isInitial && contentHash === lastJsonHash) {
            return;
        }

        lastJsonHash = contentHash;
        console.log(`静的JSON取得成功 (generated: ${jsonData.generatedAt})`);

        const config = jsonData.config || {};
        appData.schoolName = config.schoolName || 'School Name';
        appData.className = config.className || '';
        appData.quietHours = config.quietHours || [];

        const todayStr = getTodayString();
        const dailyData = jsonData.dailyData || {};

        appData.weeklySchedules = {};
        appData.notices = [];
        appData.assignments = [];

        Object.entries(dailyData).forEach(([dateKey, data]) => {
            if (dateKey >= todayStr && data.schedules) {
                appData.weeklySchedules[dateKey] = data.schedules;
            }

            if (data.notices && data.notices.length > 0) {
                const filteredNotices = filterByDisplayRange(data.notices, todayStr, dateKey);
                appData.notices = appData.notices.concat(filteredNotices);
            }

            if (data.assignments && data.assignments.length > 0) {
                appData.assignments = appData.assignments.concat(data.assignments);
            }
        });

        appData.assignments.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

        updateUI();

        if (isInitial || adsHash !== lastAdsHash) {
            lastAdsHash = adsHash;
            appData.ads = config.ads || [];

            console.log(`広告データ更新: ${appData.ads.length}件`);

            await syncImageCache(appData.ads);
            restartAdRotation();
            updateAdAreaVisibility();
        }

        if (!isInitial && !isInitialLoad) {
            checkAndPlayNotificationSound();
        }

        if (isInitial) {
            isInitialLoad = false;
        }

    } catch (error) {
        console.error('静的JSON取得エラー:', error);
    }
}

// ========================================
// UI更新
// ========================================

/**
 * UI全体を更新
 */
function updateUI() {
    renderHeader();
    renderSchedules();
    renderNotices();
    renderAssignments();

    requestAnimationFrame(() => {
        adjustScrollAreas();
        setTimeout(() => startAutoScroll(), 300);
    });
}

/**
 * ヘッダー部分を描画（デスクトップ・モバイル両方）
 */
function renderHeader() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const date = today.getDate();
    const day = DAYS_JP[today.getDay()];

    const dateText = `${month}月${date}日`;
    const dayText = `(${day})`;
    const className = appData.className;

    // デスクトップ用（広告エリア上部）
    const dateEl = document.getElementById('current-date');
    const dayEl = document.getElementById('current-day');
    const classEl = document.getElementById('class-name');

    if (dateEl) dateEl.textContent = dateText;
    if (dayEl) dayEl.textContent = dayText;
    if (classEl) classEl.textContent = className;

    // モバイル用（モバイル広告エリア上部）
    const mobileDateEl = document.getElementById('mobile-current-date');
    const mobileDayEl = document.getElementById('mobile-current-day');
    const mobileClassEl = document.getElementById('mobile-class-name');

    if (mobileDateEl) mobileDateEl.textContent = dateText;
    if (mobileDayEl) mobileDayEl.textContent = dayText;
    if (mobileClassEl) mobileClassEl.textContent = className;
}

/**
 * 予定セクションの最小行数
 */
const MIN_SCHEDULE_ROWS = 3;

/**
 * 予定セクションを描画
 * 3行分のスペースを確保するため、空欄のプレースホルダーを追加
 */
function renderSchedules() {
    const container = document.getElementById('schedule-grid');
    container.innerHTML = '';

    let displayedCount = 0;
    let dayOffset = 0;

    while (displayedCount < 3) {
        const targetDate = getDateOffset(dayOffset);

        if (isWeekend(targetDate)) {
            dayOffset++;
            continue;
        }

        const dateKey = formatDateKey(targetDate);
        const dayOfWeek = targetDate.getDay();
        const dayStr = DAYS_JP[dayOfWeek];
        const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
        const dd = String(targetDate.getDate()).padStart(2, '0');
        const displayDate = `${mm}/${dd} (${dayStr})`;

        let schedules = appData.weeklySchedules[dateKey] || [];

        // 時系列順にソート
        schedules = sortSchedulesByTime(schedules);

        // 3行分のコンテンツを生成（不足分は空欄で埋める）
        const scheduleHtml = generateScheduleRowsHtml(schedules);

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
 * 予定を時系列順にソート
 * @param {Array} schedules - 予定データ配列
 * @returns {Array} - ソートされた予定データ配列
 */
function sortSchedulesByTime(schedules) {
    return [...schedules].sort((a, b) => {
        const timeA = parseTimeToMinutes(a.time);
        const timeB = parseTimeToMinutes(b.time);
        return timeA - timeB;
    });
}

/**
 * 時刻文字列を分に変換
 * @param {string} timeStr - 時刻文字列 (例: "09:00", "9:00", "放課後")
 * @returns {number} - 分換算値（パースできない場合は9999を返す）
 */
function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 9999;

    // HH:MM または H:MM 形式を試行
    const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
    if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        return hours * 60 + minutes;
    }

    // 特定のキーワードに対応
    const keywords = {
        '朝': 0,
        '登校': 30,
        '朝学': 60,
        '1限': 540,
        '2限': 600,
        '3限': 660,
        '4限': 720,
        '昼': 780,
        '5限': 840,
        '6限': 900,
        '放課後': 960,
        '終日': 0
    };

    for (const [keyword, minutes] of Object.entries(keywords)) {
        if (timeStr.includes(keyword)) {
            return minutes;
        }
    }

    return 9999; // パースできない場合は最後に配置
}

/**
 * 予定リストのHTMLを生成（3行分確保、不足分は空欄）
 * @param {Array} schedules - 予定データ配列
 * @returns {string} - HTML文字列
 */
function generateScheduleRowsHtml(schedules) {
    const rows = [];

    // 実際の予定を追加
    for (let i = 0; i < schedules.length; i++) {
        const item = schedules[i];
        rows.push(`
            <div class="schedule-list-item">
                <span class="schedule-time">${item.time}</span>
                <span class="schedule-content">${item.content}</span>
            </div>
        `);
    }

    // 3行に満たない場合は空欄のプレースホルダーを追加
    const emptyRowsNeeded = MIN_SCHEDULE_ROWS - schedules.length;
    for (let i = 0; i < emptyRowsNeeded; i++) {
        rows.push(`
            <div class="schedule-list-item schedule-placeholder">
                <span class="schedule-time">&nbsp;</span>
                <span class="schedule-content">&nbsp;</span>
            </div>
        `);
    }

    return rows.join('');
}

/**
 * 連絡セクションを描画
 */
function renderNotices() {
    const list = document.getElementById('notice-list');
    const MIN_NOTICE_ROWS = 3;

    if (appData.notices.length === 0) {
        // 「連絡事項はありません」メッセージ + プレースホルダー行
        let html = '<li class="no-notice">連絡事項はありません</li>';
        for (let i = 0; i < MIN_NOTICE_ROWS - 1; i++) {
            html += '<li class="notice-placeholder">&nbsp;</li>';
        }
        list.innerHTML = html;
        return;
    }

    let html = appData.notices.map(item => `
        <li class="${item.is_highlight ? 'highlight' : ''}">
            ${item.is_highlight ? '【重要】' : ''} ${item.text}
        </li>
    `).join('');

    // 3行に満たない場合はプレースホルダー行を追加
    const emptyRowsNeeded = MIN_NOTICE_ROWS - appData.notices.length;
    for (let i = 0; i < emptyRowsNeeded; i++) {
        html += '<li class="notice-placeholder">&nbsp;</li>';
    }

    list.innerHTML = html;
}

/**
 * 提出物セクションを描画
 */
function renderAssignments() {
    const list = document.getElementById('assignment-list');
    const MIN_ASSIGNMENT_ROWS = 3;

    const filteredAssignments = filterRecentAssignments(appData.assignments, 5);

    if (filteredAssignments.length === 0) {
        // 「提出物はありません」メッセージ + プレースホルダー行
        let html = '<tr><td colspan="3" class="no-assignment">提出物はありません</td></tr>';
        for (let i = 0; i < MIN_ASSIGNMENT_ROWS - 1; i++) {
            html += '<tr class="assignment-placeholder"><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>';
        }
        list.innerHTML = html;
        return;
    }

    let html = filteredAssignments.map(item => {
        const { text, cssClass, days } = calculateDaysLeft(item.deadline);
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

    // 3行に満たない場合はプレースホルダー行を追加
    const emptyRowsNeeded = MIN_ASSIGNMENT_ROWS - filteredAssignments.length;
    for (let i = 0; i < emptyRowsNeeded; i++) {
        html += '<tr class="assignment-placeholder"><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>';
    }

    list.innerHTML = html;
}

/**
 * スクロール領域の高さを調整
 */
function adjustScrollAreas() {
    const noticeSection = document.querySelector('.notice-section');
    const noticeList = document.getElementById('notice-list');
    if (noticeSection && noticeList) {
        const header = noticeSection.querySelector('h2');
        const headerHeight = header ? header.offsetHeight : 0;
        const padding = 20;
        const availableHeight = noticeSection.offsetHeight - headerHeight - padding;
        if (availableHeight > 50) {
            noticeList.style.maxHeight = availableHeight + 'px';
        }
    }

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
}

// ========================================
// 広告管理
// ========================================

/**
 * 広告ローテーションを再開始
 */
function restartAdRotation() {
    if (adTimer) {
        clearTimeout(adTimer);
    }

    if (!appData.ads || appData.ads.length === 0) {
        updateAdIndicator();
        return;
    }

    currentAdIndex = 0;
    updateAdIndicator();
    showAd();
}

/**
 * 広告インジケーター（ドット）を更新
 * @param {number} activeIndex - 現在表示中の広告インデックス
 */
function updateAdIndicator(activeIndex = 0) {
    const indicator = document.getElementById('mobile-ad-indicator');
    if (!indicator) return;

    if (!appData.ads || appData.ads.length <= 1) {
        indicator.innerHTML = '';
        return;
    }

    const dots = appData.ads.map((_, index) => {
        const isActive = index === activeIndex ? 'active' : '';
        return `<span class="indicator-dot ${isActive}"></span>`;
    }).join('');

    indicator.innerHTML = dots;
}

/**
 * 広告を表示（画像/動画対応）
 */
async function showAd() {
    forceLayout();

    const imgEl = document.getElementById('ad-image');
    const videoEl = document.getElementById('ad-video');
    const mobileImgEl = document.getElementById('mobile-ad-image');
    const mobileVideoEl = document.getElementById('mobile-ad-video');
    const adLink = document.getElementById('ad-link');
    const adArea = document.querySelector('.ad-area');
    const mobileAdArea = document.querySelector('.mobile-ad-area');

    // 前の動画を停止
    if (videoEl) {
        videoEl.pause();
        videoEl.removeAttribute('src');
    }
    if (mobileVideoEl) {
        mobileVideoEl.pause();
        mobileVideoEl.removeAttribute('src');
    }

    if (isQuietTime()) {
        if (imgEl) imgEl.style.display = 'none';
        if (videoEl) videoEl.style.display = 'none';
        if (mobileImgEl) mobileImgEl.style.display = 'none';
        if (mobileVideoEl) mobileVideoEl.style.display = 'none';
        if (adArea) adArea.classList.add('quiet-mode');
        if (mobileAdArea) mobileAdArea.classList.add('quiet-mode');
        adTimer = setTimeout(showAd, 60000);
        return;
    }

    if (adArea) adArea.classList.remove('quiet-mode');
    if (mobileAdArea) mobileAdArea.classList.remove('quiet-mode');

    if (appData.ads.length === 0) {
        return;
    }

    const ad = appData.ads[currentAdIndex];
    const isVideo = ad.type === 'video';

    let mediaUrl = ad.url;

    // 画像の場合のみキャッシュを試行
    if (!isVideo) {
        try {
            const cachePromise = ImageCache.getImage(ad.id);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Cache timeout')), 500)
            );

            const cachedUrl = await Promise.race([cachePromise, timeoutPromise]);
            if (cachedUrl) {
                mediaUrl = cachedUrl;
            }
        } catch (error) {
            // キャッシュ取得失敗時は直接URLを使用
        }
    }

    // 音声設定（デフォルトはミュート）
    const isMuted = ad.muted !== false;

    // デスクトップ用広告
    if (isVideo) {
        // 動画表示
        if (imgEl) imgEl.style.display = 'none';
        if (videoEl) {
            videoEl.src = mediaUrl;
            videoEl.style.display = 'block';
            videoEl.style.visibility = 'visible';
            videoEl.style.opacity = '1';
            videoEl.style.width = '100%';
            videoEl.style.height = 'auto';
            videoEl.style.maxHeight = '100vh';
            videoEl.style.objectFit = 'contain';
            videoEl.muted = isMuted;
            videoEl.play().catch(e => console.warn('動画再生エラー:', e));
        }
    } else {
        // 画像表示
        if (videoEl) videoEl.style.display = 'none';
        if (imgEl) {
            imgEl.src = mediaUrl;
            imgEl.style.display = 'block';
            imgEl.style.visibility = 'visible';
            imgEl.style.opacity = '1';

            // 1枚目の広告画像ロード時にグリッド幅を調整（サイネージモードのみ）
            if (currentAdIndex === 0 && !window._adGridAdjusted) {
                const adjustGrid = () => {
                    const container = document.querySelector('.container');
                    if (!container || document.body.classList.contains('vertical-mode')) return;
                    const imgW = imgEl.naturalWidth;
                    const imgH = imgEl.naturalHeight;
                    if (imgW && imgH) {
                        const adHeader = document.querySelector('.ad-header');
                        const headerH = adHeader ? adHeader.getBoundingClientRect().height : 32;
                        const imageAreaH = window.innerHeight - headerH;
                        const adNeededW = Math.ceil(imageAreaH * (imgW / imgH));
                        container.style.gridTemplateColumns = `1fr ${adNeededW}px`;
                        window._adGridAdjusted = true;
                    }
                };
                if (imgEl.complete && imgEl.naturalWidth) {
                    adjustGrid();
                } else {
                    imgEl.onload = adjustGrid;
                }
            }

            imgEl.onerror = () => {
                if (imgEl.src !== ad.url) {
                    imgEl.src = ad.url;
                }
            };
        }
    }

    // モバイル用広告
    if (isVideo) {
        if (mobileImgEl) mobileImgEl.style.display = 'none';
        if (mobileVideoEl) {
            mobileVideoEl.src = mediaUrl;
            mobileVideoEl.style.display = 'block';
            mobileVideoEl.muted = isMuted;
            mobileVideoEl.play().catch(e => console.warn('モバイル動画再生エラー:', e));
        }
    } else {
        if (mobileVideoEl) mobileVideoEl.style.display = 'none';
        if (mobileImgEl) {
            mobileImgEl.src = mediaUrl;
            mobileImgEl.style.display = 'block';

            mobileImgEl.onerror = () => {
                if (mobileImgEl.src !== ad.url) {
                    mobileImgEl.src = ad.url;
                }
            };
        }
    }

    // リンク先の設定（デスクトップ）
    const activeEl = isVideo ? videoEl : imgEl;
    if (adLink) {
        if (ad.link_url && ad.link_url.trim()) {
            adLink.href = ad.link_url;
            adLink.style.cursor = 'pointer';
            if (activeEl) activeEl.style.cursor = 'pointer';
        } else {
            adLink.href = '#';
            adLink.onclick = (e) => e.preventDefault();
            adLink.style.cursor = 'default';
            if (activeEl) activeEl.style.cursor = 'default';
        }
    }

    // リンク先の設定（モバイル）
    const mobileAdLink = document.getElementById('mobile-ad-link');
    const mobileActiveEl = isVideo ? mobileVideoEl : mobileImgEl;
    if (mobileAdLink) {
        if (ad.link_url && ad.link_url.trim()) {
            mobileAdLink.href = ad.link_url;
            mobileAdLink.style.cursor = 'pointer';
            if (mobileActiveEl) mobileActiveEl.style.cursor = 'pointer';
        } else {
            mobileAdLink.href = '#';
            mobileAdLink.onclick = (e) => e.preventDefault();
            mobileAdLink.style.cursor = 'default';
            if (mobileActiveEl) mobileActiveEl.style.cursor = 'default';
        }
    }

    const container = activeEl ? activeEl.parentElement : null;
    if (container) {
        container.style.width = '100%';
        container.style.height = '100vh';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
    }

    // 現在表示中の広告インデックスを記録してから次へ進める
    const displayedAdIndex = currentAdIndex;
    currentAdIndex = (currentAdIndex + 1) % appData.ads.length;

    // インジケーター更新（表示中の広告のインデックスを渡す）
    updateAdIndicator(displayedAdIndex);

    // 動画の場合は動画終了時に次へ、画像の場合は設定秒数後に次へ
    if (isVideo && videoEl) {
        videoEl.onended = () => {
            adTimer = setTimeout(showAd, 500);
        };
        // フォールバック: 動画が長すぎる場合のタイムアウト（3分）
        adTimer = setTimeout(() => {
            if (videoEl) videoEl.pause();
            showAd();
        }, 180000);
    } else {
        const duration = (ad.duration_sec || 5) * 1000;
        adTimer = setTimeout(showAd, duration);
    }
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
// 詳細表示モード (#3: タップで詳細切替)
// ========================================

let detailModeActive = false;
let detailModeTimer = null;
const DETAIL_MODE_DURATION = 20000; // 20秒

/**
 * 詳細表示モードの初期化
 * 画面タップでinfo-areaを全画面表示し、20秒後に戻る
 */
function initDetailMode() {
    const infoArea = document.querySelector('.info-area');
    if (!infoArea) return;

    infoArea.addEventListener('click', (e) => {
        // ダッシュボードではなくサイネージ表示画面でのみ有効
        if (document.getElementById('appContainer')) return;
        // リンクやボタンクリック時は無視
        if (e.target.closest('a') || e.target.closest('button')) return;

        toggleDetailMode();
    });

    infoArea.addEventListener('touchstart', (e) => {
        if (document.getElementById('appContainer')) return;
        if (e.target.closest('a') || e.target.closest('button')) return;
        // ダブルタップ防止
    }, { passive: true });
}

function toggleDetailMode() {
    if (detailModeActive) {
        exitDetailMode();
    } else {
        enterDetailMode();
    }
}

function enterDetailMode() {
    detailModeActive = true;
    document.body.classList.add('detail-mode');

    // ヒントバナーを表示
    let hint = document.getElementById('detail-mode-hint');
    if (!hint) {
        hint = document.createElement('div');
        hint.id = 'detail-mode-hint';
        hint.innerHTML = '📖 詳細表示中（20秒後に自動で戻ります）<br>タップで戻る';
        hint.style.cssText = 'position:fixed;top:0;left:0;right:0;background:rgba(102,126,234,0.95);color:white;text-align:center;padding:8px;font-size:14px;z-index:9999;cursor:pointer;';
        hint.addEventListener('click', exitDetailMode);
        document.body.appendChild(hint);
    }
    hint.style.display = 'block';

    // 20秒後に自動で戻る
    if (detailModeTimer) clearTimeout(detailModeTimer);
    detailModeTimer = setTimeout(exitDetailMode, DETAIL_MODE_DURATION);
}

function exitDetailMode() {
    detailModeActive = false;
    document.body.classList.remove('detail-mode');

    const hint = document.getElementById('detail-mode-hint');
    if (hint) hint.style.display = 'none';

    if (detailModeTimer) {
        clearTimeout(detailModeTimer);
        detailModeTimer = null;
    }
}

// DOMContentLoadedで詳細モードを初期化
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initDetailMode, 500);
});

// ========================================
// 画像キャッシュ
// ========================================

/**
 * 画像をIndexedDBキャッシュに同期
 */
async function syncImageCache(ads) {
    if (!ads || ads.length === 0) {
        return;
    }

    try {
        await ImageCache.init();

        for (const ad of ads) {
            if (!ad.id || !ad.url) continue;

            const isCached = await ImageCache.hasImage(ad.id);
            if (!isCached) {
                await ImageCache.cacheImage(ad.id, ad.url);
            }
        }

        const currentIds = ads.map(ad => ad.id).filter(Boolean);
        await ImageCache.cleanup(currentIds);

    } catch (error) {
        console.error('syncImageCache: Error:', error);
    }
}

// ========================================
// 自動スクロール（auto-scroller.js に移動済み）
// ========================================

function startAutoScroll() {
    _startAutoScroll(autoScrollers);
}

function stopAutoScroll() {
    _stopAutoScroll(autoScrollers);
}

// ========================================
// Page Visibility API
// ========================================

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        console.log('タブがアクティブになりました');

        if (useStaticJson) {
            fetchStaticJson(false);
        }

        if (autoScrollers.size === 0) {
            startAutoScroll();
        }
    }
});

// ========================================
// カレンダーモーダル（calendar.js に移動済み）
// ========================================

// カレンダー初期化をDOMContentLoadedで実行
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => _initCalendar(appData, sortSchedulesByTime), 100);
});
