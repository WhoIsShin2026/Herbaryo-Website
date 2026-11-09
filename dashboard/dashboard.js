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

const generalAchievementCatalog = HerbaryoSchema.achievementCatalog;

let currentUserData = {};
let currentAchievements = {};
let achievementDates = {};
let deletingAccount = false;
let selectedAvatarPath = HerbaryoSchema.defaultAvatarPath;

function getInitials(username = 'Herbalist') {
    return username.trim().charAt(0).toUpperCase() || 'H';
}

function updateUserUI(userData) {
    const displayName = userData.username || 'Herbalist';
    const avatar = document.getElementById('userAvatar');
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    document.getElementById('welcomeText').textContent = `${greeting}, ${displayName}`;
    document.getElementById('usernameValue').textContent = displayName;
    document.getElementById('userEmail').textContent = userData.email || auth.currentUser?.email || '-';
    document.getElementById('accountTypeValue').textContent =
        userData.account_type === 'premium' ? 'Full Game' : 'Free';

    document.getElementById('heroFullBadge').hidden = userData.account_type !== 'premium';
    avatar.textContent = getInitials(displayName);
    avatar.style.backgroundImage = `url("${HerbaryoSchema.normalizeAvatar(userData.photoURL)}")`;
    avatar.style.setProperty('--profile-color', HerbaryoSchema.normalizeColor(userData.color));
    avatar.textContent = '';
}

function unlockedText(key) {
    const date = achievementDates[key] ? HerbaryoSchema.formatDate(achievementDates[key]) : '';
    return date ? `Unlocked · ${date}` : 'Unlocked';
}

function renderAchievements(achievementData = {}) {
    currentAchievements = achievementData;
    const achievements = generalAchievementCatalog.map(([key, title, description]) => ({
        key,
        title,
        description,
        unlocked: achievementData[key] === true
    }));

    const unlockedCount = achievements.filter(achievement => achievement.unlocked).length;
    document.getElementById('achievementCount').textContent = `${unlockedCount}/${achievements.length}`;
    document.getElementById('achievementList').innerHTML = achievements.map(achievement => `
        <button class="achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}"
            type="button" data-achievement-key="${achievement.key}"
            aria-label="View ${achievement.title} achievement details">
            <span class="achievement-icon">
                <img src="${HerbaryoSchema.achievementIcon(achievement.key)}" alt="" width="160" height="160" loading="lazy">
                ${achievement.unlocked ? '' : `<img class="achievement-lock" src="${HerbaryoSchema.achievementLockIcon}" alt="">`}
            </span>
            <span class="achievement-text">
                <strong>${achievement.title}</strong>
                <span>${achievement.unlocked ? unlockedText(achievement.key) : achievement.description}</span>
            </span>
        </button>
    `).join('');
}

const achievementDialog = document.getElementById('achievementDialog');
document.getElementById('achievementList').addEventListener('click', event => {
    const card = event.target.closest('[data-achievement-key]');
    if (!card) return;

    const achievement = generalAchievementCatalog.find(([key]) =>
        key === card.dataset.achievementKey
    );
    if (!achievement) {
        console.error('Unable to find achievement details:', card.dataset.achievementKey);
        return;
    }

    document.getElementById('achievementDialogIcon').src = HerbaryoSchema.achievementIcon(achievement[0]);
    document.getElementById('achievementDialogTitle').textContent = achievement[1];
    document.getElementById('achievementDialogDescription').textContent =
        currentAchievements[achievement[0]] === true
            ? `${achievement[2]}. ${unlockedText(achievement[0])}.`
            : achievement[2];
    achievementDialog.showModal();
});
document.getElementById('closeAchievementDialog').addEventListener('click', () => {
    achievementDialog.close();
});

document.querySelectorAll('[data-section-toggle]').forEach(toggle => {
    toggle.addEventListener('click', () => {
        const content = document.getElementById(toggle.dataset.sectionToggle);
        if (!content) {
            console.error('Unable to toggle dashboard section:', toggle.dataset.sectionToggle);
            return;
        }

        const nextExpanded = content.hidden;
        const sectionName = toggle.dataset.sectionName;

        content.toggleAttribute('hidden', !nextExpanded);
        toggle.setAttribute('aria-expanded', String(nextExpanded));
        toggle.setAttribute('aria-label', `${nextExpanded ? 'Hide' : 'Show'} ${sectionName}`);
        toggle.title = `${nextExpanded ? 'Hide' : 'Show'} ${sectionName}`;
    });
});

