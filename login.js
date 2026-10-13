(function () {
    const form = document.getElementById("loginForm");
    const usernameInput = document.getElementById("usernameInput");
    const passwordInput = document.getElementById("passwordInput");
    const submitButton = document.getElementById("submitButton");
    const modeButton = document.getElementById("modeButton");
    const modeDescription = document.getElementById("modeDescription");
    const errorMessage = document.getElementById("errorMessage");
    const statusMessage = document.getElementById("statusMessage");

    let mode = "login";

    function showMessage(element, message, isError) {
        element.textContent = message;
        element.classList.toggle("is-error", Boolean(isError));
    }

    function setMode(nextMode) {
        mode = nextMode;
        const isRegistration = mode === "register";
        submitButton.textContent = isRegistration ? "Créer le nom d'utilisateur" : "Se connecter";
        modeButton.textContent = isRegistration ? "J'ai déjà un compte" : "Créer un nom d'utilisateur";
        modeDescription.textContent = isRegistration
            ? "Le compte restera en attente jusqu'à son approbation par un administrateur suprême."
            : "L'accès aux statistiques est réservé aux comptes approuvés.";
        showMessage(errorMessage, "", false);
        showMessage(statusMessage, "", false);
    }

    async function redirectAccordingToAccess(user) {
        const access = await SiteAuth.getAccessState(user);

        if (access.isAdmin) {
            window.location.replace("admin-console.html");
            return;
        }

        const requestStatus = access.request && access.request.status;
        if (requestStatus === "pending") {
            showMessage(statusMessage, "Votre demande est en attente d'approbation par un administrateur suprême.", false);
        } else if (requestStatus === "rejected") {
            showMessage(statusMessage, "Votre demande d'accès a été refusée. Vous pouvez en soumettre une nouvelle.", true);
        } else {
            showMessage(statusMessage, "Ce compte n'est pas encore autorisé à accéder à l'administration.", true);
        }

        await siteAuth.signOut();
    }

    modeButton.addEventListener("click", function () {
        setMode(mode === "login" ? "register" : "login");
    });

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        showMessage(errorMessage, "", false);
        showMessage(statusMessage, "", false);

        const username = SiteAuth.normalizeUsername(usernameInput.value);
        const password = passwordInput.value;

        if (!SiteAuth.isValidUsername(username)) {
            showMessage(errorMessage, "Le nom doit contenir 3 à 32 caractères : lettres, chiffres, point, tiret ou underscore.", true);
            usernameInput.focus();
            return;
        }

        submitButton.disabled = true;

        try {
            if (mode === "register") {
                if (username !== SiteAuth.ROOT_USERNAME) {
                    await SiteAuth.verifySharedPassword(password);
                }

                const credential = await siteAuth.createUserWithEmailAndPassword(
                    SiteAuth.usernameToEmail(username),
                    password
                );

                try {
                    await SiteAuth.createProfileAndAccessRequest(credential.user, username);
                } catch (profileError) {
                    await siteDatabase.ref("usernames/" + username).remove().catch(function () {});
                    await siteDatabase.ref("profiles/" + credential.user.uid).remove().catch(function () {});
                    await siteDatabase.ref("accessRequests/" + credential.user.uid).remove().catch(function () {});
                    await siteDatabase.ref("adminRoles/" + credential.user.uid).remove().catch(function () {});
                    await credential.user.delete().catch(function () {});
                    await siteAuth.signOut();
                    throw profileError;
                }

                passwordInput.value = "";
                showMessage(statusMessage, username === SiteAuth.ROOT_USERNAME
                    ? "Compte suprême créé. Redirection vers l'administration…"
                    : "Nom d'utilisateur créé. Votre demande est maintenant en attente d'approbation.", false);

                if (username === SiteAuth.ROOT_USERNAME) {
                    window.location.replace("admin-console.html");
                } else {
                    await siteAuth.signOut();
                }
            } else {
                const credential = await siteAuth.signInWithEmailAndPassword(
                    SiteAuth.usernameToEmail(username),
                    password
                );
                passwordInput.value = "";
                await redirectAccordingToAccess(credential.user);
            }
        } catch (error) {
            showMessage(errorMessage, SiteAuth.getErrorMessage(error), true);
        } finally {
            submitButton.disabled = false;
        }
    });
})();
