// Starts a payment for the signed-in player. The server decides who is paying and how much: nothing the browser sends can change either.
const { admin } = require('../lib/firebase');

const PRICE_CENTAVOS = 4900;   // P49

function reply(statusCode, body) {
    return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

exports.handler = async event => {
    if (event.httpMethod !== 'POST') return reply(405, { error: 'method' });

    const header = event.headers.authorization || event.headers.Authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    let player;
    try {
        player = await admin.auth().verifyIdToken(token);
    } catch (error) {
        return reply(401, { error: 'signin' });
    }
    if (player.email_verified !== true) return reply(403, { error: 'verify' });

    const record = (await admin.database().ref(`herbaryo-users/${player.uid}`).once('value')).val();
    if (!record || !record.username) return reply(404, { error: 'profile' });
    if (record.account_type === 'premium') return reply(409, { error: 'owned' });

    const site = process.env.URL;
    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${Buffer.from(`${process.env.PAYMONGO_SECRET_KEY}:`).toString('base64')}`
        },
        body: JSON.stringify({
            data: {
                attributes: {
                    line_items: [{ name: 'Herbaryo Full Game', quantity: 1, amount: PRICE_CENTAVOS, currency: 'PHP' }],
                    payment_method_types: ['gcash', 'paymaya', 'card'],
                    description: 'Herbaryo Full Game: Chapters 2 and 3, Co-op',
                    metadata: { uid: player.uid },
                    success_url: `${site}/buy/buy.html?paid=1`,
                    cancel_url: `${site}/buy/buy.html`
                }
            }
        })
    });

    const session = await response.json().catch(() => null);
    const url = session && session.data && session.data.attributes && session.data.attributes.checkout_url;
    if (!response.ok || !url) {
        console.error('PayMongo refused the checkout:', response.status, JSON.stringify(session));
        return reply(502, { error: 'paymongo' });
    }
    return reply(200, { url });
};