const editBtn = document.getElementById('editBtn');
const dashboardMenuBtn = document.getElementById('dashboardMenuBtn');
const dashboardActions = document.getElementById('dashboardActions');

function setDashboardMenuOpen(isOpen) {
    dashboardActions.classList.toggle('open', isOpen);
    dashboardMenuBtn.setAttribute('aria-expanded', String(isOpen));
    dashboardMenuBtn.setAttribute('aria-label', isOpen ? 'Close dashboard menu' : 'Open dashboard menu');
}

dashboardMenuBtn.addEventListener('click', event => {
    event.stopPropagation();
    setDashboardMenuOpen(!dashboardActions.classList.contains('open'));
});

document.addEventListener('click', event => {
    if (dashboardActions.classList.contains('open') && !dashboardActions.contains(event.target)) {
        setDashboardMenuOpen(false);
    }
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dashboardActions.classList.contains('open')) {
        setDashboardMenuOpen(false);
        dashboardMenuBtn.focus();
    }
});

function createProfileModal(className, content) {
    const modal = document.createElement('div');
    modal.className = `profile-modal ${className}`;
    modal.innerHTML = content;
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
        if (event.target === modal) closeProfileModal();
    });
    return modal;
}

const miniProfileModal = createProfileModal('mini-profile-modal', `
    <section class="profile-dialog mini-profile-dialog" role="dialog" aria-modal="true"
        aria-labelledby="miniProfileTitle">
        <button class="edit-close" id="closeMiniProfileBtn" type="button" aria-label="Close profile">&times;</button>
        <span class="edit-kicker">Player account</span>
        <h2 id="miniProfileTitle">Profile</h2>
        <img class="edit-profile-avatar" id="profileAvatarPreview"
            src="${HerbaryoSchema.defaultAvatarPath}" alt="Profile avatar">
        <strong class="edit-profile-username" id="profilePreviewUsername">Herbalist</strong>
        <span class="edit-profile-plan" id="profilePlan">Free</span>
        <span class="edit-profile-email" id="profilePreviewEmail"></span>
        <div class="profile-dialog-actions">
            <button class="btn-save" id="openEditProfileBtn" type="button">Edit username &amp; avatar</button>
            <button class="btn-cancel" id="openChangePasswordBtn" type="button">Change password</button>
        </div>
        <p class="edit-google-note" id="googlePasswordNote" hidden>
            Your password is managed by Google. Change it in your Google Account.
        </p>
    </section>
`);

const editProfileModal = createProfileModal('edit-profile-modal', `
    <form class="edit-form profile-dialog" id="editForm" role="dialog" aria-modal="true"
        aria-labelledby="editProfileTitle">
        <header class="edit-header">
            <div>
                <span class="edit-kicker">Profile settings</span>
                <h2 id="editProfileTitle">Edit username &amp; avatar</h2>
            </div>
            <button class="edit-close" id="closeEditBtn" type="button" aria-label="Close editor">&times;</button>
        </header>
        <label class="edit-field" for="editUsername">Username
            <input type="text" id="editUsername" minlength="3" maxlength="14" autocomplete="username" required>
        </label>
        <fieldset class="profile-color-field">
            <legend class="edit-field">Profile color</legend>
            <div class="profile-color-options" id="profileColorOptions" role="group"
                aria-label="Choose a profile color">
                ${HerbaryoSchema.profileColors.map(option => `
                    <button class="profile-color-option" type="button" data-color="${option.value}"
                        aria-label="${option.label}" aria-pressed="false">
                        <span class="profile-color-swatch" style="--swatch-color: ${option.value}"
                            aria-hidden="true"></span>
                        <span>${option.label}</span>
                    </button>
                `).join('')}
            </div>
        </fieldset>
        <div class="avatar-editor">
            <span class="edit-field">Profile avatar</span>
            <div class="avatar-picker" id="avatarPicker" role="group" aria-label="Choose your profile avatar">
                ${HerbaryoSchema.avatarPaths.map(avatarPath => {
                    const avatarName = avatarPath.split('/').pop().replace('.png', '').replace(/_/g, ' ');
                    return `<button class="avatar-option" type="button" data-avatar-path="${avatarPath}"
                        aria-label="Choose ${avatarName}" aria-pressed="false">
                        <img src="${avatarPath}" alt="">
                    </button>`;
                }).join('')}
            </div>
        </div>
        <p class="edit-error" id="editError" role="alert"></p>
        <div class="edit-buttons">
            <button type="submit" class="btn-save">Save changes</button>
            <button type="button" class="btn-cancel" id="cancelEditBtn">Back to profile</button>
        </div>
    </form>
`);

