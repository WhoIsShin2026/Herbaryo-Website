firebase.initializeApp({
    apiKey: "AIzaSyCGhmcMfla7-mfYwzxcy1XxZ-24vZqVSS0",
    authDomain: "login-4baca.firebaseapp.com",
    databaseURL: "https://login-4baca-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "login-4baca",
    storageBucket: "login-4baca.firebasestorage.app",
    messagingSenderId: "874293361860",
    appId: "1:874293361860:web:65808ac513134660fcdd91"
});
const auth = firebase.auth();
const db = firebase.database();
const message = document.getElementById('checkoutMessage');

function backToBuyPage() {
    window.location.replace('./buy.html');
}

auth.onAuthStateChanged(async user => {
    if (!user) {
        backToBuyPage();
        return;
    }
    try {
        await user.reload();
        const profile = (await db.ref(`herbaryo-users/${user.uid}`).once('value')).val();
        if (!profile || !profile.username || profile.account_type === 'premium' || !auth.currentUser.emailVerified) {
            backToBuyPage();
            return;
        }
        document.getElementById('checkoutName').textContent = profile.username;
        document.getElementById('checkoutLoading').hidden = true;
        document.getElementById('checkoutForm').hidden = false;
    } catch (error) {
        console.error('Failed to load the checkout:', error);
        message.textContent = 'Unable to load the checkout right now. Please try again.';
    }
});

document.getElementById('checkoutForm').addEventListener('submit', async event => {
    event.preventDefault();
    const pay = document.getElementById('checkoutPay');
    pay.disabled = true;
    message.textContent = '';
    try {
        const token = await auth.currentUser.getIdToken(true);
        const response = await fetch('/.netlify/functions/simulate-payment', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ method: document.querySelector('input[name="method"]:checked').value })
        });
        if (response.ok || response.status === 409) {
            window.location.replace('./buy.html?paid=1');
            return;
        }
        message.textContent = 'Unable to complete the payment right now. Please try again.';
    } catch (error) {
        console.error('Failed to complete the payment:', error);
        message.textContent = 'Unable to complete the payment right now. Please try again.';
    }
    pay.disabled = false;
});

document.getElementById('checkoutFail').addEventListener('click', () => {
    message.textContent = 'Payment failed (simulated). You were not charged. Please try again.';
});
