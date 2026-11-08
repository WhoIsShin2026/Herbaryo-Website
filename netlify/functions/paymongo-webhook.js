// PayMongo tells this address when a checkout is paid. Only a correctly signed message for the full price makes an account premium.
// Safe to receive twice: a repeat just writes the same result. (So PayMongo's retries, which can be much later, are not refused by age.)
const crypto = require('crypto');
const { PRICE_CENTAVOS, grantFullGame } = require('../lib/purchase');

function reply(statusCode, body) {
    return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

// Header: t=<time>,te=<test signature>,li=<live signature> - signed text: <time>.<the raw body>
function signatureIsGood(header, rawBody, secret) {
    const parts = Object.fromEntries(String(header || '').split(',').map(part => {
        const at = part.indexOf('=');
        return [part.slice(0, at).trim(), part.slice(at + 1).trim()];
    }));
    const sent = parts.te || parts.li;
    if (!parts.t || !sent || !secret) return false;
    const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
    const a = Buffer.from(sent), b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

exports.handler = async event => {
    if (event.httpMethod !== 'POST') return reply(405, { error: 'method' });

    const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
    const header = event.headers['paymongo-signature'] || event.headers['Paymongo-Signature'];
    if (!signatureIsGood(header, rawBody, process.env.PAYMONGO_WEBHOOK_SECRET)) return reply(401, { error: 'signature' });

    const message = JSON.parse(rawBody);
    const attributes = message.data && message.data.attributes;
    if (!attributes || attributes.type !== 'checkout_session.payment.paid') return reply(200, { received: true });

    const session = attributes.data;
    const uid = session && session.attributes && session.attributes.metadata && session.attributes.metadata.uid;
    const paid = ((session && session.attributes && session.attributes.payments) || [])
        .find(payment => payment.attributes && payment.attributes.status === 'paid');
    if (!uid || !paid || paid.attributes.amount !== PRICE_CENTAVOS) {
        console.error('A paid checkout could not be matched:', session && session.id);
        return reply(200, { received: true });
    }

    await grantFullGame(uid, session.id, { livemode: attributes.livemode === true });
    return reply(200, { received: true });
};

exports.signatureIsGood = signatureIsGood;