const changePasswordModal = createProfileModal('change-password-modal', `
    <form class="edit-form profile-dialog" id="passwordForm" role="dialog" aria-modal="true"
        aria-labelledby="changePasswordTitle">
        <header class="edit-header">
            <div>
                <span class="edit-kicker">Security settings</span>
                <h2 id="changePasswordTitle">Change password</h2>
            </div>
            <button class="edit-close" id="closePasswordBtn" type="button" aria-label="Close password form">
                &times;
            </button>
        </header>
        <label class="edit-field" for="editCurrentPassword">Old password
            <input type="password" id="editCurrentPassword" autocomplete="current-password"
                placeholder="Enter your old password" required>
        </label>
        <label class="edit-field" for="editPassword">New password
            <input type="password" id="editPassword" minlength="8" autocomplete="new-password"
                placeholder="At least 8 characters" required>
        </label>
        <p class="edit-note">Your new password must be at least 8 characters.</p>
        <p class="edit-error" id="passwordError" role="alert"></p>
        <div class="edit-buttons">
            <button type="submit" class="btn-save">Update password</button>
            <button type="button" class="btn-cancel" id="cancelPasswordBtn">Back to profile</button>
        </div>
    </form>
`);

const currentPasswordInput = document.getElementById('editCurrentPassword');
const newPasswordInput = document.getElementById('editPassword');
const editUsernameInput = document.getElementById('editUsername');
const avatarPicker = document.getElementById('avatarPicker');
const googlePasswordNote = document.getElementById('googlePasswordNote');
const profileColorOptions = document.getElementById('profileColorOptions');
let previousProfileModalOverflow = '';
let previousEditTrigger = null;
let activeProfileModal = null;
let selectedProfileColor = HerbaryoSchema.defaultProfileColor;

function selectAvatar(avatarPath) {
    selectedAvatarPath = HerbaryoSchema.normalizeAvatar(avatarPath);
    editProfileModal.querySelectorAll('.avatar-option').forEach(option => {
        const isSelected = option.dataset.avatarPath === selectedAvatarPath;
        option.classList.toggle('selected', isSelected);
        option.setAttribute('aria-pressed', String(isSelected));
    });
}

avatarPicker.addEventListener('click', event => {
    const option = event.target.closest('.avatar-option');
    if (option) selectAvatar(option.dataset.avatarPath);
});

function selectProfileColor(color) {
    selectedProfileColor = HerbaryoSchema.normalizeColor(color);
    profileColorOptions.querySelectorAll('.profile-color-option').forEach(option => {
        const isSelected = option.dataset.color === selectedProfileColor;
        option.classList.toggle('selected', isSelected);
        option.setAttribute('aria-pressed', String(isSelected));
    });
}

profileColorOptions.addEventListener('click', event => {
    const option = event.target.closest('.profile-color-option');
    if (option) selectProfileColor(option.dataset.color);
});

function openProfileModal(modal, focusSelector) {
    if (!activeProfileModal) previousProfileModalOverflow = document.body.style.overflow;
    if (activeProfileModal) activeProfileModal.classList.remove('active');
    activeProfileModal = modal;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    modal.querySelector(focusSelector)?.focus();
}

function closeProfileModal() {
    if (!activeProfileModal) return;
    activeProfileModal.classList.remove('active');
    activeProfileModal = null;
    document.body.style.overflow = previousProfileModalOverflow;
    if (previousEditTrigger?.isConnected) previousEditTrigger.focus();
}

function openMiniProfile(focusSelector = '#openEditProfileBtn') {
    const user = auth.currentUser;
    const hasPasswordProvider = user?.providerData.some(provider => provider.providerId === 'password');
    document.getElementById('profilePreviewUsername').textContent = currentUserData.username || 'Herbalist';
    document.getElementById('profilePreviewEmail').textContent =
        currentUserData.email || user?.email || '';
    document.getElementById('profileAvatarPreview').src =
        HerbaryoSchema.normalizeAvatar(currentUserData.photoURL);
    document.getElementById('profileAvatarPreview').style.setProperty(
        '--profile-color',
        HerbaryoSchema.normalizeColor(currentUserData.color)
    );
    const isPremium = currentUserData.account_type === 'premium';
    const planBadge = document.getElementById('profilePlan');
    planBadge.textContent = isPremium ? 'Full Game' : 'Free';
    planBadge.classList.toggle('premium', isPremium);
    document.getElementById('openChangePasswordBtn').hidden = !hasPasswordProvider;
    googlePasswordNote.hidden = hasPasswordProvider;
    openProfileModal(miniProfileModal, focusSelector);
}

