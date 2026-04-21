/**
 * handlers/feedback.js
 * 教員・生徒・見学者など誰でも送れるフィードバック受付。
 *
 * 【データ保存】
 *   feedback/{feedbackId} — システム管理者だけが /manage/admin で閲覧可能
 *
 * 【メール通知】Resend のみを使用。未設定の場合は送信をスキップするが、
 *   フィードバックの Firestore 保存は動作する（受付機能は決して壊れない）。
 *
 * 【認証情報】Google Cloud Secret Manager で管理:
 *   firebase functions:secrets:set RESEND_API_KEY
 *
 *   送信元アドレスは DEFAULT_RESEND_FROM (onboarding@resend.dev) を使用。
 *   ドメイン検証済みアドレスに変える場合は環境変数 RESEND_FROM を設定。
 *
 *   ローカル emulator では functions/.secret.local に
 *     RESEND_API_KEY=...
 *   の形式で書くと自動で読み込まれる（git 管理外）。
 */

const { functions, admin, db } = require('../helpers/paths');
const { logger } = require('firebase-functions');
const { verifyAdmin, withAuth } = require('../helpers/auth');
const { defineSecret } = require('firebase-functions/params');

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const FEEDBACK_SECRETS = [RESEND_API_KEY];

let Resend;
try {
    // eslint-disable-next-line global-require
    Resend = require('resend').Resend;
} catch (_) {
    Resend = null;
}

const FEEDBACK_RECIPIENT = '20051215kaito@gmail.com';
const FEEDBACK_COLLECTION = 'feedback';
const DEFAULT_RESEND_FROM = 'キミテラス フィードバック <onboarding@resend.dev>';

/**
 * Secret Manager / ローカル .secret.local / process.env のいずれかから読む。
 * defineSecret の value() は Secret Manager バインドが無い起動では throw する場合があるため try/catch。
 */
function readSecret(secretParam, envKey) {
    try {
        const v = secretParam.value();
        if (v) return v;
    } catch (_) { /* 未バインド時は無視 */ }
    return process.env[envKey] || null;
}

function getResendClient() {
    if (!Resend) return false;
    const apiKey = readSecret(RESEND_API_KEY, 'RESEND_API_KEY');
    if (!apiKey) return false;
    return new Resend(apiKey);
}

function clampScore(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return null;
    if (v < 1 || v > 5) return null;
    return Math.round(v);
}

function buildEmailBody(data) {
    const schoolDisplay = data.schoolName
        ? `${data.schoolName} (${data.schoolId})`
        : (data.schoolId || '-');
    const lines = [
        `学校: ${schoolDisplay}`,
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
    const schoolDisplay = data.schoolName
        ? `${data.schoolName} <span style="color: #9ca3af; font-weight: normal;">(${data.schoolId})</span>`
        : (data.schoolId || '-');
    return `
<div style="font-family: sans-serif; max-width: 640px; color: #111827;">
  <h2 style="color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
    キミテラス フィードバック
  </h2>
  <p style="color: #6b7280; font-size: 14px;">
    学校: <strong style="color: #111827;">${schoolDisplay}</strong><br>
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
exports.submitFeedback = functions
    .runWith({ secrets: FEEDBACK_SECRETS })
    .https.onCall(async (data, context) => {
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
        const schoolName = schoolSnap.data().name || data.schoolId;

        const feedbackPayload = {
            schoolId: String(data.schoolId),
            schoolName,
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
        let emailProvider = null;
        const subject = `[キミテラス] 新しいフィードバック: ${feedbackPayload.classroomLabel}`;
        const textBody = buildEmailBody(feedbackPayload);
        const htmlBody = buildEmailHtml(feedbackPayload);

        const resend = getResendClient();
        if (!resend) {
            emailStatus = 'unconfigured';
            logger.warn('feedback.email.unconfigured', {
                feedbackId: ref.id,
                schoolId: feedbackPayload.schoolId,
            });
        } else {
            emailProvider = 'resend';
            try {
                const from = process.env.RESEND_FROM || DEFAULT_RESEND_FROM;
                const result = await resend.emails.send({
                    from,
                    to: FEEDBACK_RECIPIENT,
                    subject,
                    text: textBody,
                    html: htmlBody,
                });
                // resend SDK v4+ は { data, error } 形式を返す
                if (result && result.error) {
                    emailStatus = 'failed';
                    emailError = typeof result.error === 'string'
                        ? result.error
                        : (result.error.message || JSON.stringify(result.error));
                    logger.error('feedback.email.resend_send_failed', {
                        feedbackId: ref.id,
                        schoolId: feedbackPayload.schoolId,
                        error: emailError,
                    });
                } else {
                    emailStatus = 'sent';
                }
            } catch (e) {
                emailStatus = 'failed';
                emailError = e.message;
                logger.error('feedback.email.resend_exception', {
                    feedbackId: ref.id,
                    schoolId: feedbackPayload.schoolId,
                    message: e.message,
                    stack: e.stack,
                });
            }
        }

        // 送信ステータスを feedback ドキュメントにも記録（運用時の確認用）
        try {
            await ref.update({ emailStatus, emailError, emailProvider });
        } catch (_) {
            // 記録失敗は致命的ではない
        }

        return { success: true, feedbackId: ref.id, emailStatus, emailProvider };
    } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        logger.error('submitFeedback.internal_error', {
            message: error.message,
            stack: error.stack,
        });
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
            schoolName: d.schoolName || '',
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
