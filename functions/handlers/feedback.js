/**
 * handlers/feedback.js
 * 教員用フィードバック受付
 *
 * コレクション: feedback/{feedbackId}
 *   {
 *     schoolId, classroomLabel,
 *     studentReaction (1-5), studentEpisode,
 *     teacherUtility (1-5), improvement,
 *     submitterUid, submitterEmail,
 *     createdAt
 *   }
 *
 * メール通知は "Trigger Email from Firestore" 拡張機能を利用。
 * mail/{id} コレクションにドキュメントを書き込むと拡張機能が SMTP 送信する。
 * 拡張機能未設置でも feedback ドキュメントは正しく保存されるので副作用はない。
 */

const { functions, admin, db } = require('../helpers/paths');
const { verifyAdmin, withAuth } = require('../helpers/auth');

const FEEDBACK_RECIPIENT = '20051215kaito@gmail.com';
const MAIL_COLLECTION = 'mail';
const FEEDBACK_COLLECTION = 'feedback';

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
        `送信者: ${data.submitterEmail || data.submitterUid || '不明'}`,
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
    送信者: ${esc(data.submitterEmail || data.submitterUid || '不明')}<br>
    送信日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
  </p>
</div>`.trim();
}

/**
 * submitFeedback
 * フォームから送信。認証は不要（先生・生徒・見学者など誰でも送れる）。
 * ただしクライアント直書きは Firestore ルールで禁止しており、この関数経由のみ。
 * feedback ドキュメントと mail ドキュメント（拡張機能連携）を同時作成。
 *
 * スパム対策: 学校 ID の存在チェック + 入力長さ制限。本格的なレート制限は未実装。
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

        // 学校 ID が実在することを確認（任意文字列での投稿を防ぐ最低限の検証）
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

    // メール通知 (Trigger Email extension 連携)
    // 拡張機能未設置の場合はこのドキュメントが読まれないだけで、エラーにはならない。
        try {
            await db.collection(MAIL_COLLECTION).add({
                to: FEEDBACK_RECIPIENT,
                message: {
                    subject: `[キミテラス] 新しいフィードバック: ${feedbackPayload.classroomLabel}`,
                    text: buildEmailBody(feedbackPayload),
                    html: buildEmailHtml(feedbackPayload),
                },
                meta: {
                    feedbackId: ref.id,
                    schoolId: feedbackPayload.schoolId,
                },
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        } catch (e) {
            console.warn('mail コレクションへの書き込みに失敗（フィードバック自体は保存済み）:', e.message);
        }

        return { success: true, feedbackId: ref.id };
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
        });
    });
    return { items };
}, (context) => verifyAdmin(context)));