editBtn.addEventListener('click', () => {
    setDashboardMenuOpen(false);
    previousEditTrigger = editBtn;
    editUsernameInput.value = currentUserData.username || '';
    selectProfileColor(currentUserData.color);
    selectAvatar(currentUserData.photoURL);
    document.getElementById('editError').textContent = '';
    openMiniProfile();
});

document.getElementById('openEditProfileBtn').addEventListener('click', () => {
    document.getElementById('editError').textContent = '';
    openProfileModal(editProfileModal, '#editUsername');
});

document.getElementById('openChangePasswordBtn').addEventListener('click', () => {
    document.getElementById('passwordError').textContent = '';
    currentPasswordInput.value = '';
    newPasswordInput.value = '';
    openProfileModal(changePasswordModal, '#editCurrentPassword');
});

document.getElementById('closeMiniProfileBtn').addEventListener('click', closeProfileModal);
document.getElementById('closeEditBtn').addEventListener('click', closeProfileModal);
document.getElementById('closePasswordBtn').addEventListener('click', closeProfileModal);
document.getElementById('cancelEditBtn').addEventListener('click', () => openMiniProfile('#openEditProfileBtn'));
document.getElementById('cancelPasswordBtn').addEventListener('click', () => openMiniProfile('#openChangePasswordBtn'));
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && activeProfileModal) {
        closeProfileModal();
    }
});

document.getElementById('editForm').addEventListener('submit', async event => {
    event.preventDefault();
    const error = document.getElementById('editError');
    const username = document.getElementById('editUsername').value.trim();
    const usernameChanged = username !== (currentUserData.username || '');
    const usernameProblem = usernameChanged ? HerbaryoSchema.usernameProblem(username) : null;

    if (usernameProblem) {
        error.textContent = usernameProblem;
        return;
    }

    try {
        const fields = { photoURL: selectedAvatarPath, color: selectedProfileColor };
        if (usernameChanged) {
            await HerbaryoSchema.saveUsernameAndProfile(
                db, auth.currentUser.uid, currentUserData.username, username, fields
            );
            document.getElementById('usernameNotice')?.remove();
        } else {
            await db.ref(`herbaryo-users/${auth.currentUser.uid}`).update(fields);
        }
        currentUserData = {
            ...currentUserData,
            username,
            photoURL: selectedAvatarPath,
            color: selectedProfileColor
        };
        updateUserUI(currentUserData);
        openMiniProfile('#openEditProfileBtn');
    } catch (updateError) {
        console.error(updateError);
        error.textContent = HerbaryoSchema.usernameErrorText(updateError, 'Unable to save your profile right now.');
    }
});

document.getElementById('passwordForm').addEventListener('submit', async event => {
    event.preventDefault();
    const error = document.getElementById('passwordError');
    const currentPassword = currentPasswordInput.value;
    const password = newPasswordInput.value;

    if (password.length < 8) {
        error.textContent = 'New password must be at least 8 characters.';
        return;
    }

    try {
        const credential = firebase.auth.EmailAuthProvider.credential(
            auth.currentUser.email,
            currentPassword
        );
        await auth.currentUser.reauthenticateWithCredential(credential);
        await auth.currentUser.updatePassword(password);
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        openMiniProfile('#openChangePasswordBtn');
    } catch (updateError) {
        console.error(updateError);
        if (['auth/wrong-password', 'auth/invalid-credential'].includes(updateError.code)) {
            error.textContent = 'Your current password is incorrect.';
        } else if (updateError.code === 'auth/requires-recent-login') {
            error.textContent = 'Please sign in again before changing your password.';
        } else {
            error.textContent = 'Unable to change your password right now.';
        }
    }
});

