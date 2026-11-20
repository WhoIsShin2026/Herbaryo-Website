// The ONE place that names the Firebase project - every page and the Netlify functions read it from here.
// Moving to another Firebase project = change only these values (Firebase console > Project settings > Your apps > Web app).
// (Moved 2026-11-21 from login-4baca to Shin's own project "herbaryo".)
(function (config) {
    if (typeof module !== 'undefined' && module.exports) module.exports = config;   // Netlify functions (netlify/lib/firebase.js)
    else window.HerbaryoFirebaseConfig = config;                                    // the pages
})({
    apiKey: "AIzaSyB53z4ZM_Gr7-9uHx6gG6kYUnRvdZu5VBc",
    authDomain: "herbaryo.firebaseapp.com",
    databaseURL: "https://herbaryo-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "herbaryo",
    storageBucket: "herbaryo.firebasestorage.app",
    messagingSenderId: "327612352738",
    appId: "1:327612352738:web:2769278fded9bdf8c8f6bb"
});
