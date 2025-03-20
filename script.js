document.addEventListener("DOMContentLoaded", () => {

    // ✅ Vérifie si l'utilisateur est connecté et met à jour l'interface
    function checkAuthStatus() {
        const token = localStorage.getItem("token");
        const username = localStorage.getItem("username");
        const authLink = document.getElementById("auth-link");
        const registerLink = document.getElementById("register-link");
        const userMenu = document.getElementById("user-menu");
        const userAvatar = document.getElementById("user-avatar");

        if (token && username) {
            if (authLink) authLink.style.display = "none"; // Cache "Connexion"
            if (registerLink) registerLink.style.display = "none"; // Cache "Inscription"
            if (userMenu) userMenu.style.display = "block"; // Affiche l'avatar

            if (userAvatar) {
                userAvatar.textContent = username.charAt(0).toUpperCase(); // Affiche la première lettre du pseudo
            }
        } else {
            if (authLink) authLink.style.display = "block"; // Affiche "Connexion"
            if (registerLink) registerLink.style.display = "block"; // Affiche "Inscription"
            if (userMenu) userMenu.style.display = "none"; // Cache l'avatar
        }
    }

    // ✅ Afficher/Masquer le menu déroulant
    function toggleMenu() {
        const dropdownMenu = document.getElementById("dropdown-menu");
        dropdownMenu.style.display = dropdownMenu.style.display === "block" ? "none" : "block";
    }

    // ✅ Fonction de Déconnexion
    function logout() {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        window.location.href = "index.html"; // Redirection vers l'accueil
    }

    // ✅ Fermer le menu dropdown si on clique ailleurs
    document.addEventListener("click", (event) => {
        const dropdownMenu = document.getElementById("dropdown-menu");
        const userAvatar = document.getElementById("user-avatar");

        if (!userAvatar.contains(event.target) && dropdownMenu.style.display === "block") {
            dropdownMenu.style.display = "none";
        }
    });

    // 🔹 **Gestion de l'Inscription**
    const registerForm = document.getElementById("register-form");
    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("new-username").value.trim();
            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("new-password").value;
            const confirmPassword = document.getElementById("confirm-password").value;

            if (password !== confirmPassword) {
                document.getElementById("register-status").textContent = "❌ Les mots de passe ne correspondent pas !";
                return;
            }

            const response = await fetch("http://localhost:3000/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password })
            });

            const result = await response.json();
            document.getElementById("register-status").textContent = result.message;

            if (result.token) {
                localStorage.setItem("token", result.token);
                localStorage.setItem("username", username);
                window.location.href = "index.html"; // Redirection vers l'accueil
            }
        });
    }

    // 🔹 **Gestion de la Connexion**
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("username").value.trim();
            const password = document.getElementById("password").value;

            const response = await fetch("http://localhost:3000/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();
            document.getElementById("login-status").textContent = result.message;

            if (result.token) {
                localStorage.setItem("token", result.token);
                localStorage.setItem("username", username);
                window.location.href = "index.html"; // Redirection vers l'accueil
            }
        });
    }

    // 🔹 **Gestion de l'Upload des Vidéos**
    const uploadForm = document.getElementById("upload-form");
    if (uploadForm) {
        uploadForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const fileInput = document.getElementById("file-upload");
            const apartmentNameInput = document.getElementById("apartment-name");
            const timeOfDaySelect = document.getElementById("time-of-day");
            const token = localStorage.getItem("token");

            if (!token) {
                alert("❌ Vous devez être connecté pour uploader une vidéo.");
                return;
            }

            if (!fileInput.files.length || !apartmentNameInput.value.trim() || !timeOfDaySelect.value) {
                alert("❌ Tous les champs doivent être remplis.");
                return;
            }

            const formData = new FormData();
            formData.append("file", fileInput.files[0]);
            formData.append("apartmentName", apartmentNameInput.value.trim());
            formData.append("timeOfDay", timeOfDaySelect.value);

            console.log("📤 Données envoyées :");
            for (let pair of formData.entries()) {
                console.log(`${pair[0]}:`, pair[1]);
            }

            try {
                const response = await fetch("http://localhost:3000/upload", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${token}` }, // ✅ PAS DE `Content-Type`
                    body: formData
                });

                const result = await response.json();
                document.getElementById("upload-status").textContent = result.message;
            } catch (error) {
                console.error("❌ Erreur lors de l'upload :", error);
                document.getElementById("upload-status").textContent = "❌ Échec de l'upload.";
            }
        });
    }

    // 🔹 **Chargement des Vidéos**
    function loadVideos() {
        const token = localStorage.getItem("token");

        if (!token) {
            document.getElementById("video-container").innerHTML = "<p>Veuillez vous connecter pour voir vos vidéos.</p>";
            return;
        }

        fetch("http://localhost:3000/videos", {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        })
            .then(response => response.json())
            .then(videos => {
                const videoContainer = document.getElementById("video-container");
                videoContainer.innerHTML = "";

                if (videos.length === 0) {
                    videoContainer.innerHTML = "<p>Aucune vidéo disponible.</p>";
                    return;
                }

                videos.forEach(video => {
                    // Extraire uniquement le nom du fichier
                    const videoPathParts = video.split("/");
                    const fileName = videoPathParts[videoPathParts.length - 1];

                    const videoElement = document.createElement("video");
                    videoElement.src = `http://localhost:3000${video}`;
                    videoElement.controls = true;
                    videoElement.width = 300;

                    const videoTitle = document.createElement("p");
                    videoTitle.textContent = fileName; // Affiche seulement le nom du fichier

                    const videoWrapper = document.createElement("div");
                    videoWrapper.appendChild(videoTitle);
                    videoWrapper.appendChild(videoElement);

                    videoContainer.appendChild(videoWrapper);
                });
            })
            .catch(error => console.error("❌ Erreur lors du chargement des vidéos :", error));
    }

    // ✅ Charger les vidéos dès le chargement de la page
    if (document.getElementById("video-container")) {
        loadVideos();
    }

    // ✅ Vérifier l'état d'authentification
    checkAuthStatus();

    // ✅ Expose les fonctions au global (pour les appeler depuis le HTML)
    window.toggleMenu = toggleMenu;
    window.logout = logout;
});