auth.onAuthStateChanged(async user => {
    if (!user) {
        window.location.replace('../index.html');
        return;
    }

    const userRef = db.ref(`herbaryo-users/${user.uid}`);

    let migratedProfile;
    try {
        migratedProfile = await HerbaryoSchema.migrateUser(userRef, user);
    } catch (error) {
        console.error('Failed to migrate player profile:', error);
        const notice = document.createElement('p');
        notice.className = 'profile-migration-error';
        notice.setAttribute('role', 'alert');
        notice.textContent =
            'Your account data could not be updated. Please ask an administrator to run the database migration.';
        document.querySelector('main')?.prepend(notice);
        return;
    }

    checkUsernameReserved(user.uid, migratedProfile.username);
    showVerifyNotice(user);
    watchPlayerData(user.uid);

    userRef.on('value', snapshot => {
        if (deletingAccount) return;
        const data = snapshot.val() || {};
        currentUserData = data;

        const adminBtn = document.getElementById('adminBtn');
        db.ref(`admins/${user.uid}`).get()
            .then(adminSnap => {
                adminBtn.style.display = adminSnap.val() === true ? 'inline-block' : 'none';
            })
            .catch(error => {
                console.error('Failed to check admin status:', error);
                let status = document.getElementById('adminAccessError');
                if (!status) {
                    status = document.createElement('p');
                    status.id = 'adminAccessError';
                    status.className = 'profile-migration-error';
                    status.setAttribute('role', 'alert');
                    document.querySelector('main')?.prepend(status);
                }
                status.textContent =
                    'Could not check admin access. Verify Firebase rules allow reading /admins/{your-auth-uid}.';
            });
        adminBtn.onclick = () => {
            setDashboardMenuOpen(false);
            window.location.href = '../admin/admin.html';
        };

        updateUserUI(data);
        renderAchievements(data.achievements || {});
    });
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
    setDashboardMenuOpen(false);
    const trigger = document.getElementById('logoutBtn');
    const modal = document.createElement('div');
    modal.className = 'logout-confirm-modal';
    modal.innerHTML = `
        <section class="logout-confirm-dialog" role="alertdialog" aria-modal="true"
            aria-labelledby="logoutDialogTitle" aria-describedby="logoutDialogDescription">
            <span class="logout-dialog-kicker">Dashboard</span>
            <h2 id="logoutDialogTitle">Log out?</h2>
            <p id="logoutDialogDescription">Are you sure you want to log out of your account?</p>
            <p class="logout-dialog-error" role="alert" hidden></p>
            <div class="logout-dialog-actions">
                <button class="logout-cancel-btn" type="button">Cancel</button>
                <button class="logout-confirm-btn" type="button">Log out</button>
            </div>
        </section>`;
    document.body.appendChild(modal);
    const previousOverflow = document.body.style.overflow;
    let isSigningOut = false;
    document.body.style.overflow = 'hidden';

    const closeModal = () => {
        if (isSigningOut) return;
        modal.remove();
        document.body.style.overflow = previousOverflow;
        document.removeEventListener('keydown', handleKeydown);
        if (trigger.isConnected) trigger.focus();
    };
    const handleKeydown = event => {
        if (event.key === 'Escape') closeModal();
    };

    const cancelButton = modal.querySelector('.logout-cancel-btn');
    cancelButton.addEventListener('click', closeModal);
    modal.addEventListener('click', event => {
        if (event.target === modal) closeModal();
    });
    document.addEventListener('keydown', handleKeydown);
    modal.querySelector('.logout-cancel-btn').focus();

    modal.querySelector('.logout-confirm-btn').addEventListener('click', async event => {
        const confirmButton = event.currentTarget;
        const error = modal.querySelector('.logout-dialog-error');
        isSigningOut = true;
        confirmButton.disabled = true;
        cancelButton.disabled = true;
        confirmButton.textContent = 'Logging out...';

        try {
            await auth.signOut();
            isSigningOut = false;
            closeModal();
            window.location.replace('../index.html');
        } catch (signOutError) {
            console.error('Failed to log out:', signOutError);
            error.textContent = 'Unable to log out right now. Please try again.';
            error.hidden = false;
            isSigningOut = false;
            confirmButton.disabled = false;
            cancelButton.disabled = false;
            confirmButton.textContent = 'Log out';
        }
    });
});

// ---- Username reserved, like the game's
async function checkUsernameReserved(uid, username) {
    try {
        if (await HerbaryoSchema.reserveExistingUsername(db, uid, username)) return;
        const notice = document.createElement('p');
        notice.id = 'usernameNotice';
        notice.className = 'profile-migration-error';
        notice.setAttribute('role', 'alert');
        notice.textContent =
            'Your username cannot be used in the game. Tap Edit and choose a new one (3-14 letters, numbers or _).';
        document.querySelector('main')?.prepend(notice);
    } catch (error) {
        console.error('Failed to reserve the username:', error);
    }
}

