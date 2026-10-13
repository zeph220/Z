(function (global) {
    const ROOT_USERNAME = "zeph220";
    const EMAIL_SUFFIX = "@auth.invisibles.local";
    const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

    function normalizeUsername(username) {
        return String(username || "").trim().toLowerCase();
    }

    function usernameToEmail(username) {
        return normalizeUsername(username) + EMAIL_SUFFIX;
    }

    function isValidUsername(username) {
        return USERNAME_PATTERN.test(normalizeUsername(username));
    }

    function isRootUser(user) {
        return Boolean(user && user.email === usernameToEmail(ROOT_USERNAME));
    }

    async function verifySharedPassword(password) {
        const verifierName = "shared-password-verifier";
        let verifierApp;

        try {
            verifierApp = firebase.app(verifierName);
        } catch (error) {
            verifierApp = firebase.initializeApp(window.siteFirebaseConfig, verifierName);
        }

        const verifier = verifierApp.auth();
        await verifier.setPersistence(firebase.auth.Auth.Persistence.NONE);
        try {
            await verifier.signInWithEmailAndPassword(usernameToEmail(ROOT_USERNAME), password);
        } finally {
            await verifier.signOut();
        }
    }

    async function getAccessState(user) {
        if (!user) {
            return { user: null, username: null, role: null, request: null, isRoot: false, isAdmin: false, isSuperAdmin: false };
        }

        const uid = user.uid;
        const [profileSnapshot, roleSnapshot, requestSnapshot] = await Promise.all([
            siteDatabase.ref("profiles/" + uid).once("value"),
            siteDatabase.ref("adminRoles/" + uid).once("value"),
            siteDatabase.ref("accessRequests/" + uid).once("value")
        ]);

        const isRoot = isRootUser(user);
        const roleData = roleSnapshot.val() || {};
        const profile = profileSnapshot.val() || {};
        const role = isRoot ? "superadmin" : (roleData.role || null);
        const username = profile.username || (isRoot ? ROOT_USERNAME : null);

        return {
            user,
            username,
            role,
            request: requestSnapshot.val(),
            isRoot,
            isAdmin: role === "admin" || role === "superadmin",
            isSuperAdmin: role === "superadmin"
        };
    }

    async function createProfileAndAccessRequest(user, username) {
        const normalizedUsername = normalizeUsername(username);

        await siteDatabase.ref("usernames/" + normalizedUsername).set(user.uid);
        await siteDatabase.ref("profiles/" + user.uid).set({
            username: normalizedUsername,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });

        if (isRootUser(user)) {
            await siteDatabase.ref("adminRoles/" + user.uid).set({
                username: ROOT_USERNAME,
                role: "superadmin",
                grantedBy: ROOT_USERNAME,
                grantedAt: firebase.database.ServerValue.TIMESTAMP
            });
            return;
        }

        await siteDatabase.ref("accessRequests/" + user.uid).set({
            username: normalizedUsername,
            status: "pending",
            requestedAt: firebase.database.ServerValue.TIMESTAMP
        });
    }

    function getErrorMessage(error) {
        const code = error && error.code ? error.code : "";

        if (["auth/invalid-credential", "auth/invalid-login-credentials", "auth/user-not-found", "auth/wrong-password"].includes(code)) {
            return "Identifiant ou mot de passe incorrect.";
        }
        if (code === "auth/email-already-in-use") {
            return "Ce nom d'utilisateur existe déjà. Utilisez la connexion.";
        }
        if (code === "auth/weak-password") {
            return "Le mot de passe doit contenir au moins 6 caractères.";
        }
        if (code === "database/permission-denied") {
            return "Ce nom d'utilisateur est déjà réservé ou cette action n'est pas autorisée.";
        }
        return "Une erreur est survenue. Réessayez dans quelques instants.";
    }

    global.SiteAuth = {
        ROOT_USERNAME,
        normalizeUsername,
        usernameToEmail,
        isValidUsername,
        isRootUser,
        verifySharedPassword,
        getAccessState,
        createProfileAndAccessRequest,
        getErrorMessage
    };
})(window);
