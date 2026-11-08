// Starts a payment for the signed-in player. The server decides who is paying and how much: nothing the browser sends can change either.
// PAYMENT_MODE = "paymongo" uses PayMongo; anything else (the default) uses the Simulated Checkout page.
const { PRICE_CENTAVOS, checkBuyer } = require('../lib/purchase');

function reply(statusCode, body) {
    return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

exports.handler = async event => {
    if (event.httpMethod !== 'POST') return reply(405, { error: 'method' });

    const buyer = await checkBuyer(event);
    if (buyer.error) return reply(buyer.status, { error: buyer.error });
    if (process.env.PAYMENT_MODE !== 'paymongo') return reply(200, { url: '/buy/checkout.html' });

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
                    metadata: { uid: buyer.player.uid },
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