// ---- What the game sends: progress and achievement dates; and this player's own reports
function watchPlayerData(uid) {
    db.ref(`progress/${uid}`).on('value', snapshot => {
        if (!deletingAccount) renderProgress(snapshot.val() || {});
    }, error => {
        console.error('Failed to load progress:', error);
        document.getElementById('progressContent').innerHTML =
            '<p class="panel-note">Your progress could not be loaded right now.</p>';
    });

    db.ref(`trial-attempts/${uid}`).on('value', snapshot => {
        if (deletingAccount) return;
        const attempts = [];
        snapshot.forEach(child => { attempts.push(child.val()); });
        renderTrials(attempts.reverse());
    }, error => {
        console.error('Failed to load Trials:', error);
        document.getElementById('myTrials').innerHTML = '<p class="panel-note">Your Trials could not be loaded right now.</p>';
    });

    db.ref(`achievement-dates/${uid}`).on('value', snapshot => {
        if (deletingAccount) return;
        achievementDates = snapshot.val() || {};
        renderAchievements(currentAchievements);
    }, error => console.error('Failed to load achievement dates:', error));

    db.ref('reports').orderByChild('uid').equalTo(uid).on('value', snapshot => {
        if (deletingAccount) return;
        const reports = [];
        snapshot.forEach(child => { reports.push(child.val()); });
        renderMyReports(reports.reverse());
    }, error => {
        console.error('Failed to load reports:', error);
        document.getElementById('myReports').innerHTML =
            '<p class="panel-note">Your reports could not be loaded right now.</p>';
    });
}

function playTimeText(minutes) {
    const total = Math.max(0, Math.floor(Number(minutes) || 0));
    return `${Math.floor(total / 60)}h ${total % 60}m`;
}

function renderProgress(slots) {
    const stat = (label, value, icon) => `
        <div class="stat-card"><span>${icon ? `<img src="${icon}" alt="" width="96" height="96">` : ''}${label}</span><strong>${HerbaryoSchema.escapeHtml(value)}</strong></div>`;

    document.getElementById('progressContent').innerHTML = [1, 2, 3].map(number => {
        const slot = slots[`slot${number}`];
        if (!slot) {
            return `<article class="progress-slot empty"><h3>Slot ${number}</h3><p>Empty slot</p></article>`;
        }
        const details = [
            slot.lastPlayed ? `Last played ${HerbaryoSchema.formatDate(slot.lastPlayed)}` : '',
            slot.version ? `Version ${HerbaryoSchema.escapeHtml(slot.version)}` : ''
        ].filter(Boolean).join(' · ');
        return `
            <article class="progress-slot">
                <div class="progress-slot-head"><h3>Slot ${number}</h3><span>${details}</span></div>
                <div class="save-stats">
                    ${stat('Chapter', slot.chapter)}
                    ${stat('Day', slot.day)}
                    ${stat('Aurels', slot.aurels, HerbaryoSchema.aurelIcon)}
                    ${stat('Aetherion', slot.aetherion ?? 0, HerbaryoSchema.aetherionIcon)}
                    ${stat('Reputation', slot.reputation, HerbaryoSchema.reputationIcon)}
                    ${stat('Play time', playTimeText(slot.playMinutes))}
                </div>
            </article>`;
    }).join('');
}

function renderMyReports(reports) {
    const list = document.getElementById('myReports');
    if (!reports.length) {
        list.innerHTML = '<p class="panel-note">You have not sent any reports yet.</p>';
        return;
    }

    list.innerHTML = reports.map(report => {
        const status = ['New', 'Seen', 'Fixed'].includes(report.status) ? report.status : 'New';
        return `
            <article class="report-card">
                <div class="report-card-head">
                    <strong>${HerbaryoSchema.escapeHtml(report.type)}</strong>
                    <span>${HerbaryoSchema.formatDate(report.createdAt)}</span>
                    <span class="report-status ${status.toLowerCase()}">${status}</span>
                </div>
                <p>${HerbaryoSchema.escapeHtml(report.message)}</p>
            </article>`;
    }).join('');
}

// ---- Report / Feedback: the report and its time go up together, so the database can hold it to one a minute
const reportMessage = document.getElementById('reportMessage');
reportMessage.addEventListener('input', () => {
    document.getElementById('reportCount').textContent = `${reportMessage.value.length}/1000`;
});

