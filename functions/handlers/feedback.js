/**
 * handlers/feedback.js
 * 教員・生徒・見学者など誰でも送れるフィードバック受付。
 *
 * 【データ保存】
 *   feedback/{feedbackId} — システム管理者だけが /manage/admin で閲覧可能
 *
 * 【メール通知】
 *   nodemailer + Gmail SMTP で 20051215kaito@gmail.com に直接送信。
 *   Gmail アプリパスワードは Firebase の Functions Config に保存して参照する。
 *
 *   セットアップ手順（1回のみ）:
 *     1) https://myaccount.google.com/apppasswords でアプリパスワードを発行
 *        （Google アカウントで 2段階認証を ON にする必要あり）
 *     2) firebase functions:config:set gmail.user="<送信元Gmail>" gmail.password="<アプリパスワード>"
 *     3) firebase deploy --only functions:submitFeedback
 *
 *   未設定の場合は送信をスキップするが、フィードバックの Firestore 保存と
 *   /manage/admin での閲覧は引き続き動作する（受付機能自体は決して壊れない）。
 */

const { functions, admin, db } = require('../helpers/paths');
const { verifyAdmin, withAuth } = require('../helpers/auth');

let nodemailer;
try {
    // eslint-disable-next-line global-require
    nodemailer = require('nodemailer');
} catch (_) {
    nodemailer = null;
}

const FEEDBACK_RECIPIENT = '20051215kaito@gmail.com';
const FEEDBACK_COLLECTION = 'feedback';

// トランスポーターはコールドスタートごとに1回だけ作れば十分
let cachedTransporter = null;
function getTransporter() {
    if (cachedTransporter) return cachedTransporter;
    if (!nodemailer) return null;

    let user = null;
    let pass = null;
    try {
        const cfg = functions.config();
        user = cfg && cfg.gmail && cfg.gmail.user;
        pass = cfg && cfg.gmail && cfg.gmail.password;
    } catch (_) {
        // functions.config() は環境によっては例外を投げる場合がある
    }
    // 環境変数フォールバック（ローカル emulator やカスタム deploy 用）
    user = user || process.env.GMAIL_USER || null;
    pass = pass || process.env.GMAIL_APP_PASSWORD || null;

    if (!user || !pass) return null;

    cachedTransporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass },
    });
    return cachedTransporter;
}

function clampScore(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return null;
    if (v < 1 || v > 5) return null;
    return Math.round(v);
}

function buildEmailBody(data) {
    const lines = [
        `学校: ${data.schoolId || '-'}`,
        `教室: ${data.classroomLabel || '-'}`,
        '',
        `● 生徒の反応・注目度: ${data.studentReaction}/5`,
        `● 先生の業務負担・利便性: ${data.teacherUtility}/5`,
        '',
        '【生徒の反応についての具体的なエピソード】',
        data.studentEpisode || '（記載なし）',
        '',
        '【改善の要望・お気付きの点】',
        data.improvement || '（記載なし）',
        '',
        '---',
        `送信日時: ${new Date().toISOString()}`,
    ];
    return lines.join('\n');
}

function buildEmailHtml(data) {
    const esc = (s) =>
        String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
    return `
<div style="font-family: sans-serif; max-width: 640px; color: #111827;">
  <h2 style="color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
    キミテラス フィードバック
  </h2>
  <p style="color: #6b7280; font-size: 14px;">
    学校: <strong style="color: #111827;">${esc(data.schoolId || '-')}</strong><br>
    教室: <strong style="color: #111827;">${esc(data.classroomLabel || '-')}</strong>
  </p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr>
      <td style="padding: 10px; border: 1px solid #e5e7eb; background: #f7f8fa;">生徒の反応・注目度</td>
      <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>${esc(data.studentReaction)} / 5</strong></td>
    </tr>
    <tr>
      <td style="padding: 10px; border: 1px solid #e5e7eb; background: #f7f8fa;">先生の業務負担・利便性</td>
      <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>${esc(data.teacherUtility)} / 5</strong></td>
    </tr>
  </table>
  <h3 style="margin-top: 20px; font-size: 16px;">生徒の反応についての具体的なエピソード</h3>
  <p style="padding: 12px; background: #f7f8fa; border-left: 3px solid #2c5282; margin: 8px 0;">
    ${esc(data.studentEpisode) || '<em>（記載なし）</em>'}
  </p>
  <h3 style="margin-top: 20px; font-size: 16px;">改善の要望・お気付きの点</h3>
  <p style="padding: 12px; background: #f7f8fa; border-left: 3px solid #2c5282; margin: 8px 0;">
    ${esc(data.improvement) || '<em>（記載なし）</em>'}
  </p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="color: #6b7280; font-size: 12px;">
    送信日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
  </p>
</div>`.trim();
}

