const firebaseConfig = {
    apiKey: "AIzaSyCGhmcMfla7-mfYwzxcy1XxZ-24vZqVSS0",
    authDomain: "login-4baca.firebaseapp.com",
    databaseURL: "https://login-4baca-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "login-4baca",
    storageBucket: "login-4baca.firebasestorage.app",
    messagingSenderId: "874293361860",
    appId: "1:874293361860:web:65808ac513134660fcdd91"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

const loginModal = document.getElementById('loginModal');
const closeModal = document.getElementById('closeModal');
let selectedProfileAvatar = HerbaryoSchema.defaultAvatarPath;

function showError(message, isSuccess = false) {
    clearError();
    const errorEl = document.createElement('div');
    errorEl.className = isSuccess ? 'success-message' : 'error-message';
    errorEl.textContent = message;
    const activeTab = document.querySelector('.tab-content.active');
    const targetContainer = activeTab?.querySelector('.auth-error-container')
        || loginModal?.querySelector('.auth-error-container');
    if (!targetContainer) {
        console.error('Unable to display authentication message:', message);
        return;
    }
    targetContainer.appendChild(errorEl);
    setTimeout(() => errorEl.remove(), 5000);
}

function clearError() {
    document.querySelectorAll('.auth-error-container').forEach(container => {
        container.querySelectorAll('.error-message, .success-message').forEach(message => message.remove());
    });
}
function showLoading() {
    const activeTab = document.querySelector('.tab-content.active');
    const loading = activeTab?.querySelector('.loading')
        || loginModal?.querySelector('.loading');
    if (loading) loading.style.display = 'flex';
}
function hideLoading() {
    document.querySelectorAll('.loading').forEach(loading => {
        loading.style.display = 'none';
    });
}

if (closeModal && loginModal) closeModal.addEventListener('click', () => closeLoginModal());
if (loginModal) loginModal.addEventListener('click', e => { if (e.target === loginModal) closeLoginModal(); });
function closeLoginModal() {
    loginModal.classList.remove('active');
    document.body.style.overflow = '';
    clearError();
}

if (document.getElementById('emailLoginBtn')) document.getElementById('emailLoginBtn').addEventListener('click', handleEmailLogin);
if (document.getElementById('emailSignupBtn')) document.getElementById('emailSignupBtn').addEventListener('click', handleEmailSignup);

document.querySelectorAll('.password-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
        const passwordInput = document.getElementById(toggle.dataset.passwordTarget);
        const isVisible = passwordInput.type === 'text';

        passwordInput.type = isVisible ? 'password' : 'text';
        toggle.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
        toggle.setAttribute('aria-pressed', String(!isVisible));
        toggle.querySelector('.password-eye-slash').classList.toggle('visible', !isVisible);
    });
});

['loginEmail', 'loginPassword'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleEmailLogin();
        }
    });
});

['signupEmail', 'signupPassword', 'confirmPassword'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleEmailSignup();
        }
    });
});

function normalizeLoginEmail(email) {
    const value = email.trim();
    if (!value || value.includes('@')) return value;
    return `${value}@gmail.com`;
}

async function handleEmailLogin() {
    const email = normalizeLoginEmail(document.getElementById('loginEmail').value);
    const password = document.getElementById('loginPassword').value;
    showLoading();
    try {
        const result = await auth.signInWithEmailAndPassword(email, password);
        await checkUserProfile(result.user);
    } catch (error) {
        console.error('Email login failed:', error);
        showError(emailLoginErrorText(error));
    } finally { hideLoading(); }
}

// One message for a refused sign-in: it never says whether the email exists or how the account signs in.
function emailLoginErrorText(error) {
    switch (error.code) {
        case 'auth/invalid-email': return "That email address isn't valid.";
        case 'auth/network-request-failed': return 'No internet connection. Check it and try again.';
        case 'auth/too-many-requests': return 'Too many tries. Wait a moment and try again.';
        case 'auth/user-disabled': return 'This account has been turned off. Ask the admin.';
        default: return 'Wrong email or password. Signed up with Google? Use the Google button.';
    }
}