document.getElementById('reportForm').addEventListener('submit', async event => {
    event.preventDefault();
    const error = document.getElementById('reportError');
    const button = document.getElementById('reportSendBtn');
    const message = reportMessage.value.trim();
    const user = auth.currentUser;
    error.textContent = '';
    if (!user) return;
    if (!message) {
        error.textContent = 'Please write your message first.';
        return;
    }

    const timestamp = firebase.database.ServerValue.TIMESTAMP;
    const id = db.ref('reports').push().key;
    button.disabled = true;
    try {
        await db.ref().update({
            [`reports/${id}`]: {
                uid: user.uid,
                username: String(currentUserData.username || 'Herbalist').slice(0, 30),
                type: document.getElementById('reportType').value,
                message,
                source: 'website',
                status: 'New',
                createdAt: timestamp,
                info: { device: navigator.userAgent.slice(0, 80) }
            },
            [`report-times/${user.uid}`]: timestamp
        });
        reportMessage.value = '';
        document.getElementById('reportCount').textContent = '0/1000';
    } catch (sendError) {
        console.error('Failed to send report:', sendError);
        error.textContent = String(sendError.code || sendError.message).toUpperCase().includes('PERMISSION')
            ? 'You can send one report per minute. Please wait and try again.'
            : 'Unable to send your report right now.';
    } finally {
        button.disabled = false;
    }
});

// ---- Delete My Account
const deleteAccountModal = createProfileModal('delete-account-modal', `
    <form class="edit-form profile-dialog" id="deleteAccountForm" role="alertdialog" aria-modal="true"
        aria-labelledby="deleteAccountTitle">
        <header class="edit-header">
            <div>
                <span class="edit-kicker">This cannot be undone</span>
                <h2 id="deleteAccountTitle">Delete your account?</h2>
            </div>
            <button class="edit-close" id="closeDeleteAccountBtn" type="button" aria-label="Close">&times;</button>
        </header>
        <p class="edit-note">Your account, username, progress and achievements will be removed. Your reports stay
            with the team as "Deleted player".</p>
        <label class="edit-field delete-account-field" for="deleteConfirmName">Type your username to confirm
            <input type="text" id="deleteConfirmName" autocomplete="off" required>
        </label>
        <label class="edit-field" id="deletePasswordField" for="deletePassword">Your password
            <input type="password" id="deletePassword" autocomplete="current-password">
        </label>
        <p class="edit-google-note" id="deleteGoogleNote" hidden>Google will ask you to sign in once more.</p>
        <p class="edit-error" id="deleteAccountError" role="alert"></p>
        <div class="edit-buttons">
            <button type="button" class="btn-cancel" id="cancelDeleteAccountBtn">Keep my account</button>
            <button type="submit" class="delete-account-btn" id="confirmDeleteAccountBtn">Delete forever</button>
        </div>
    </form>
`);

function deleteAccountHasPassword() {
    return auth.currentUser?.providerData.some(provider => provider.providerId === 'password') === true;
}

document.getElementById('deleteAccountBtn').addEventListener('click', event => {
    previousEditTrigger = event.currentTarget;
    const hasPassword = deleteAccountHasPassword();
    document.getElementById('deleteConfirmName').value = '';
    document.getElementById('deletePassword').value = '';
    document.getElementById('deleteAccountError').textContent = '';
    document.getElementById('deletePasswordField').hidden = !hasPassword;
    document.getElementById('deletePassword').required = hasPassword;
    document.getElementById('deleteGoogleNote').hidden = hasPassword;
    openProfileModal(deleteAccountModal, '#deleteConfirmName');
});
document.getElementById('closeDeleteAccountBtn').addEventListener('click', closeProfileModal);
document.getElementById('cancelDeleteAccountBtn').addEventListener('click', closeProfileModal);

async function confirmIdentity(user) {
    if (deleteAccountHasPassword()) {
        const credential = firebase.auth.EmailAuthProvider.credential(
            user.email,
            document.getElementById('deletePassword').value
        );
        await user.reauthenticateWithCredential(credential);
    } else {
        await user.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
    }
}

function deleteAccountErrorText(error) {
    if (['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(error.code)) {
        return 'Your password is incorrect. Nothing was deleted.';
    }
    if (error.code === 'auth/user-mismatch') return 'Please choose the Google account you signed up with.';
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        return 'Sign-in was cancelled. Nothing was deleted.';
    }
    if (error.code === 'auth/popup-blocked') return 'Please allow pop-ups for this site and try again.';
    return 'Unable to delete your account right now. Please try again.';
}

