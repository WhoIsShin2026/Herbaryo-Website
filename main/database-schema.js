(function () {
    // The one list of achievements: key, title, how to earn it. The game uses the same keys.
    const achievementCatalog = [
        ['hello_world', 'Hello, World!', 'First login into the game'],
        ['becoming_an_apprentice', 'Becoming an Apprentice', 'Complete the tutorial'],
        ['first_harvest', 'First Harvest', 'Cut your first plant and put it in your bag'],
        ['chris_first_study', "Chris's First Study", 'Have Chris verify your first plant'],
        ['we_need_to_cook', 'We need to Cook', 'Make your first remedy'],
        ['first_patient_helped', 'First Patient Helped', 'Help your first patient with your remedy'],
        ['serious_dedication', 'Serious Dedication', 'Survive 20 days'],
        ['good_neighbour', 'Good Neighbour', 'Keep 100 reputation for 5 days in a row'],
        ['chapter_3_reached', 'Chapter 3 Reached', 'Reach Chapter 3'],
        ['a_whole_new_world', 'A Whole New World', "Join another player's world"],
        ['master_herbalist', 'Master Herbalist', 'Master all 10 herbs'],
        ['press_b_button', 'Press B Button', 'Purchase a boots upgrade'],
        ['brochure_expert', 'Brochure Expert', 'Purchase all upgrades'],
        ['no_more_limits', 'No More Limits', 'Buy the full version of the game']
    ];
    const generalAchievementKeys = achievementCatalog.map(([key]) => key);
    // The same 10 avatars as the game (Avatar01-Avatar10); the game and the website both save the chosen one in photoURL.
    const avatarPaths = [
        'Avatar01.png', 'Avatar02.png', 'Avatar03.png', 'Avatar04.png', 'Avatar05.png',
        'Avatar06.png', 'Avatar07.png', 'Avatar08.png', 'Avatar09.png', 'Avatar10.png'
    ].map(filename => `../img/avatars/${filename}`);
    const defaultAvatarPath = '../img/avatars/Avatar02.png';
    const profileColors = [
        { value: '#8DC46E', label: 'Fresh Leaf Green' },
        { value: '#D9A24C', label: 'Golden Mustard' },
        { value: '#739ECC', label: 'Dusty Blue' },
        { value: '#C7738C', label: 'Dusty Rose' },
        { value: '#CC784C', label: 'Burnt Orange' },
        { value: '#9478B8', label: 'Muted Lavender' }
    ];
    const defaultProfileColor = profileColors[0].value;

    function normalizeAvatar(avatarPath) {
        return avatarPaths.includes(avatarPath) ? avatarPath : defaultAvatarPath;
    }

    function normalizeColor(color) {
        return profileColors.find(option =>
            option.value.toLowerCase() === String(color).toLowerCase()
        )?.value || defaultProfileColor;
    }

    function createAchievementMap(source = {}) {
        const achievements = Object.fromEntries(generalAchievementKeys.map(key => [
            key,
            source[key] === true
        ]));
        return achievements;
    }

    function getLegacyAchievementSources(profile) {
        const sources = [];
        const profileAchievements = profile.achievements || {};
        sources.push(profileAchievements.general || profileAchievements);

        for (const save of Object.values(profile.saves || {})) {
            if (save && typeof save === 'object') {
                sources.push(save.achievements?.general || {});
            }
        }

        if (profile.saveData?.achievements?.general) {
            sources.push(profile.saveData.achievements.general);
        }
        return sources;
    }

    function createDefaultProfile(user, username) {
        return {
            email: user.email || '',
            account_type: 'free',
            photoURL: defaultAvatarPath,
            color: defaultProfileColor,
            username: username || user.email?.split('@')[0] || user.displayName || 'Herbalist',
            achievements: createAchievementMap()
        };
    }

    async function migrateUser(userRef, authUser = {}) {
        const snapshot = await userRef.once('value');
        const profile = snapshot.val() || {};
        const achievementSources = getLegacyAchievementSources(profile);
        const achievements = Object.fromEntries(generalAchievementKeys.map(key => [
            key,
            achievementSources.some(source =>
                source[key] === true
            )
            || (key === 'no_more_limits' && (profile.account_type === 'premium' || profile.isPremium === true))
        ]));
        const accountType = profile.account_type === 'premium' || profile.account_type === 'free'
            ? profile.account_type
            : profile.isPremium === true ? 'premium' : 'free';
        const username = profile.username
            || authUser.email?.split('@')[0]
            || authUser.displayName
            || 'Herbalist';
        const updates = {
            email: profile.email || authUser.email || '',
            account_type: accountType,
            photoURL: normalizeAvatar(profile.photoURL),
            color: normalizeColor(profile.color),
            username,
            achievements
        };

        const accountFields = new Set(['email', 'account_type', 'photoURL', 'color', 'username', 'achievements']);
        for (const existingField of Object.keys(profile)) {
            if (!accountFields.has(existingField)) updates[existingField] = null;
        }
        await userRef.update(updates);
        return { ...updates };
    }

    // ---- Usernames: the same rule as the game, and each name reserved in usernames/<lowercase name> = uid.
    const usernamePattern = /^[A-Za-z0-9_]{3,14}$/;

    function usernameKey(username) {
        return String(username || '').trim().toLowerCase();
    }

    function isValidUsername(username) {
        return usernamePattern.test(String(username || '').trim());
    }

    function usernameProblem(username) {
        const name = String(username || '').trim();
        if (name.length < 3 || name.length > 14) return 'Username must be 3-14 characters.';
        if (!usernamePattern.test(name)) return 'Username can only use letters, numbers and _.';
        return null;
    }

    function usernameTakenError() {
        const error = new Error('That username is taken. Try another one.');
        error.code = 'username-taken';
        return error;
    }

    function usernameErrorText(error, fallback) {
        return error && error.code === 'username-taken' ? error.message : fallback;
    }

    async function usernameIsTaken(db, uid, username) {
        const snapshot = await db.ref(`usernames/${usernameKey(username)}`).once('value');
        return snapshot.exists() && snapshot.val() !== uid;
    }

    // Reserves the new name and frees the old one - only if this player really holds it (the rules refuse anything else).
    async function usernameUpdates(db, uid, oldUsername, newUsername) {
        const updates = {};
        const newKey = usernameKey(newUsername);
        const newSnapshot = await db.ref(`usernames/${newKey}`).once('value');
        if (newSnapshot.exists() && newSnapshot.val() !== uid) throw usernameTakenError();
        if (!newSnapshot.exists()) updates[`usernames/${newKey}`] = uid;

        const oldKey = usernameKey(oldUsername);
        if (oldKey !== newKey && isValidUsername(oldUsername)) {
            const oldSnapshot = await db.ref(`usernames/${oldKey}`).once('value');
            if (oldSnapshot.val() === uid) updates[`usernames/${oldKey}`] = null;
        }
        return updates;
    }

    async function saveUsernameAndProfile(db, uid, oldUsername, newUsername, fields = {}) {
        const updates = await usernameUpdates(db, uid, oldUsername, newUsername);
        updates[`herbaryo-users/${uid}/username`] = String(newUsername).trim();
        Object.entries(fields).forEach(([field, value]) => {
            updates[`herbaryo-users/${uid}/${field}`] = value;
        });
        await db.ref().update(updates);
    }

    // An account made before names were reserved: reserve its name now. False = the name can't be used and must be changed.
    async function reserveExistingUsername(db, uid, username) {
        if (!isValidUsername(username)) return false;
        const ref = db.ref(`usernames/${usernameKey(username)}`);
        const snapshot = await ref.once('value');
        if (!snapshot.exists()) {
            await ref.set(uid);
            return true;
        }
        return snapshot.val() === uid;
    }

    // ---- Removing an account: what goes, in one update. (report-times can only be cleared by its owner.)
    async function accountRemovalUpdates(db, uid, username, isOwner) {
        const updates = {
            [`progress/${uid}`]: null,
            [`achievement-dates/${uid}`]: null,
            [`herbaryo-users/${uid}`]: null
        };
        if (isOwner) updates[`report-times/${uid}`] = null;
        if (isValidUsername(username)) {
            const key = usernameKey(username);
            const snapshot = await db.ref(`usernames/${key}`).once('value');
            if (snapshot.val() === uid) updates[`usernames/${key}`] = null;
        }
        return updates;
    }

    // Reports stay for the team, without saying who sent them.
    async function anonymizeReports(db, uid) {
        const snapshot = await db.ref('reports').orderByChild('uid').equalTo(uid).once('value');
        const updates = {};
        snapshot.forEach(child => {
            updates[`${child.key}/username`] = 'Deleted player';
            updates[`${child.key}/uid`] = 'deleted';
        });
        if (Object.keys(updates).length) await db.ref('reports').update(updates);
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[character]));
    }

    function formatDate(milliseconds) {
        const date = new Date(Number(milliseconds));
        return Number.isNaN(date.getTime())
            ? ''
            : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    window.HerbaryoSchema = {
        achievementCatalog,
        generalAchievementKeys,
        avatarPaths,
        defaultAvatarPath,
        normalizeAvatar,
        profileColors,
        defaultProfileColor,
        normalizeColor,
        createAchievementMap,
        createDefaultProfile,
        migrateUser,
        usernameKey,
        isValidUsername,
        usernameProblem,
        usernameTakenError,
        usernameErrorText,
        usernameIsTaken,
        saveUsernameAndProfile,
        reserveExistingUsername,
        accountRemovalUpdates,
        anonymizeReports,
        escapeHtml,
        formatDate
    };
})();