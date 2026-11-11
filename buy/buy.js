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

const justPaid = new URLSearchParams(window.location.search).get('paid') === '1';
const steps = ['stepLoading', 'stepSignIn', 'stepProfile', 'stepVerify', 'stepBuy', 'stepWaiting', 'stepOwned'];
const message = document.getElementById('buyMessage');
let watched = null;

function show(step) {
    steps.forEach(id => { document.getElementById(id).hidden = id !== step; });
}

function say(text) {
    message.textContent = text;
}

function signInErrorText(error) {
    switch (error.code) {
        case 'auth/invalid-email': return "That email address isn't valid.";
        case 'auth/network-request-failed': return 'No internet connection. Check it and try again.';
        case 'auth/too-many-requests': return 'Too many tries. Wait a moment and try again.';
        case 'auth/user-disabled': return 'This account has been turned off. Ask the admin.';
        case 'auth/popup-closed-by-user':
        case 'auth/cancelled-popup-request': return '';
        default: return 'Wrong email or password. Signed up with Google? Use the Google button.';
    }
}

function showAccount(user, profile) {
    if (!profile || !profile.username) {
        show('stepProfile');
        return;
    }
    if (profile.account_type === 'premium') {
        document.getElementById('ownedText').textContent = justPaid
            ? 'Thank you! The Full Game is now on your account. Go back to the game to play.'
            : 'You own the Full Game. Go back to the game to play.';
        say('');
        show('stepOwned');
        return;
    }
    if (justPaid) {
        show('stepWaiting');   // PayMongo's message can arrive a few seconds after this page
        return;
    }
    if (!user.emailVerified) {
        show('stepVerify');
        return;
    }
    document.getElementById('buyName').textContent = profile.username;
    document.getElementById('buyAccountEmail').textContent = user.email || '';
    show('stepBuy');
}

auth.onAuthStateChanged(async user => {
    if (watched) { watched.off(); watched = null; }
    say('');
    document.getElementById('buySignOut').hidden = !user;
    if (!user) {
        show('stepSignIn');
        return;
    }
    show('stepLoading');
    try {
        await user.reload();
    } catch (error) {
        console.error('Failed to refresh the account:', error);
    }
    watched = db.ref(`herbaryo-users/${user.uid}`);
    watched.on('value', snapshot => showAccount(auth.currentUser || user, snapshot.val()), error => {
        console.error('Failed to read the account:', error);
        say('Your account could not be loaded right now.');
    });
});

document.getElementById('stepSignIn').addEventListener('submit', async event => {
    event.preventDefault();
    say('');
    try {
        await auth.signInWithEmailAndPassword(
            document.getElementById('buyEmail').value.trim(),
            document.getElementById('buyPassword').value
        );
    } catch (error) {
        console.error('Sign-in failed:', error);
        say(signInErrorText(error));
    }
});

document.getElementById('buyGoogle').addEventListener('click', async () => {
    say('');
    try {
        await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    } catch (error) {
        console.error('Google sign-in failed:', error);
        say(signInErrorText(error));
    }
});

document.getElementById('buySignOut').addEventListener('click', () => auth.signOut());

document.getElementById('buyResend').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
        await auth.currentUser.sendEmailVerification({ url: window.location.href.split('?')[0] });
        say('Verification email sent. Please check your inbox and spam folder.');
        window.setTimeout(() => { button.disabled = false; }, 60000);
    } catch (error) {
        console.error('Failed to resend the verification email:', error);
        say(error.code === 'auth/too-many-requests'
            ? 'Too many tries. Please wait a moment and try again.'
            : 'Unable to send the email right now. Please try again.');
        button.disabled = false;
    }
});

document.getElementById('buyNow').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    say('');
    try {
        const token = await auth.currentUser.getIdToken(true);
        const response = await fetch('/.netlify/functions/create-checkout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await response.json().catch(() => ({}));
        if (response.ok && result.url) {
            window.location.href = result.url;
            return;
        }
        if (result.error === 'verify') show('stepVerify');
        else if (result.error === 'unavailable') say('The store is not open yet. Please try again later.');
        else say('Unable to start the payment right now. Please try again.');
    } catch (error) {
        console.error('Failed to start the payment:', error);
        say('Unable to start the payment right now. Please try again.');
    }
    button.disabled = false;
});
