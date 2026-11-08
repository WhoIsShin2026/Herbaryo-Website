// What a completed purchase does, however it was paid. Safe to run twice: the result is the same and the first date is kept.
const { admin } = require('./firebase');

const PRICE_CENTAVOS = 4900;   // P49

async function grantFullGame(uid, purchaseId, details) {
    const now = admin.database.ServerValue.TIMESTAMP;
    const database = admin.database();
    const existingDate = await database.ref(`achievement-dates/${uid}/no_more_limits`).once('value');
    const updates = {
        [`herbaryo-users/${uid}/account_type`]: 'premium',
        [`herbaryo-users/${uid}/achievements/no_more_limits`]: true,
        [`purchases/${purchaseId}`]: { uid, amount: PRICE_CENTAVOS, paidAt: now, ...details }
    };
    if (!existingDate.exists()) updates[`achievement-dates/${uid}/no_more_limits`] = now;
    await database.ref().update(updates);
}

// Who is asking, and whether they can buy: { player } or { error, status }.
async function checkBuyer(event) {
    const header = event.headers.authorization || event.headers.Authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    let player;
    try {
        player = await admin.auth().verifyIdToken(token);
    } catch (error) {
        return { status: 401, error: 'signin' };
    }
    if (player.email_verified !== true) return { status: 403, error: 'verify' };

    const record = (await admin.database().ref(`herbaryo-users/${player.uid}`).once('value')).val();
    if (!record || !record.username) return { status: 404, error: 'profile' };
    if (record.account_type === 'premium') return { status: 409, error: 'owned' };
    return { player };
}

module.exports = { PRICE_CENTAVOS, grantFullGame, checkBuyer };
