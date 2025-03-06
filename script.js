document.addEventListener("DOMContentLoaded", async () => {
    console.log("✅ script.js chargé !");

    const loginForm = document.getElementById("login-form");
    const uploadForm = document.getElementById("upload-form");
    const authLink = document.getElementById("auth-link");
    const videoContainer = document.getElementById("video-container");

    const token = localStorage.getItem("token");

    // 🔹 Gestion de l'affichage du bouton Connexion/Déconnexion
    if (authLink) {
        if (token) {
            authLink.textContent = "Déconnexion";
            authLink.href = "#";
            authLink.onclick = (event) => {
                event.preventDefault();
                localStorage.removeItem("token");
                window.location.href = "index.html";
            };
        } else {
            authLink.textContent = "Connexion";
            authLink.href = "login.html";
        }
    }

    // 🔹 Gestion de la connexion (Page login.html)
    if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const username = document.getElementById("username").value;
            const password = document.getElementById("password").value;
            const loginStatus = document.getElementById("login-status");

            console.log("🛠️ Tentative de connexion avec :", { username, password });

            try {
                const response = await fetch("http://localhost:5000/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password }),
                });

                console.log("🛠️ Réponse brute du serveur :", response);

                if (!response.ok) {
                    console.error("❌ Erreur : Identifiants incorrects ou serveur en erreur.");
                    loginStatus.textContent = "❌ Identifiants incorrects";
                    loginStatus.style.color = "red";
                    return;
                }

                const data = await response.json();
                console.log("🛠️ Réponse JSON du serveur :", data);

                // Stockage du token immédiatement
                localStorage.setItem("token", data.token);
                console.log("✅ Token stocké :", localStorage.getItem("token"));

                // Vérification immédiate si le token est récupérable
                if (localStorage.getItem("token")) {
                    console.log("✅ Token bien récupéré, redirection en cours...");
                    window.location.href = "index.html";
                } else {
                    console.error("❌ Problème de stockage du token.");
                }
            } catch (error) {
                console.error("❌ Erreur de connexion :", error);
                loginStatus.textContent = "❌ Erreur serveur";
                loginStatus.style.color = "red";
            }
        });
    }

    // 🔹 Gestion de l'upload de vidéos
    if (uploadForm) {
        uploadForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const statusMessage = document.getElementById("upload-status");

            if (!token) {
                statusMessage.textContent = "❌ Vous devez être connecté pour télécharger une vidéo.";
                statusMessage.style.color = "red";
                return;
            }

            const fileInput = document.getElementById("file-upload");
            if (!fileInput.files.length) {
                statusMessage.textContent = "❌ Sélectionnez un fichier.";
                statusMessage.style.color = "red";
                return;
            }

            const formData = new FormData();
            formData.append("video", fileInput.files[0]);

            try {
                const response = await fetch("http://localhost:5000/upload", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                });

                const data = await response.json();
                console.log("🛠️ Réponse upload :", data);

                statusMessage.textContent = response.ok ? "✅ Vidéo envoyée avec succès." : "❌ " + data.message;
                statusMessage.style.color = response.ok ? "green" : "red";

                // Réinitialiser l'input file
                fileInput.value = "";

                // Recharger les vidéos après upload
                loadVideos(token, videoContainer);
            } catch (error) {
                console.error("❌ Erreur d'upload :", error);
                statusMessage.textContent = "❌ Erreur serveur.";
                statusMessage.style.color = "red";
            }
        });
    }

    // 🔹 Chargement des vidéos après connexion
    if (token && videoContainer) {
        await loadVideos(token, videoContainer);
    }
});

// 🔹 Fonction pour charger les vidéos de l'utilisateur
async function loadVideos(token) {
    const videoContainer = document.getElementById("video-container");

    if (!videoContainer) {
        console.error("❌ Erreur : L'élément #video-container n'existe pas.");
        return;
    }

    try {
        const response = await fetch("http://localhost:5000/videos", {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
        });

        const videos = await response.json();
        console.log("✅ Vidéos récupérées :", videos);

        videoContainer.innerHTML = "";

        if (!videos || videos.length === 0) {
            videoContainer.innerHTML = "<p class='text-muted'>Aucune vidéo disponible.</p>";
            return;
        }

        videos.forEach(video => {
            const videoItem = document.createElement("div");
            videoItem.classList.add("video-item", "m-2", "p-2", "border", "rounded");

            videoItem.innerHTML = `
                <video controls width="320">
                    <source src="http://localhost:5000${video}" type="video/mp4">
                </video>
                <p class="text-center">${video.split("/").pop()}</p>
            `;

            videoContainer.appendChild(videoItem);
        });
    } catch (error) {
        console.error("❌ Erreur de récupération des vidéos :", error);
    }
}