async function handleEmailSignup() {
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    if (!email || !password || !confirmPassword) return showError('Please fill all fields');
    if (password.length < 8) return showError('Password must be 8+ characters');
    if (password !== confirmPassword) return showError('Passwords do not match');
    const agreementsAccepted = [
        'acceptPrivacyPolicy',
        'acceptTermsOfService',
        'acceptEula'
    ].every(id => document.getElementById(id).checked);
    if (!agreementsAccepted) {
        return showError('Please accept the Privacy Policy, Terms of Service, and EULA to create an account.');
    }

    showLoading();
    try {
        const result = await auth.createUserWithEmailAndPassword(email, password);
        const actionCodeSettings = ['http:', 'https:'].includes(window.location.protocol)
            ? { url: new URL('./index.html?emailVerification=success', window.location.href).href }
            : undefined;
        await result.user.sendEmailVerification(actionCodeSettings);
        showUsernameModal(result.user);
        showError('We sent a verification link to your email.', true);
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') showError('Email already registered. Try login.');
        else showError(error.message);
    } finally { hideLoading(); }
}

if (document.getElementById('googleLogin')) document.getElementById('googleLogin').addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    showLoading();
    try {
        const result = await auth.signInWithPopup(provider);
        const needsProfileSetup = await ensureGoogleProfile(result.user);
        if (needsProfileSetup) {
            showUsernameModal(result.user);
            showError('Google sign-in successful! Choose your username and avatar to finish setup.', true);
            return;
        }
        window.location.replace('./dashboard/dashboard.html');
    } catch (error) {
        showError('Google login failed: ' + error.message);
    } finally { hideLoading(); }
});

async function ensureGoogleProfile(user) {
    const userRef = db.ref(`herbaryo-users/${user.uid}`);
    const usernameSnapshot = await userRef.child('username').once('value');
    if (usernameSnapshot.val()) return false;

    const snapshot = await userRef.once('value');

    if (!snapshot.exists()) {
        const defaultUsername = user.email?.split('@')[0] || user.displayName || 'Herbalist';
        await userRef.set(HerbaryoSchema.createDefaultProfile(user, defaultUsername));
        return true;
    }

    return false;
}

async function checkUserProfile(user) {
    if (!user) return;
    const userRef = db.ref(`herbaryo-users/${user.uid}`);
    const usernameSnapshot = await userRef.child('username').once('value');
    if (usernameSnapshot.val()) {
        window.location.replace('./dashboard/dashboard.html');
    } else {
        showUsernameModal(user);
    }
}

function showUsernameModal(user) {
    const activeTab = document.getElementById('loginTab');
    document.getElementById('signupTab').classList.remove('active');
    activeTab.classList.add('active');
    loginModal.classList.add('profile-setup-active');
    document.getElementById('loginModalTitle').textContent = 'Complete Your Profile';
    selectedProfileAvatar = HerbaryoSchema.defaultAvatarPath;
    activeTab.innerHTML = `
        <div class="profile-setup">
            <p class="profile-setup-prompt">Choose your username and avatar:</p>
            <input type="text" id="usernameInput" placeholder="3-14 letters, numbers or _" maxlength="14">
            <div class="profile-avatar-section">
                <span class="profile-avatar-label">Choose your avatar</span>
                <div class="profile-avatar-picker" id="profileAvatarPicker" role="group"
                    aria-label="Choose your profile avatar">
                    ${HerbaryoSchema.avatarPaths.map(avatarPath => {
                        const avatarName = avatarPath.split('/').pop().replace(/\.png$/i, '').replace(/_/g, ' ');
                        const imagePath = avatarPath.replace('../img/', './img/');
                        const isSelected = avatarPath === selectedProfileAvatar;
                        return `<button class="profile-avatar-option${isSelected ? ' selected' : ''}"
                            type="button" data-avatar-path="${avatarPath}" aria-label="Choose ${avatarName}"
                            aria-pressed="${isSelected}">
                            <img src="${imagePath}" alt="${avatarName}">
                            <span>${avatarName}</span>
                        </button>`;
                    }).join('')}
                </div>
            </div>
            <div class="auth-error-container">
                <div class="loading" style="display: none;">
                    <div class="spinner"></div> Signing you in...
                </div>
            </div>
            <button id="createProfileBtn" class="btn-primary profile-create-btn" type="button">Create Profile</button>
        </div>
    `;
    const usernameInput = document.getElementById('usernameInput');
    usernameInput.value = (
        user.email?.split('@')[0] || user.displayName || ''
    ).replace(/[^A-Za-z0-9_]/g, '').slice(0, 14);
    document.getElementById('profileAvatarPicker').addEventListener('click', event => {
        const option = event.target.closest('.profile-avatar-option');
        if (!option) return;

        selectedProfileAvatar = HerbaryoSchema.normalizeAvatar(option.dataset.avatarPath);
        document.querySelectorAll('.profile-avatar-option').forEach(avatarOption => {
            const isSelected = avatarOption === option;
            avatarOption.classList.toggle('selected', isSelected);
            avatarOption.setAttribute('aria-pressed', String(isSelected));
        });
    });
    usernameInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            createProfile(user);
        }
    });
    setTimeout(() => {
        document.getElementById('createProfileBtn').onclick = () => createProfile(user);
    }, 100);
}

