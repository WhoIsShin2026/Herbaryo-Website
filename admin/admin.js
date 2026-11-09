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

let allUsers = [];

function showAdminAccessStatus(message) {
    const status = document.getElementById('adminAccessStatus');
    status.textContent = message;
    status.hidden = false;
}

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.replace('../index.html#login');
            return;
        }

        db.ref(`admins/${user.uid}`).get().then(snapshot => {
            if (snapshot.val() === true) {
                console.log('Admin verified ✅');
                initAdminUI(user);
                loadUsers();
                initAdminTabs();
                loadReports();
                loadNewsAdmin();
                loadTrialsAdmin();
            } else {
                console.log('Not admin ❌');
                showAdminAccessStatus(
                    `No admin role found for this account. In Realtime Database, set /admins/${user.uid} to the boolean true.`
                );
            }
        }).catch(err => {
            console.error('Error checking admin status:', err);
            showAdminAccessStatus(
                'Could not verify admin access. Check that you are signed in and Firebase rules allow reading /admins/{your-auth-uid}.'
            );
        });
    });

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', applyPlayerFilters);
    }
    const playerTypeFilter = document.getElementById('playerTypeFilter');
    if (playerTypeFilter) playerTypeFilter.addEventListener('change', applyPlayerFilters);

    // The search and the Show choice together; also used when the list reloads after an Edit or Delete.
    function applyPlayerFilters() {
        const query = (searchInput ? searchInput.value : '').toLowerCase();
        const type = playerTypeFilter ? playerTypeFilter.value : '';
        displayUsers(allUsers.filter(u => (!type || u.account_type === type)
            && (u.username.toLowerCase().includes(query) || u.email.toLowerCase().includes(query))));
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            const trigger = logoutBtn;
            const modal = document.createElement('div');
            modal.className = 'user-modal logout-confirm-modal';
            modal.innerHTML = `
                <section class="logout-confirm-dialog" role="alertdialog" aria-modal="true"
                    aria-labelledby="logoutDialogTitle" aria-describedby="logoutDialogDescription">
                    <span class="logout-dialog-kicker">Admin</span>
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
    }

    const adminMenuBtn = document.getElementById('adminMenuBtn');
    const adminActions = document.getElementById('adminActions');
    if (adminMenuBtn && adminActions) {
        const setAdminMenuOpen = isOpen => {
            adminActions.classList.toggle('open', isOpen);
            adminMenuBtn.setAttribute('aria-expanded', String(isOpen));
            adminMenuBtn.setAttribute('aria-label', isOpen ? 'Close admin menu' : 'Open admin menu');
        };

        adminMenuBtn.addEventListener('click', event => {
            event.stopPropagation();
            setAdminMenuOpen(!adminActions.classList.contains('open'));
        });

        document.addEventListener('click', event => {
            if (adminActions.classList.contains('open') && !event.target.closest('.admin-user')) {
                setAdminMenuOpen(false);
            }
        });

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && adminActions.classList.contains('open')) {
                setAdminMenuOpen(false);
                adminMenuBtn.focus();
            }
        });
    }

    const scrollToTopBtn = document.getElementById('scrollToTop');
    if (scrollToTopBtn) {
        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    function initAdminUI(user) {
        const avatar = document.getElementById('adminAvatar');
        if (!avatar) return;

        const displayName = user.displayName || user.email || 'Admin';
        avatar.innerHTML = '';
        avatar.setAttribute('data-initials', displayName.charAt(0).toUpperCase());

        avatar.style.backgroundImage = `url("${HerbaryoSchema.defaultAvatarPath}")`;
        avatar.classList.add('has-photo');
    }

    function normalizePlayer(uid, profile) {
        return {
            ...profile,
            uid,
            username: profile.username || 'Unknown',
            email: profile.email || '',
            account_type: profile.account_type === 'premium' ? 'premium' : 'free',
            photoURL: HerbaryoSchema.normalizeAvatar(profile.photoURL)
        };
    }

    async function loadUsers() {
        try {
            const snapshot = await db.ref('herbaryo-users').once('value');
            const users = [];
            const avatarUpdates = {};

            snapshot.forEach(child => {
                const u = child.val() || {};
                const avatarPath = HerbaryoSchema.normalizeAvatar(u.photoURL);
                if (u.photoURL !== avatarPath) {
                    avatarUpdates[`${child.key}/photoURL`] = avatarPath;
                    u.photoURL = avatarPath;
                }
                users.push(normalizePlayer(child.key, u));
            });

            if (Object.keys(avatarUpdates).length) {
                try {
                    await db.ref('herbaryo-users').update(avatarUpdates);
                } catch (error) {
                    console.error('Failed to update existing player avatars:', error);
                    showAdminToast('Could not save the default avatar for all players. Please try again.', 'error');
                }
            }

            // One check per player: the rules let an admin read each entry, not the whole list.
            const adminFlags = await Promise.all(users.map(user => db.ref(`admins/${user.uid}`).once('value')
                .then(entry => entry.val() === true)
                .catch(() => false)));
            users.forEach((user, index) => { user.isAdmin = adminFlags[index]; });

            users.sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }));
            allUsers = users;
            updateStats(users);
            applyPlayerFilters();
            renderTrials();   // (the Trials list needs the players' names)
        } catch (err) {
            console.error('Failed to load users:', err);
            const tbody = document.querySelector('#usersTable tbody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="3">Failed to load players</td></tr>';
            showAdminAccessStatus(
                'Admin role verified, but player records could not be loaded. Check Firebase rules for admin read access to /herbaryo-users.'
            );
        }
    }

    const adminBadge = `<button class="player-admin-badge" type="button" data-tip="Admin" aria-label="Admin">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 2.8 4.6 5.6v5.9c0 4.7 3.1 8 7.4 9.7 4.3-1.7 7.4-5 7.4-9.7V5.6L12 2.8Z" />
            <path class="shield-half" d="M12 2.8v18.4c4.3-1.7 7.4-5 7.4-9.7V5.6L12 2.8Z" />
        </svg>
    </button>`;

    function displayUsers(filteredUsers) {
        const tbody = document.querySelector('#usersTable tbody');
        if (!tbody) return;

        if (!filteredUsers.length) {
            tbody.innerHTML = '<tr><td colspan="3">No players found</td></tr>';
            return;
        }

        tbody.innerHTML = filteredUsers.map(user => `
            <tr>
                <td>
                    <span class="player-name-cell">
                        <img class="player-avatar" src="${HerbaryoSchema.normalizeAvatar(user.photoURL)}" alt="">
                        <span>${HerbaryoSchema.escapeHtml(user.username)}</span>
                        ${user.isAdmin ? adminBadge : ''}
                        ${user.account_type === 'premium' ? `<img class="player-full-badge" src="${HerbaryoSchema.fullGameIcon}" alt="Full Game" title="Full Game" width="128" height="128">` : ''}
                    </span>
                </td>
                <td>${HerbaryoSchema.escapeHtml(user.email)}</td>
                <td>
                    <button class="action-btn btn-view" data-uid="${user.uid}">View</button>
                    <button class="action-btn btn-edit" data-uid="${user.uid}">Edit</button>
                    ${user.isAdmin ? '' : `<button class="action-btn btn-delete" data-uid="${user.uid}">Delete</button>`}
                </td>
            </tr>
        `).join('');

        document.querySelectorAll('.btn-view').forEach(btn => btn.onclick = () => showUserModal(allUsers.find(u => u.uid === btn.dataset.uid)));
        document.querySelectorAll('.btn-edit').forEach(btn => btn.onclick = () => showEditModal(btn.dataset.uid, allUsers.find(u => u.uid === btn.dataset.uid)));
        document.querySelectorAll('.btn-delete').forEach(btn => btn.onclick = () => deleteUser(btn.dataset.uid, btn));
    }

    function showAdminToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `admin-toast ${type}`;
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
        toast.textContent = message;
        document.body.appendChild(toast);
        window.setTimeout(() => toast.remove(), 3500);
    }

    function deleteUser(uid, trigger) {
        const player = allUsers.find(user => user.uid === uid);
        if (player?.isAdmin) return;   // remove the admin role in Firebase first
        const modal = document.createElement('div');
        modal.className = 'user-modal delete-modal';
        modal.innerHTML = `
            <section class="delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="deleteDialogTitle" aria-describedby="deleteDialogDescription">
                <span class="delete-dialog-kicker">Manage Players</span>
                <h2 id="deleteDialogTitle">Delete ${HerbaryoSchema.escapeHtml(player?.username || 'this player')}?</h2>
                <p id="deleteDialogDescription">This permanently removes the player's profile, progress and achievements, and frees their username. Their reports stay as "Deleted player". Their login is not removed, so they can sign up again as a new player.</p>
                <div class="delete-dialog-actions">
                    <button class="delete-cancel-btn" id="cancelDeleteBtn" type="button">Cancel</button>
                    <button class="delete-confirm-btn" id="confirmDeleteBtn" type="button">Delete player</button>
                </div>
            </section>`;
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        const closeModal = () => {
            modal.remove();
            document.body.style.overflow = '';
            if (trigger?.isConnected) trigger.focus();
        };

        modal.querySelector('#cancelDeleteBtn').onclick = closeModal;
        modal.onclick = event => {
            if (event.target === modal) closeModal();
        };
        modal.onkeydown = event => {
            if (event.key === 'Escape') closeModal();
        };
        modal.querySelector('#cancelDeleteBtn').focus();

        modal.querySelector('#confirmDeleteBtn').onclick = async event => {
            const confirmButton = event.currentTarget;
            confirmButton.disabled = true;
            confirmButton.textContent = 'Deleting...';

            try {
                const updates = await HerbaryoSchema.accountRemovalUpdates(db, uid, player?.username, false);
                await HerbaryoSchema.anonymizeReports(db, uid);
                await db.ref().update(updates);
                closeModal();
                showAdminToast('Player deleted successfully.', 'success');
                await loadUsers();
            } catch (err) {
                console.error('Failed to delete player:', err);
                closeModal();
                showAdminToast('Failed to delete player. Please try again.', 'error');
            }
        };
    }

    function showUserModal(userData) {
        if (!userData) return;

        const achievementLabels = Object.fromEntries(
            HerbaryoSchema.achievementCatalog.map(([key, title]) => [key, title])
        );
        const achievements = userData.achievements || {};
        const unlockedCount = Object.keys(achievementLabels)
            .filter(key => achievements[key] === true).length;
        const modal = document.createElement('div');
        modal.className = 'user-modal';
        modal.innerHTML = `
            <div class="user-modal-content user-view-content">
                <button class="modal-close" type="button" aria-label="Close">&times;</button>
                <div class="view-profile-header">
                    <div class="view-name-row">
                        <img class="view-player-avatar" src="${HerbaryoSchema.normalizeAvatar(userData.photoURL)}" alt="">
                        <h2 class="player-name"></h2>
                        <span class="account-type-badge">${userData.account_type === 'premium' ? 'Full Game' : 'Free'}</span>
                    </div>
                    <p class="player-email"></p>
                </div>
                <section class="view-modal-section">
                    <div class="view-section-heading"><h3>Progress</h3></div>
                    <div class="view-progress"><p class="view-note">Loading progress...</p></div>
                </section>
                <section class="view-modal-section">
                    <div class="view-section-heading"><h3>Trials</h3></div>
                    <div class="view-trials"></div>
                </section>
                <section class="view-modal-section">
                    <div class="view-section-heading">
                        <h3>General Achievements</h3>
                        <strong>${unlockedCount}/${Object.keys(achievementLabels).length}</strong>
                    </div>
                    <div class="view-achievement-grid"></div>
                </section>
            </div>`;
        modal.querySelector('.player-name').textContent = userData.username || 'Unknown';
        modal.querySelector('.player-email').textContent = userData.email || 'No email available';
        modal.querySelector('.view-achievement-grid').innerHTML = Object.entries(achievementLabels)
            .map(([key, title]) => `
                <div class="view-achievement-card ${achievements[key] === true ? 'unlocked' : 'locked'}">
                    <img class="view-achievement-icon" src="${HerbaryoSchema.achievementIcon(key)}" alt="" width="160" height="160">
                    <div>
                        <strong>${title}</strong>
                        <span>${achievements[key] === true ? 'Unlocked' : 'Locked'}</span>
                    </div>
                </div>
            `).join('');
        modal.querySelector('.view-trials').innerHTML = viewTrialsHtml(allTrials[userData.uid]);
        const progressBox = modal.querySelector('.view-progress');
        db.ref(`progress/${userData.uid}`).once('value')
            .then(snapshot => { progressBox.innerHTML = viewProgressHtml(snapshot.val() || {}); })
            .catch(error => {
                console.error('Failed to load the player\'s progress:', error);
                progressBox.innerHTML = '<p class="view-note">Progress could not be loaded right now.</p>';
            });
        document.body.appendChild(modal);
        modal.querySelector('.modal-close').onclick = () => modal.remove();
        modal.onclick = event => { if (event.target === modal) modal.remove(); };
    }

    // ---- View: the player's saves and Trials (read-only)
    function viewPlayTime(minutes) {
        const total = Math.max(0, Math.floor(Number(minutes) || 0));
        return `${Math.floor(total / 60)}h ${total % 60}m`;
    }

    function viewProgressHtml(slots) {
        const esc = HerbaryoSchema.escapeHtml;
        const stat = (label, value, icon) => `
            <div class="view-stat"><span>${icon ? `<img src="${icon}" alt="" width="96" height="96">` : ''}${label}</span><strong>${esc(value ?? 0)}</strong></div>`;
        return [1, 2, 3].map(number => {
            const slot = slots[`slot${number}`];
            if (!slot) return `<p class="view-note"><strong>Slot ${number}</strong> · Empty</p>`;
            const details = [
                slot.lastPlayed ? `Last played ${HerbaryoSchema.formatDate(slot.lastPlayed)}` : '',
                slot.version ? `Version ${esc(slot.version)}` : ''
            ].filter(Boolean).join(' · ');
            return `
                <div class="view-slot">
                    <div class="view-slot-head"><strong>Slot ${number}</strong><span>${details}</span></div>
                    <div class="view-stats-grid view-slot-stats">
                        ${stat('Chapter', slot.chapter)}
                        ${stat('Day', slot.day)}
                        ${stat('Aurels', slot.aurels, HerbaryoSchema.aurelIcon)}
                        ${stat('Aetherion', slot.aetherion, HerbaryoSchema.aetherionIcon)}
                        ${stat('Reputation', slot.reputation, HerbaryoSchema.reputationIcon)}
                        ${stat('Play time', viewPlayTime(slot.playMinutes))}
                    </div>
                </div>`;
        }).join('');
    }

    function viewTrialsHtml(attempts) {
        const esc = HerbaryoSchema.escapeHtml;
        const score = attempt => `${esc(attempt.score)}/${esc(attempt.total)}`;
        const lines = Object.keys(HerbaryoSchema.trialPaths).map(key => {
            const own = Object.values(attempts || {}).filter(attempt => attempt.category === key)
                .sort((a, b) => a.takenAt - b.takenAt);
            if (!own.length) return '';
            return `<p class="view-note"><strong>${esc(HerbaryoSchema.trialPaths[key])}</strong> · First ${score(own[0])} · Latest ${score(own[own.length - 1])}</p>`;
        }).filter(Boolean);
        return lines.join('') || '<p class="view-note">No Trials yet.</p>';
    }

    function showEditModal(uid, userData) {
        if (!userData) return;

        let selectedAvatarPath = HerbaryoSchema.normalizeAvatar(userData.photoURL);
        const modal = document.createElement('div');
        modal.className = 'user-modal';
        modal.innerHTML = `
            <div class="user-modal-content user-edit-content">
                <h2>Edit Player</h2>
                <div class="edit-form">
                    <label class="field-group">
                        <span>Username</span>
                        <input type="text" id="editName" minlength="3" maxlength="14" required>
                    </label>
                    <div class="edit-avatar-section">
                        <span class="edit-avatar-label">Profile avatar</span>
                        <div class="admin-avatar-picker" role="group" aria-label="Choose player avatar">
                            ${HerbaryoSchema.avatarPaths.map(avatarPath => {
                                const avatarName = avatarPath.split('/').pop().replace(/\.[^.]+$/, '').replace(/_/g, ' ');
                                const selected = avatarPath === selectedAvatarPath;
                                return `<button class="admin-avatar-option${selected ? ' selected' : ''}" type="button"
                                    data-avatar-path="${avatarPath}" aria-label="Choose ${avatarName}"
                                    aria-pressed="${selected}">
                                    <img src="${avatarPath}" alt="${avatarName}">
                                </button>`;
                            }).join('')}
                        </div>
                    </div>
                    <label class="field-group">
                        <span>Account Type</span>
                        <select id="editAccountType">
                            <option value="free">Free</option>
                            <option value="premium">Full Game</option>
                        </select>
                    </label>
                    <div class="edit-actions">
                        <button id="cancelEditBtn" class="action-btn btn-delete" type="button">Cancel</button>
                        <button id="saveEditBtn" type="button">Save Changes</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);

        const usernameInput = modal.querySelector('#editName');
        const accountTypeInput = modal.querySelector('#editAccountType');
        usernameInput.value = userData.username || '';
        accountTypeInput.value = userData.account_type === 'premium' ? 'premium' : 'free';
        modal.querySelector('#cancelEditBtn').onclick = () => modal.remove();
        modal.onclick = event => { if (event.target === modal) modal.remove(); };
        modal.querySelector('.admin-avatar-picker').addEventListener('click', event => {
            const option = event.target.closest('.admin-avatar-option');
            if (!option) return;

            selectedAvatarPath = HerbaryoSchema.normalizeAvatar(option.dataset.avatarPath);
            modal.querySelectorAll('.admin-avatar-option').forEach(avatarOption => {
                const selected = avatarOption === option;
                avatarOption.classList.toggle('selected', selected);
                avatarOption.setAttribute('aria-pressed', String(selected));
            });
        });
        modal.querySelector('#saveEditBtn').onclick = async () => {
            if (!usernameInput.checkValidity()) {
                usernameInput.reportValidity();
                return;
            }

            const newUsername = usernameInput.value.trim();
            const usernameChanged = newUsername !== (userData.username || '');
            const usernameProblem = usernameChanged ? HerbaryoSchema.usernameProblem(newUsername) : null;
            if (usernameProblem) {
                showAdminToast(usernameProblem, 'error');
                return;
            }

            const button = modal.querySelector('#saveEditBtn');
            button.disabled = true;
            try {
                const userRef = db.ref(`herbaryo-users/${uid}`);
                await HerbaryoSchema.migrateUser(userRef, {
                    email: userData.email,
                    displayName: userData.username
                });
                const fields = { photoURL: selectedAvatarPath, account_type: accountTypeInput.value };
                if (usernameChanged) {
                    await HerbaryoSchema.saveUsernameAndProfile(db, uid, userData.username, newUsername, fields);
                } else {
                    await userRef.update(fields);
                }
                const snapshot = await userRef.once('value');
                modal.remove();
                await loadUsers();
                if (snapshot.exists()) showUserModal(normalizePlayer(uid, snapshot.val()));
            } catch (error) {
                console.error('Failed to update player:', error);
                button.disabled = false;
                showAdminToast(HerbaryoSchema.usernameErrorText(error, 'Failed to save player changes. Please try again.'), 'error');
            }
        };
    }

    function updateStats(users) {
        const totalUsersEl = document.getElementById('totalUsers');
        if (totalUsersEl) totalUsersEl.textContent = users.length;

        const splitEl = document.getElementById('totalUsersSplit');
        if (splitEl) {
            const fullGame = users.filter(user => user.account_type === 'premium').length;
            splitEl.textContent = `${fullGame} Full Game · ${users.length - fullGame} Free`;
        }
    }

    // ---- The three tabs: Players, Reports, News
    function initAdminTabs() {
        const tabs = document.getElementById('adminTabs');
        tabs.hidden = false;
        tabs.addEventListener('click', event => {
            const tab = event.target.closest('[data-admin-tab]');
            if (!tab) return;

            tabs.querySelectorAll('[data-admin-tab]').forEach(other => {
                const isActive = other === tab;
                other.classList.toggle('active', isActive);
                other.setAttribute('aria-selected', String(isActive));
                document.getElementById(other.dataset.adminTab).hidden = !isActive;
            });
        });
    }

    // ---- The Apprentice's Trial: each player's first and latest score per path, for the capstone
    let allTrials = {};
    let trialRows = [];

    // Average of the first or latest attempts. Falls back to percent while question counts differ.
    function trialAverage(rows, pick) {
        const picked = rows.map(row => pick(row.own));
        const totals = new Set(picked.map(attempt => Number(attempt.total)));
        const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
        if (totals.size === 1) return `${mean(picked.map(attempt => Number(attempt.score))).toFixed(1)}/${[...totals][0]}`;
        return `${mean(picked.map(attempt => Number(attempt.score) / (Number(attempt.total) || 1) * 100)).toFixed(0)}%`;
    }

    // A spreadsheet must never run a name as a formula.
    function csvCell(value) {
        const text = String(value ?? '');
        return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
    }

    function csvDate(milliseconds) {
        const date = new Date(Number(milliseconds));
        if (Number.isNaN(date.getTime())) return '';
        const two = number => String(number).padStart(2, '0');
        return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
    }

    // Score and "out of" are separate columns: a spreadsheet would turn "6/15" into June 15.
    function trialCsv(rows, pathNames) {
        const header = ['Player', 'Path', 'First Score', 'First Out Of', 'First Date', 'Latest Score', 'Latest Out Of', 'Latest Date', 'Attempts'];
        const lines = rows.map(row => {
            const first = row.own[0];
            const latest = row.own[row.own.length - 1];
            return [row.name, pathNames[row.key], first.score, first.total, csvDate(first.takenAt),
                latest.score, latest.total, csvDate(latest.takenAt), row.own.length].map(csvCell).join(',');
        });
        return [header.map(csvCell).join(',')].concat(lines).join('\r\n');
    }

    function downloadTrials() {
        if (!trialRows.length) return;
        const blob = new Blob(['\ufeff' + trialCsv(trialRows, HerbaryoSchema.trialPaths)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `herbaryo-trial-results-${csvDate(Date.now())}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function loadTrialsAdmin() {
        document.getElementById('trialPathFilter').addEventListener('change', renderTrials);
        document.getElementById('trialDownloadBtn').addEventListener('click', downloadTrials);
        db.ref('trial-attempts').on('value', snapshot => {
            allTrials = snapshot.val() || {};
            renderTrials();
        }, error => {
            console.error('Failed to load Trials:', error);
            document.getElementById('adminTrialsList').innerHTML = '<p class="admin-note">Trials could not be loaded.</p>';
        });
    }

    function renderTrials() {
        const esc = HerbaryoSchema.escapeHtml;
        const filter = document.getElementById('trialPathFilter').value;
        const rows = [];
        Object.entries(allTrials).forEach(([uid, attempts]) => {
            const player = allUsers.find(user => user.uid === uid);
            Object.keys(HerbaryoSchema.trialPaths).filter(key => !filter || key === filter).forEach(key => {
                const own = Object.values(attempts || {}).filter(attempt => attempt.category === key)
                    .sort((a, b) => a.takenAt - b.takenAt);
                if (own.length) rows.push({ name: player ? player.username : 'Unknown', key, own });
            });
        });
        rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        trialRows = rows;
        document.getElementById('trialDownloadBtn').disabled = !rows.length;

        document.getElementById('adminTrialSummary').innerHTML = Object.keys(HerbaryoSchema.trialPaths).map(key => {
            const ofPath = rows.filter(row => row.key === key);
            if (!ofPath.length) return '';
            return `
                <article class="admin-card">
                    <div class="admin-card-head">
                        <strong>${esc(HerbaryoSchema.trialPaths[key])}</strong>
                        <span>${ofPath.length} player${ofPath.length === 1 ? '' : 's'}</span>
                        <span>First average ${esc(trialAverage(ofPath, own => own[0]))}</span>
                        <span>Latest average ${esc(trialAverage(ofPath, own => own[own.length - 1]))}</span>
                    </div>
                </article>`;
        }).join('');

        const line = attempt => `${esc(attempt.score)}/${esc(attempt.total)} · ${HerbaryoSchema.formatDate(attempt.takenAt)} · ${esc(HerbaryoSchema.trialMoment(attempt))}`;
        document.getElementById('adminTrialsList').innerHTML = rows.length
            ? rows.map(row => `
                <article class="admin-card">
                    <div class="admin-card-head">
                        <strong>${esc(row.name)}</strong>
                        <span>${esc(HerbaryoSchema.trialPaths[row.key])}</span>
                        <span>${row.own.length} attempt${row.own.length === 1 ? '' : 's'}</span>
                    </div>
                    <p class="admin-card-text">First: ${line(row.own[0])}</p>
                    <p class="admin-card-text">Latest: ${line(row.own[row.own.length - 1])}</p>
                </article>`).join('')
            : '<p class="admin-note">No Trials yet.</p>';
    }

    // ---- Reports
    let allReports = [];

    function loadReports() {
        db.ref('reports').limitToLast(300).on('value', snapshot => {
            allReports = [];
            snapshot.forEach(child => { allReports.push({ ...child.val(), id: child.key }); });
            allReports.reverse();

            const newCount = allReports.filter(report => report.status === 'New').length;
            const badge = document.getElementById('newReportsCount');
            badge.textContent = newCount;
            badge.hidden = newCount === 0;
            renderReports();
        }, error => {
            console.error('Failed to load reports:', error);
            document.getElementById('adminReportsList').innerHTML = '<p class="admin-note">Reports could not be loaded.</p>';
        });

        document.getElementById('reportTypeFilter').addEventListener('change', renderReports);
        document.getElementById('reportStatusFilter').addEventListener('change', renderReports);
        document.getElementById('adminReportsList').addEventListener('click', async event => {
            const button = event.target.closest('[data-report-status]');
            if (!button) return;

            try {
                await db.ref(`reports/${button.dataset.reportId}/status`).set(button.dataset.reportStatus);
            } catch (error) {
                console.error('Failed to update the report:', error);
                showAdminToast('Failed to update the report.', 'error');
            }
        });
    }

    function renderReports() {
        const type = document.getElementById('reportTypeFilter').value;
        const status = document.getElementById('reportStatusFilter').value;
        const reports = allReports.filter(report => (!type || report.type === type) && (!status || report.status === status));
        const list = document.getElementById('adminReportsList');
        const esc = HerbaryoSchema.escapeHtml;

        if (!reports.length) {
            list.innerHTML = '<p class="admin-note">No reports here.</p>';
            return;
        }

        list.innerHTML = reports.map(report => {
            const info = Object.entries(report.info || {}).map(([key, value]) => `${key}: ${value}`).join(' · ');
            return `
                <article class="admin-card">
                    <div class="admin-card-head">
                        <strong>${esc(report.type)}</strong>
                        <span>${esc(report.username)}</span>
                        <span>${HerbaryoSchema.formatDate(report.createdAt)}</span>
                        <span>From ${esc(report.source)}</span>
                    </div>
                    <p class="admin-card-text">${esc(report.message)}</p>
                    ${info ? `<p class="admin-card-info">${esc(info)}</p>` : ''}
                    <div class="admin-status-row">
                        ${['New', 'Seen', 'Fixed'].map(value => `
                            <button class="admin-status-btn${report.status === value ? ' active' : ''}" type="button"
                                data-report-id="${esc(report.id)}" data-report-status="${value}">${value}</button>
                        `).join('')}
                    </div>
                </article>`;
        }).join('');
    }

    // ---- News and the latest version
    const versionPattern = /^\d+(\.\d+){1,3}$/;
    const defaultDownloadLink = document.getElementById('latestLinkInput');

    function loadNewsAdmin() {
        db.ref('meta/latest').once('value').then(snapshot => {
            const latest = snapshot.val() || {};
            document.getElementById('latestVersionInput').value = latest.version || '';
            defaultDownloadLink.value = latest.downloadUrl || 'https://drive.google.com/drive/folders/1fg5rgtoKrS7zhRemYla1BgGeqGggdjDI';
        }).catch(error => console.error('Failed to load the latest version:', error));

        db.ref('meta/buyUrl').once('value').then(snapshot => {
            document.getElementById('buyPageInput').value = snapshot.val() || '';
        }).catch(error => console.error('Failed to load the Buy page link:', error));

        document.getElementById('buyPageForm').addEventListener('submit', async event => {
            event.preventDefault();
            const link = document.getElementById('buyPageInput').value.trim();
            if (!link.startsWith('https://')) {
                showAdminToast('The link must start with https://', 'error');
                return;
            }
            try {
                await db.ref('meta/buyUrl').set(link);
                showAdminToast('Buy page link saved.', 'success');
            } catch (saveError) {
                console.error('Failed to save the Buy page link:', saveError);
                showAdminToast('Failed to save the Buy page link.', 'error');
            }
        });

        document.getElementById('latestVersionForm').addEventListener('submit', async event => {
            event.preventDefault();
            const error = document.getElementById('latestVersionError');
            const version = document.getElementById('latestVersionInput').value.trim();
            const downloadUrl = defaultDownloadLink.value.trim();
            error.textContent = '';
            if (!versionPattern.test(version)) {
                error.textContent = 'Use numbers and dots only, like 0.8.12.';
                return;
            }
            if (!downloadUrl.startsWith('https://')) {
                error.textContent = 'The link must start with https://';
                return;
            }

            try {
                await db.ref('meta/latest').set({ version, downloadUrl });
                showAdminToast('Latest version saved.', 'success');
            } catch (saveError) {
                console.error('Failed to save the latest version:', saveError);
                showAdminToast('Failed to save the latest version.', 'error');
            }
        });

        document.getElementById('newsForm').addEventListener('submit', async event => {
            event.preventDefault();
            const form = event.currentTarget;
            const title = document.getElementById('newsTitle').value.trim();
            const text = document.getElementById('newsText').value.trim();
            const version = document.getElementById('newsVersion').value.trim();
            if (!title || !text) {
                showAdminToast('Please write a title and text.', 'error');
                return;
            }

            const post = { title, text, createdAt: firebase.database.ServerValue.TIMESTAMP };
            if (version) post.version = version;
            try {
                await db.ref('news').push(post);
                form.reset();
                showAdminToast('News posted.', 'success');
            } catch (postError) {
                console.error('Failed to post news:', postError);
                showAdminToast('Failed to post news.', 'error');
            }
        });

        document.getElementById('adminNewsList').addEventListener('click', async event => {
            const button = event.target.closest('[data-news-id]');
            if (!button || !window.confirm('Delete this news post?')) return;

            try {
                await db.ref(`news/${button.dataset.newsId}`).remove();
            } catch (error) {
                console.error('Failed to delete the news post:', error);
                showAdminToast('Failed to delete the news post.', 'error');
            }
        });

        db.ref('news').limitToLast(50).on('value', snapshot => {
            const posts = [];
            snapshot.forEach(child => { posts.push({ ...child.val(), id: child.key }); });
            posts.reverse();
            const esc = HerbaryoSchema.escapeHtml;
            document.getElementById('adminNewsList').innerHTML = posts.length
                ? posts.map(post => `
                    <article class="admin-card">
                        <div class="admin-card-head">
                            <strong>${esc(post.title)}</strong>
                            <span>${HerbaryoSchema.formatDate(post.createdAt)}</span>
                            ${post.version ? `<span>Version ${esc(post.version)}</span>` : ''}
                        </div>
                        <p class="admin-card-text">${esc(post.text)}</p>
                        <div class="admin-status-row">
                            <button class="action-btn btn-delete" type="button" data-news-id="${esc(post.id)}">Delete</button>
                        </div>
                    </article>`).join('')
                : '<p class="admin-note">No news posted yet.</p>';
        }, error => {
            console.error('Failed to load news:', error);
            document.getElementById('adminNewsList').innerHTML = '<p class="admin-note">News could not be loaded.</p>';
        });
    }
});