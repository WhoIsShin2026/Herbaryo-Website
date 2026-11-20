// The server's Firebase access. The private key lives only in Netlify's environment variables, never in the code.
const admin = require('firebase-admin');

const config = require('../../main/firebase-config.js');   // the one place that names the project

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: config.projectId,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
        }),
        databaseURL: config.databaseURL.replace(/\/$/, '')
    });
}

module.exports = { admin };
