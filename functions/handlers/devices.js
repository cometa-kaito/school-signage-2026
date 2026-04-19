/**
 * handlers/devices.js
 * 端末管理 (school_admin 以上)
 * ドキュメント: schools/{s}/devices/{deviceId}
 *   { name, gradeId, classId, departmentId?, status, lastSeen, deviceTokenHash }
 */

const crypto = require('crypto');
const { functions, admin, db } = require('../helpers/paths');
const { verifyAuth, verifySchoolAdmin, withAuth } = require('../helpers/auth');
const { validateRequired } = require('../helpers/validation');

function devicesCollection(schoolId) {
    return db.collection('schools').doc(schoolId).collection('devices');
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

exports.listDevices = functions.https.onCall(withAuth(async (data) => {
    const { schoolId } = data;
    const snap = await devicesCollection(schoolId).orderBy('name', 'asc').get();
    const devices = [];
    snap.forEach(doc => {
        const d = doc.data();
        const lastSeen = d.lastSeen && d.lastSeen.toDate
            ? d.lastSeen.toDate().toISOString()
            : d.lastSeen || null;
        devices.push({
            id: doc.id,
            name: d.name,
            gradeId: d.gradeId,
            classId: d.classId,
            departmentId: d.departmentId || null,
            status: d.status || 'inactive',
            lastSeen,
        });
    });
    return { devices };
}, async (context, data) => {
    validateRequired(data, ['schoolId']);
    await verifySchoolAdmin(context, data.schoolId);
}));

exports.registerDevice = functions.https.onCall(withAuth(async (data) => {
    const { schoolId, gradeId, classId, departmentId, name } = data;
    const token = crypto.randomBytes(24).toString('hex');
    const ref = devicesCollection(schoolId).doc();
    await ref.set({
        name,
        gradeId,
        classId,
        departmentId: departmentId || null,
        status: 'active',
        deviceTokenHash: hashToken(token),
        lastSeen: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, deviceId: ref.id, token };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'gradeId', 'classId', 'name']);
    await verifySchoolAdmin(context, data.schoolId);
}));

exports.revokeDeviceToken = functions.https.onCall(withAuth(async (data) => {
    const { schoolId, deviceId } = data;
    await devicesCollection(schoolId).doc(deviceId).update({
        status: 'inactive',
        deviceTokenHash: admin.firestore.FieldValue.delete(),
    });
    return { success: true };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'deviceId']);
    await verifySchoolAdmin(context, data.schoolId);
}));

exports.removeDevice = functions.https.onCall(withAuth(async (data) => {
    const { schoolId, deviceId } = data;
    await devicesCollection(schoolId).doc(deviceId).delete();
    return { success: true };
}, async (context, data) => {
    validateRequired(data, ['schoolId', 'deviceId']);
    await verifySchoolAdmin(context, data.schoolId);
}));

/**
 * deviceHeartbeat: サイネージ端末から定期的に呼ばれ、lastSeen を更新する。
 * 認証不要（サイネージは匿名運用のため）。deviceId が存在するときのみ更新。
 */
exports.deviceHeartbeat = functions.https.onCall(async (data) => {
    const { schoolId, deviceId } = data || {};
    if (!schoolId || !deviceId) return { success: false };
    try {
        const ref = devicesCollection(schoolId).doc(deviceId);
        const snap = await ref.get();
        if (!snap.exists) return { success: false };
        await ref.update({
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
            status: 'active',
        });
        return { success: true };
    } catch (e) {
        console.error('deviceHeartbeat error:', e);
        return { success: false };
    }
});
