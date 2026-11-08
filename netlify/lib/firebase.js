// The server's Firebase access. The private key lives only in Netlify's environment variables, never in the code.
const admin = require('firebase-admin');

const DATABASE_URL = 'https://login-4baca-default-rtdb.asia-southeast1.firebasedatabase.app';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: 'login-4baca',
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
        }),
        databaseURL: DATABASE_URL
    });
}

module.exports = { admin };