async function createProfile(user) {
    const username = document.getElementById('usernameInput').value.trim();
    const usernameProblem = HerbaryoSchema.usernameProblem(username);
    if (usernameProblem) return showError(usernameProblem);

    showLoading();
    try {
        await saveNewUserProfile(user, username);
        window.location.replace('./dashboard/dashboard.html');
    } catch (error) {
        console.error('Failed to save profile:', error);
        showError(HerbaryoSchema.usernameErrorText(error, 'Failed to save profile'));
    } finally { hideLoading(); }
}

async function saveNewUserProfile(user, usernameInput) {
    const uid = user.uid;
    if (await HerbaryoSchema.usernameIsTaken(db, uid, usernameInput)) throw HerbaryoSchema.usernameTakenError();

    const userRef = db.ref(`herbaryo-users/${uid}`);
    const userSnap = await userRef.once('value');
    const oldUsername = userSnap.val()?.username || '';
    if (userSnap.exists()) await HerbaryoSchema.migrateUser(userRef, user);
    else await userRef.set(HerbaryoSchema.createDefaultProfile(user, usernameInput));

    await HerbaryoSchema.saveUsernameAndProfile(db, uid, oldUsername, usernameInput, {
        email: user.email || '',
        photoURL: selectedProfileAvatar
    });
}

auth.onAuthStateChanged(user => {
    const authBtn = document.getElementById('authBtn');
    const dashboardNavItem = document.getElementById('dashboardNavItem');
    if (dashboardNavItem) dashboardNavItem.hidden = !user;
    authBtn.classList.toggle('is-logout', Boolean(user));
    if (user) {
        authBtn.textContent = 'Logout';
        authBtn.onclick = async e => { e.preventDefault(); await auth.signOut(); authBtn.textContent = 'Login →'; };
    } else if (loginModal) {
        authBtn.textContent = 'Login →';
        authBtn.onclick = e => { e.preventDefault(); loginModal.classList.add('active'); document.body.style.overflow = 'hidden'; };
    }
});

if (document.getElementById('showSignupTab')) document.getElementById('showSignupTab').addEventListener('click', event => {
    event.preventDefault();
    document.getElementById('loginTab').classList.remove('active');
    document.getElementById('signupTab').classList.add('active');
    loginModal.classList.remove('profile-setup-active');
    document.getElementById('loginModalTitle').textContent = 'Create Account';
});

if (document.getElementById('showLoginTab')) document.getElementById('showLoginTab').addEventListener('click', event => {
    event.preventDefault();
    document.getElementById('signupTab').classList.remove('active');
    document.getElementById('loginTab').classList.add('active');
    loginModal.classList.remove('profile-setup-active');
    document.getElementById('loginModalTitle').textContent = 'Login';
});