/**
 * submitFeedback
 * 認証不要。誰でも送信可能。
 */
exports.submitFeedback = functions.https.onCall(async (data, context) => {
    try {
        const studentReaction = clampScore(data.studentReaction);
        const teacherUtility = clampScore(data.teacherUtility);

        if (studentReaction === null) {
            throw new functions.https.HttpsError('invalid-argument', '生徒の反応は 1〜5 で選んでください');
        }
        if (teacherUtility === null) {
            throw new functions.https.HttpsError('invalid-argument', '先生の負担は 1〜5 で選んでください');
        }
        if (!data.schoolId || typeof data.schoolId !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', '学校を選んでください');
        }
        if (!data.classroomLabel || typeof data.classroomLabel !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', '教室を選んでください');
        }

        const schoolSnap = await db.collection('schools').doc(data.schoolId).get();
        if (!schoolSnap.exists) {
            throw new functions.https.HttpsError('invalid-argument', '選択された学校が見つかりません');
        }

        const feedbackPayload = {
            schoolId: String(data.schoolId),
            classroomLabel: String(data.classroomLabel).slice(0, 200),
            studentReaction,
            studentEpisode: String(data.studentEpisode || '').slice(0, 2000),
            teacherUtility,
            improvement: String(data.improvement || '').slice(0, 2000),
            submitterUid: context.auth ? context.auth.uid : null,
            submitterEmail: context.auth ? (context.auth.token.email || null) : null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const ref = await db.collection(FEEDBACK_COLLECTION).add(feedbackPayload);

        // メール送信（失敗してもフィードバック保存自体は成功扱い）
        let emailStatus = 'skipped';
        let emailError = null;
        try {
            const transporter = getTransporter();
            if (!transporter) {
                emailStatus = 'unconfigured';
                console.warn('Gmail SMTP 未設定のためメール送信をスキップ');
            } else {
                const fromUser =
                    (functions.config().gmail && functions.config().gmail.user) ||
                    process.env.GMAIL_USER;
                await transporter.sendMail({
                    from: `キミテラス フィードバック <${fromUser}>`,
                    to: FEEDBACK_RECIPIENT,
                    subject: `[キミテラス] 新しいフィードバック: ${feedbackPayload.classroomLabel}`,
                    text: buildEmailBody(feedbackPayload),
                    html: buildEmailHtml(feedbackPayload),
                });
                emailStatus = 'sent';
            }
        } catch (e) {
            emailStatus = 'failed';
            emailError = e.message;
            console.error('メール送信失敗:', e);
        }

        // 送信ステータスを feedback ドキュメントにも記録（運用時の確認用）
        try {
            await ref.update({ emailStatus, emailError });
        } catch (_) {
            // 記録失敗は致命的ではない
        }

        return { success: true, feedbackId: ref.id, emailStatus };
    } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        console.error('submitFeedback error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * listFeedback
 * システム管理者のみ。新しい順で返す。
 */
exports.listFeedback = functions.https.onCall(withAuth(async (data) => {
    const limit = Math.min(Math.max(Number(data?.limit) || 50, 1), 200);
    const snap = await db.collection(FEEDBACK_COLLECTION)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
    const items = [];
    snap.forEach((doc) => {
        const d = doc.data();
        const createdAt = d.createdAt && d.createdAt.toDate
            ? d.createdAt.toDate().toISOString()
            : null;
        items.push({
            id: doc.id,
            schoolId: d.schoolId || '',
            classroomLabel: d.classroomLabel || '',
            studentReaction: d.studentReaction || 0,
            studentEpisode: d.studentEpisode || '',
            teacherUtility: d.teacherUtility || 0,
            improvement: d.improvement || '',
            submitterUid: d.submitterUid || null,
            submitterEmail: d.submitterEmail || null,
            createdAt,
            emailStatus: d.emailStatus || null,
        });
    });
    return { items };
}, (context) => verifyAdmin(context)));
