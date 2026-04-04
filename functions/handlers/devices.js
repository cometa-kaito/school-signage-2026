/**
 * handlers/devices.js
 * デバイス認証
 */

const functions = require('firebase-functions');
const crypto = require('crypto');
const { admin, db } = require('../helpers/paths');
const { verifySchoolAdmin, withAuth } = require('../helpers/auth');
const { validateRequired } = require('../helpers/validation');

exports.registerDevice = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, gradeId, classId, name } = data;

    const deviceToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(deviceToken).digest('hex');

    const ref = db.collection('schools').doc(schoolId).collection('devices').doc();
    await ref.set({
        gradeId, classId, deviceTokenHash: hashedToken, name,
        status: 'registered', createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const fullToken = `${schoolId}:${ref.id}:${deviceToken}`;
    return { success: true, deviceId: ref.id, deviceToken: fullToken, message: `デバイス「${name}」を登録しました` };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'gradeId', 'classId', 'name']);
    await verifySchoolAdmin(context, data.schoolId);
}));

exports.authenticateDevice = functions.https.onCall(withAuth(async (data) => {
    const { deviceToken } = data;
    validateRequired(data, ['deviceToken']);

    const parts = deviceToken.split(':');
    if (parts.length !== 3) throw new functions.https.HttpsError('invalid-argument', 'トークンの形式が不正です');

    const [schoolId, deviceId, token] = parts;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const deviceDoc = await db.collection('schools').doc(schoolId).collection('devices').doc(deviceId).get();

    if (!deviceDoc.exists || deviceDoc.data().deviceTokenHash !== hashedToken) {
        throw new functions.https.HttpsError('unauthenticated', 'デバイストークンが無効です');
    }

    const { gradeId, classId, name } = deviceDoc.data();
    const customToken = await admin.auth().createCustomToken(`device_${deviceId}`, {
        isDevice: true, deviceId, schoolId, gradeId, classId
    });

    await deviceDoc.ref.update({
        lastSeen: admin.firestore.FieldValue.serverTimestamp(), status: 'online'
    });

    return { success: true, customToken, schoolId, gradeId, classId, deviceName: name };
}, null));

exports.listDevices = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId } = data;
    const snap = await db.collection('schools').doc(schoolId).collection('devices').get();
    const devices = [];
    snap.forEach(doc => {
        const d = doc.data();
        devices.push({
            id: doc.id, gradeId: d.gradeId, classId: d.classId,
            name: d.name, status: d.status || 'unknown',
            lastSeen: d.lastSeen, createdAt: d.createdAt
        });
    });
    return { devices };
}, async (context, data) => {
    validateRequired(data, ['schoolId']);
    await verifySchoolAdmin(context, data.schoolId);
}));

exports.revokeDeviceToken = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, deviceId } = data;
    const newToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(newToken).digest('hex');
    await db.collection('schools').doc(schoolId).collection('devices').doc(deviceId)
        .update({ deviceTokenHash: hashedToken });
    return { success: true, deviceToken: `${schoolId}:${deviceId}:${newToken}`, message: 'トークンを再発行しました' };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'deviceId']);
    await verifySchoolAdmin(context, data.schoolId);
}));

exports.removeDevice = functions.https.onCall(withAuth(async (data, context) => {
    const { schoolId, deviceId } = data;
    await db.collection('schools').doc(schoolId).collection('devices').doc(deviceId).delete();
    return { success: true, message: 'デバイスを削除しました' };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'deviceId']);
    await verifySchoolAdmin(context, data.schoolId);
}));
