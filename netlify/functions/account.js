// Soft delete (Shin LOCK 2026-11-21): an account is never erased by a delete - its login is turned off and it is marked
// deleted, with everything kept. Only an admin can bring it back (restore) or remove its login for good (purge, after the
// Admin page has removed its data).
//   POST { action: "delete" }                 - the signed-in player deletes their own account
//   POST { action: "delete", uid }            - an admin deletes a player
//   POST { action: "restore", uid }           - an admin restores a deleted player
//   POST { action: "purge", uid }             - an admin removes a deleted player's login for good
const { admin } = require('../lib/firebase');

function reply(statusCode, body) {
    return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

async function caller(event) {
    const header = event.headers.authorization || event.headers.Authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    try {
        return await admin.auth().verifyIdToken(token);
    } catch (error) {
        return null;
    }
}

const isAdmin = async uid => (await admin.database().ref(`admins/${uid}`).once('value')).val() === true;

async function softDelete(uid, by) {
    await admin.database().ref(`herbaryo-users/${uid}`).update({
        status: 'deleted',
        deletedAt: admin.database.ServerValue.TIMESTAMP,
        deletedBy: by
    });
    await admin.auth().updateUser(uid, { disabled: true });
    await admin.auth().revokeRefreshTokens(uid);   // signed out everywhere (the game, other browsers)
    await admin.database().ref(`sessions/${uid}`).remove();
}

exports.handler = async event => {
    if (event.httpMethod !== 'POST') return reply(405, { error: 'method' });
    const me = await caller(event);
    if (!me) return reply(401, { error: 'signin' });

    let body = {};
    try {
        body = JSON.parse(event.body || '{}');
    } catch (error) {
        return reply(400, { error: 'body' });
    }
    const action = body.action;
    const target = typeof body.uid === 'string' && body.uid ? body.uid : me.uid;
    const forSomeoneElse = target !== me.uid;

    if (forSomeoneElse || action !== 'delete') {
        if (!(await isAdmin(me.uid))) return reply(403, { error: 'admin' });
        if (forSomeoneElse && await isAdmin(target)) return reply(409, { error: 'target-admin' });   // remove the admin role first
    }

    try {
        if (action === 'delete') {
            await softDelete(target, forSomeoneElse ? 'admin' : 'player');
        } else if (action === 'restore') {
            await admin.database().ref(`herbaryo-users/${target}`).update({ status: null, deletedAt: null, deletedBy: null });
            await admin.auth().updateUser(target, { disabled: false });
        } else if (action === 'purge') {
            await admin.auth().deleteUser(target).catch(error => {
                if (error.code !== 'auth/user-not-found') throw error;   // (already gone)
            });
        } else {
            return reply(400, { error: 'action' });
        }
    } catch (error) {
        console.error('Account action failed:', action, error);
        return reply(500, { error: 'failed' });
    }
    return reply(200, { ok: true });
};