document.addEventListener('DOMContentLoaded', () => {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const navMenu = document.getElementById('navMenu');
    const navContainer = hamburgerBtn?.closest('.nav-container');
    const backToTop = document.getElementById('backToTop');
    const specVersionButtons = document.querySelectorAll('[data-spec-version]');
    const specCards = document.querySelectorAll('[data-spec-card]');
    const screenshotPreview = document.getElementById('screenshotPreview');
    const screenshotPreviewImage = document.getElementById('screenshotPreviewImage');
    const screenshotPreviewClose = document.querySelector('.screenshot-preview-close');
    const legalDialogs = document.querySelectorAll('.legal-dialog');

    document.querySelectorAll('[data-legal-dialog]').forEach(link => {
        link.addEventListener('click', event => {
            const dialog = document.getElementById(link.dataset.legalDialog);
            if (!(dialog instanceof HTMLDialogElement)) {
                console.error('Unable to open legal document:', link.dataset.legalDialog);
                return;
            }

            event.preventDefault();
            if (!dialog.open) dialog.showModal();
        });
    });

    // The game's Sign In card links straight to a document (.../#eulaDialog).
    const linkedDialog = document.getElementById(window.location.hash.slice(1));
    if (linkedDialog instanceof HTMLDialogElement && linkedDialog.classList.contains('legal-dialog')) linkedDialog.showModal();

    legalDialogs.forEach(dialog => {
        dialog.querySelector('[data-close-legal]')?.addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', event => {
            if (event.target === dialog) dialog.close();
        });
    });

    if (screenshotPreview && screenshotPreviewImage && screenshotPreviewClose) {
        let screenshotCloseTimer;
        const closeScreenshotPreview = () => {
            if (!screenshotPreview.open || screenshotPreview.classList.contains('closing')) return;
            screenshotPreview.classList.add('closing');
            screenshotCloseTimer = window.setTimeout(() => {
                screenshotPreview.close();
                screenshotPreview.classList.remove('closing');
            }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160);
        };

        document.querySelectorAll('.screenshot-trigger').forEach(trigger => {
            trigger.addEventListener('click', event => {
                const image = trigger.querySelector('img');
                if (!image) return;

                event.preventDefault();
                window.clearTimeout(screenshotCloseTimer);
                screenshotPreview.classList.remove('closing');
                screenshotPreviewImage.src = image.currentSrc || image.src;
                screenshotPreviewImage.alt = image.alt;
                screenshotPreview.showModal();
                screenshotPreviewClose.focus();
            });
        });

        screenshotPreviewClose.addEventListener('click', closeScreenshotPreview);
        screenshotPreview.addEventListener('click', event => {
            if (event.target === screenshotPreview) closeScreenshotPreview();
        });
        screenshotPreview.addEventListener('cancel', event => {
            event.preventDefault();
            closeScreenshotPreview();
        });
    }

    const sectionLinks = navMenu
        ? Array.from(navMenu.querySelectorAll('a')).map(link => ({
            link,
            section: document.getElementById(new URL(link.href).hash.slice(1))
        })).filter(item => item.section)
        : [];

    if (sectionLinks.length) {
        const updateActiveSection = () => {
            const navBottom = document.querySelector('.navbar')?.getBoundingClientRect().bottom ?? 0;
            let activeLink = sectionLinks[0];

            sectionLinks.forEach(item => {
                if (item.section.getBoundingClientRect().top <= navBottom + 24) {
                    activeLink = item;
                }
            });

            if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
                activeLink = sectionLinks[sectionLinks.length - 1];
            }

            sectionLinks.forEach(item => {
                const isActive = item === activeLink;
                item.link.classList.toggle('active', isActive);
                if (isActive) {
                    item.link.setAttribute('aria-current', 'location');
                } else {
                    item.link.removeAttribute('aria-current');
                }
            });
        };

        window.addEventListener('scroll', updateActiveSection, { passive: true });
        window.addEventListener('resize', updateActiveSection);
        updateActiveSection();
    }

    specVersionButtons.forEach(button => {
        button.addEventListener('click', () => {
            const selectedLevel = button.dataset.specVersion;

            specVersionButtons.forEach(versionButton => {
                const isSelected = versionButton === button;
                versionButton.classList.toggle('active', isSelected);
                versionButton.setAttribute('aria-pressed', String(isSelected));
            });

            specCards.forEach(card => {
                card.classList.toggle('active', card.dataset.specCard === selectedLevel);
            });

            const selectedCard = document.querySelector(`[data-spec-card="${selectedLevel}"]`);
            if (selectedCard && window.matchMedia('(max-width: 768px)').matches) {
                selectedCard.scrollIntoView({
                    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                    block: 'nearest'
                });
            }
        });
    });

    if (backToTop) {
        const updateBackToTopVisibility = () => {
            backToTop.hidden = window.scrollY <= 300;
        };

        window.addEventListener('scroll', updateBackToTopVisibility, { passive: true });
        updateBackToTopVisibility();
        backToTop.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
            });
        });
    }

    if (!hamburgerBtn || !navMenu || !navContainer) {
        console.error('Hamburger or navMenu not found');
        return;
    }

    const closeMenu = () => {
        navMenu.classList.remove('active');
        hamburgerBtn.classList.remove('active');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
        hamburgerBtn.setAttribute('aria-label', 'Open navigation menu');
    };

    hamburgerBtn.addEventListener('click', () => {
        const isOpen = navMenu.classList.toggle('active');
        hamburgerBtn.classList.toggle('active', isOpen);
        hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
        hamburgerBtn.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
    });

    navMenu.addEventListener('click', event => {
        if (event.target.closest('a')) closeMenu();
    });

    document.addEventListener('click', (e) => {
        if (navMenu.classList.contains('active') && !navContainer.contains(e.target)) {
            closeMenu();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navMenu.classList.contains('active')) {
            closeMenu();
            hamburgerBtn.focus();
        }
    });
});

