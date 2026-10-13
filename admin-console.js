(function () {
    const auth = SiteAuth;
    const database = siteDatabase;
    const adminContent = document.getElementById("adminContent");
    const loadingMessage = document.getElementById("loadingMessage");
    const adminError = document.getElementById("adminError");
    const identity = document.getElementById("currentIdentity");
    const accessStatus = document.getElementById("accessStatus");
    const resultsRef = database.ref("quizResults");
    let allResults = [];
    let currentAccess = null;
    let requests = {};

    function showError(message) {
        loadingMessage.hidden = true;
        adminContent.hidden = true;
        adminError.hidden = false;
        adminError.textContent = message;
    }

    function formatDate(value) {
        if (!value) return "—";
        return new Date(value).toLocaleString("fr-FR");
    }

    function makeCell(row, value) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
        return cell;
    }

    function getCategory(score) {
        if (score <= 7) return "Non dangereux";
        if (score <= 15) return "Faible danger";
        if (score <= 22) return "Danger suspect";
        return "Très dangereux";
    }

    function renderResults() {
        const tableBody = document.getElementById("results-body");
        tableBody.replaceChildren();

        if (allResults.length === 0) {
            const row = document.createElement("tr");
            const cell = makeCell(row, "Aucun résultat enregistré");
            cell.colSpan = 5;
            tableBody.appendChild(row);
            return;
        }

        allResults.forEach(function (result, index) {
            const row = document.createElement("tr");
            makeCell(row, String(index + 1));
            makeCell(row, result.score + " / 30");
            makeCell(row, getCategory(result.score));
            makeCell(row, formatDate(result.timestamp));
            const actionCell = document.createElement("td");
            const deleteButton = document.createElement("button");
            deleteButton.className = "btn-delete";
            deleteButton.type = "button";
            deleteButton.textContent = "Supprimer";
            deleteButton.addEventListener("click", function () {
                deleteResult(result.id);
            });
            actionCell.appendChild(deleteButton);
            row.appendChild(actionCell);
            tableBody.appendChild(row);
        });
    }

    function renderStats() {
        const total = allResults.length;
        const sum = allResults.reduce(function (accumulator, result) {
            return accumulator + Number(result.score || 0);
        }, 0);

        document.getElementById("total-participants").textContent = String(total);
        document.getElementById("average-score").textContent = total ? (sum / total).toFixed(1) : "0";
        document.getElementById("best-score").textContent = total ? String(Math.max.apply(null, allResults.map(function (result) { return Number(result.score || 0); }))) : "0";
    }

    function renderChart() {
        const chartContainer = document.querySelector(".chart-container");
        if (!allResults.length) {
            chartContainer.hidden = true;
            return;
        }

        chartContainer.hidden = false;
        const categories = { "Non dangereux": 0, "Faible danger": 0, "Danger suspect": 0, "Très dangereux": 0 };
        allResults.forEach(function (result) { categories[getCategory(result.score)] += 1; });

        if (window.scoreChart) window.scoreChart.destroy();
        window.scoreChart = new Chart(document.getElementById("score-chart").getContext("2d"), {
            type: "doughnut",
            data: {
                labels: Object.keys(categories),
                datasets: [{ data: Object.values(categories), backgroundColor: ["#4CAF50", "#8BC34A", "#FF9800", "#F44336"] }]
            },
            options: { responsive: true, plugins: { legend: { position: "bottom" } } }
        });
    }

    function loadResults() {
        resultsRef.on("value", function (snapshot) {
            allResults = [];
            const data = snapshot.val() || {};
            Object.keys(data).forEach(function (key) {
                allResults.push({ id: key, score: Number(data[key].score), timestamp: data[key].timestamp });
            });
            allResults.sort(function (a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
            renderResults();
            renderStats();
            renderChart();
        });
    }

    async function deleteResult(id) {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer ce résultat ?")) {
            await resultsRef.child(id).remove();
        }
    }

    document.getElementById("clearDataButton").addEventListener("click", async function () {
        if (window.confirm("Êtes-vous sûr de vouloir effacer toutes les données ? Cette action est irréversible.")) {
            await resultsRef.remove();
        }
    });

    document.getElementById("exportDataButton").addEventListener("click", function () {
        const dataBlob = new Blob([JSON.stringify(allResults, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "quiz-results-" + new Date().toISOString().split("T")[0] + ".json";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    });

    function renderRequests() {
        const body = document.getElementById("requests-body");
        const entries = Object.keys(requests).map(function (uid) {
            return Object.assign({ uid: uid }, requests[uid]);
        }).sort(function (a, b) {
            return Number(b.requestedAt || 0) - Number(a.requestedAt || 0);
        });
        const pendingCount = entries.filter(function (request) { return request.status === "pending"; }).length;
        document.getElementById("requestCount").textContent = pendingCount + " en attente";
        body.replaceChildren();

        if (!entries.length) {
            const row = document.createElement("tr");
            const cell = makeCell(row, "Aucune demande pour le moment");
            cell.colSpan = 4;
            body.appendChild(row);
            return;
        }

        entries.forEach(function (request) {
            const row = document.createElement("tr");
            makeCell(row, request.username || "—");
            makeCell(row, formatDate(request.requestedAt));
            makeCell(row, request.status || "—");
            const actionCell = document.createElement("td");
            if (request.status === "pending") {
                const approveButton = document.createElement("button");
                approveButton.className = "btn-approve";
                approveButton.type = "button";
                approveButton.textContent = "Accorder";
                approveButton.addEventListener("click", function () { reviewRequest(request.uid, true); });

                const rejectButton = document.createElement("button");
                rejectButton.className = "btn-reject";
                rejectButton.type = "button";
                rejectButton.textContent = "Refuser";
                rejectButton.addEventListener("click", function () { reviewRequest(request.uid, false); });

                actionCell.append(approveButton, rejectButton);
            } else {
                actionCell.textContent = request.reviewedBy ? "Traité" : "—";
            }
            row.appendChild(actionCell);
            body.appendChild(row);
        });
    }

    async function reviewRequest(uid, approved) {
        const request = requests[uid];
        if (!request || request.status !== "pending") return;

        const updates = {};
        updates["accessRequests/" + uid + "/status"] = approved ? "approved" : "rejected";
        updates["accessRequests/" + uid + "/reviewedBy"] = currentAccess.user.uid;
        updates["accessRequests/" + uid + "/reviewedAt"] = Date.now();

        if (approved) {
            updates["adminRoles/" + uid] = {
                username: request.username,
                role: "admin",
                grantedBy: currentAccess.user.uid,
                grantedAt: Date.now()
            };
        }

        await database.ref().update(updates);
    }

    function loadRequests() {
        document.getElementById("accessRequestsPanel").hidden = false;
        database.ref("accessRequests").on("value", function (snapshot) {
            requests = snapshot.val() || {};
            renderRequests();
        });
    }

    document.getElementById("superAdminForm").addEventListener("submit", async function (event) {
        event.preventDefault();
        const message = document.getElementById("superAdminMessage");
        const username = auth.normalizeUsername(document.getElementById("superAdminUsername").value);
        message.textContent = "";

        if (!auth.isValidUsername(username)) {
            message.textContent = "Nom d'utilisateur invalide.";
            return;
        }

        try {
            const usernameSnapshot = await database.ref("usernames/" + username).once("value");
            const targetUid = usernameSnapshot.val();
            if (!targetUid) {
                message.textContent = "Ce nom d'utilisateur n'existe pas encore.";
                return;
            }

            await database.ref("adminRoles/" + targetUid).set({
                username: username,
                role: "superadmin",
                grantedBy: currentAccess.user.uid,
                grantedAt: Date.now()
            });
            message.textContent = "Administrateur suprême nommé.";
            document.getElementById("superAdminUsername").value = "";
        } catch (error) {
            message.textContent = auth.getErrorMessage(error);
        }
    });

    function renderChat(snapshot) {
        const chat = document.getElementById("chatMessages");
        const messages = [];
        snapshot.forEach(function (child) { messages.push(Object.assign({ id: child.key }, child.val())); });
        messages.sort(function (a, b) { return Number(a.createdAt || 0) - Number(b.createdAt || 0); });
        chat.replaceChildren();

        if (!messages.length) {
            chat.textContent = "Aucun message pour le moment.";
            return;
        }

        messages.forEach(function (message) {
            const article = document.createElement("article");
            article.className = "chat-message";
            const header = document.createElement("header");
            const username = document.createElement("strong");
            username.textContent = "@" + (message.username || "inconnu");
            const date = document.createElement("time");
            date.textContent = formatDate(message.createdAt);
            header.append(username, date);
            const content = document.createElement("p");
            content.textContent = message.text || "";
            article.append(header, content);
            chat.appendChild(article);
        });
        chat.scrollTop = chat.scrollHeight;
    }

    document.getElementById("chatForm").addEventListener("submit", async function (event) {
        event.preventDefault();
        const input = document.getElementById("chatInput");
        const message = input.value.trim();
        const feedback = document.getElementById("chatMessage");
        if (!message || !currentAccess || !currentAccess.username) return;

        try {
            await database.ref("chatMessages").push({
                authorUid: currentAccess.user.uid,
                username: currentAccess.username,
                text: message,
                createdAt: Date.now()
            });
            input.value = "";
            feedback.textContent = "Message envoyé.";
        } catch (error) {
            feedback.textContent = auth.getErrorMessage(error);
        }
    });

    document.getElementById("logoutButton").addEventListener("click", function () {
        siteAuth.signOut().then(function () { window.location.replace("login.html"); });
    });

    siteAuth.onAuthStateChanged(async function (user) {
        if (!user) {
            window.location.replace("login.html");
            return;
        }

        try {
            currentAccess = await auth.getAccessState(user);
            if (!currentAccess.isAdmin) {
                await siteAuth.signOut();
                window.location.replace("login.html");
                return;
            }

            identity.textContent = "@" + (currentAccess.username || "administrateur");
            accessStatus.textContent = currentAccess.isRoot ? "Administrateur suprême originel" : (currentAccess.isSuperAdmin ? "Administrateur suprême" : "Administrateur approuvé");
            document.getElementById("chatAuthor").textContent = "@" + (currentAccess.username || "administrateur");
            adminContent.hidden = false;
            loadingMessage.hidden = true;

            if (currentAccess.isSuperAdmin) loadRequests();
            if (currentAccess.isRoot) document.getElementById("superAdminPanel").hidden = false;
            database.ref("chatMessages").limitToLast(100).on("value", renderChat);
            loadResults();
        } catch (error) {
            showError("Impossible de vérifier vos droits d'accès.");
        }
    });
})();
