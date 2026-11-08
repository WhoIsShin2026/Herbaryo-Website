// The Simulated Checkout's Pay button: no money moves, but the account check and the unlock are the real ones.
// It only works while PayMongo is switched off.
const crypto = require('crypto');
const { grantFullGame, checkBuyer } = require('../lib/purchase');

const METHODS = ['gcash', 'maya', 'card'];

function reply(statusCode, body) {
    return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

exports.handler = async event => {
    if (event.httpMethod !== 'POST') return reply(405, { error: 'method' });
    if (process.env.PAYMENT_MODE === 'paymongo') return reply(403, { error: 'off' });

    const buyer = await checkBuyer(event);
    if (buyer.error) return reply(buyer.status, { error: buyer.error });

    let method = '';
    try {
        method = JSON.parse(event.body || '{}').method;
    } catch (error) {
        return reply(400, { error: 'method' });
    }
    if (!METHODS.includes(method)) return reply(400, { error: 'method' });

    await grantFullGame(buyer.player.uid, `sim_${crypto.randomUUID()}`, { method, simulated: true, livemode: false });
    return reply(200, { paid: true });
};