if (document.getElementById('forgotPasswordBtn')) document.getElementById('forgotPasswordBtn').addEventListener('click', async (e) => {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();

    if (!email) {
        return showError('Please enter your email first.');
    }

    showLoading();

    try {
        await auth.sendPasswordResetEmail(email);

        showError(
            'Password reset email sent! Check your inbox.',
            true
        );

    } catch (error) {

        switch (error.code) {

            case 'auth/user-not-found':
                showError('No account found with this email.');
                break;

            case 'auth/invalid-email':
                showError('Please enter a valid email.');
                break;

            default:
                showError(error.message);
        }

    } finally {
        hideLoading();
    }
});

if (loginModal && window.location.hash === '#login') {
    loginModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

async function handleEmailVerificationRedirect() {
    if (!loginModal) return;

    const currentUrl = new URL(window.location.href);
    const params = currentUrl.searchParams;
    const isContinueUrl = params.get('emailVerification') === 'success';
    const verificationCode = params.get('oobCode');
    const isDirectVerification = params.get('mode') === 'verifyEmail' && verificationCode;

    if (!isContinueUrl && !isDirectVerification) return;

    try {
        if (isDirectVerification) {
            await auth.applyActionCode(verificationCode);
        }

        ['emailVerification', 'mode', 'oobCode', 'apiKey', 'continueUrl', 'lang'].forEach(key => {
            params.delete(key);
        });
        window.history.replaceState({}, '', currentUrl);

        // Still signed in on this browser: straight back to the Dashboard (its reminder is gone now).
        const signedIn = await new Promise(resolve => {
            const stop = auth.onAuthStateChanged(user => { stop(); resolve(user); });
        });
        if (signedIn) {
            window.location.replace('./dashboard/dashboard.html');
            return;
        }

        document.getElementById('signupTab').classList.remove('active');
        document.getElementById('loginTab').classList.add('active');
        loginModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        showError('Your email is verified. You can now sign in.', true);
    } catch (error) {
        showError('Email verification failed: ' + error.message);
    }
}

handleEmailVerificationRedirect();

// Home page: the latest news, and the download link + version the team set in Admin.
async function loadNews() {
    const list = document.getElementById('newsList');
    if (!list) return;

    try {
        const snapshot = await db.ref('news').limitToLast(3).once('value');
        const posts = [];
        snapshot.forEach(child => { posts.push(child.val()); });
        posts.reverse();
        list.innerHTML = posts.length
            ? posts.map(post => `
                <article class="news-card">
                    <div class="news-card-meta">
                        <span>${HerbaryoSchema.formatDate(post.createdAt)}</span>
                        ${post.version ? `<span>Version ${HerbaryoSchema.escapeHtml(post.version)}</span>` : ''}
                    </div>
                    <h3>${HerbaryoSchema.escapeHtml(post.title)}</h3>
                    <p>${HerbaryoSchema.escapeHtml(post.text)}</p>
                </article>
            `).join('')
            : '<p class="news-empty">No news yet. Check back soon.</p>';
    } catch (error) {
        console.error('Failed to load news:', error);
        list.innerHTML = '<p class="news-empty">News could not be loaded right now.</p>';
    }
}

async function loadLatestVersion() {
    const link = document.getElementById('downloadLink');
    if (!link) return;

    try {
        const snapshot = await db.ref('meta/latest').once('value');
        const latest = snapshot.val();
        if (!latest) return;
        if (String(latest.downloadUrl || '').startsWith('https://')) link.href = latest.downloadUrl;
        const version = document.getElementById('latestVersion');
        if (version && latest.version) {
            version.textContent = `Latest version: ${latest.version}`;
            version.hidden = false;
        }
    } catch (error) {
        console.error('Failed to load the latest version:', error);   // the button keeps its usual link
    }
}

loadNews();
loadLatestVersion();