document.getElementById('deleteAccountForm').addEventListener('submit', async event => {
    event.preventDefault();
    const user = auth.currentUser;
    const error = document.getElementById('deleteAccountError');
    const button = document.getElementById('confirmDeleteAccountBtn');
    const username = currentUserData.username || '';
    error.textContent = '';
    if (!user) return;
    if (document.getElementById('deleteConfirmName').value.trim() !== username) {
        error.textContent = 'That is not your username. Nothing was deleted.';
        return;
    }

    button.disabled = true;
    button.textContent = 'Deleting...';
    try {
        const adminSnapshot = await db.ref(`admins/${user.uid}`).get();
        if (adminSnapshot.val() === true) {
            error.textContent = 'This is an admin account. Remove it from admins in Firebase first.';
            return;
        }
        await confirmIdentity(user);

        // The data goes first: once the account itself is gone, the rules can't allow anything.
        deletingAccount = true;
        const updates = await HerbaryoSchema.accountRemovalUpdates(db, user.uid, username, true);
        await HerbaryoSchema.anonymizeReports(db, user.uid);
        await db.ref().update(updates);
        await user.delete();
        window.location.replace('../index.html');
    } catch (deleteError) {
        console.error('Failed to delete the account:', deleteError);
        deletingAccount = false;
        error.textContent = deleteAccountErrorText(deleteError);
    } finally {
        button.disabled = false;
        button.textContent = 'Delete forever';
    }
});

// ---- Verify your email: a reminder only - a correct email and password always log in
async function showVerifyNotice(user) {
    try {
        await user.reload();   // (a link clicked in another tab or on the phone)
    } catch (error) {
        console.error('Failed to refresh the account:', error);
    }
    document.getElementById('verifyNotice').hidden = auth.currentUser?.emailVerified !== false;
}

document.getElementById('resendVerifyBtn').addEventListener('click', async event => {
    const button = event.currentTarget;
    const status = document.getElementById('verifyStatus');
    const user = auth.currentUser;
    if (!user) return;

    button.disabled = true;
    try {
        await user.sendEmailVerification({ url: new URL('../index.html?emailVerification=success', window.location.href).href });
        status.textContent = 'Verification email sent. Please check your inbox and spam folder.';
        window.setTimeout(() => { button.disabled = false; }, 60000);
    } catch (error) {
        console.error('Failed to resend the verification email:', error);
        status.textContent = error.code === 'auth/too-many-requests'
            ? 'Too many tries. Please wait a moment and try again.'
            : 'Unable to send the email right now. Please try again.';
        button.disabled = false;
    }
});

// ---- The Apprentice's Trial: every attempt taken in the game
function renderTrials(attempts) {
    const esc = HerbaryoSchema.escapeHtml;
    document.getElementById('trialBest').innerHTML = Object.entries(HerbaryoSchema.trialPaths).map(([key, name]) => {
        const own = attempts.filter(attempt => attempt.category === key);
        const best = own.reduce((top, attempt) => (!top || attempt.score > top.score ? attempt : top), null);
        const perfect = best && best.score >= best.total;
        return `
            <div class="stat-card trial-best">
                <span>${name}</span>
                <strong>${best ? `${esc(best.score)}/${esc(best.total)}` : '--'}</strong>
                ${perfect ? `<em class="trial-perfect"><img src="${HerbaryoSchema.fullGameIcon}" alt="" width="128" height="128">Perfect</em>` : ''}
            </div>`;
    }).join('');

    const list = document.getElementById('myTrials');
    if (!attempts.length) {
        list.innerHTML = '<p class="panel-note">You have not taken the Trial yet. Open the game and tap Trial on the Main Menu.</p>';
        return;
    }
    list.innerHTML = attempts.map(attempt => `
        <article class="report-card">
            <div class="report-card-head">
                <strong>${esc(HerbaryoSchema.trialPaths[attempt.category] || attempt.category)}</strong>
                <span>${HerbaryoSchema.formatDate(attempt.takenAt)}</span>
                <span>${esc(HerbaryoSchema.trialMoment(attempt))}</span>
                <span class="report-status ${attempt.score >= attempt.total ? 'fixed' : ''}">${esc(attempt.score)}/${esc(attempt.total)}</span>
            </div>
        </article>`).join('');
}
