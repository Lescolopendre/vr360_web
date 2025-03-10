const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.SECRET_KEY || "supersecret"; // Clé secrète pour JWT
const USERS_FILE = path.join(__dirname, "users.json");
const VIDEOS_DIR = path.join(__dirname, "videos");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static("public"));

// 📂 Vérifier que le dossier principal "videos" existe
if (!fs.existsSync(VIDEOS_DIR)) {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

// 🔐 **Middleware d'authentification**
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Accès non autorisé. Token manquant." });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            console.error("❌ Erreur JWT :", err.message);
            return res.status(403).json({ error: "Token invalide." });
        }
        req.user = decoded;
        next();
    });
};

// 📌 **Gestion des utilisateurs**
function loadUsers() {
    return fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE)) : [];
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// 📌 **Inscription - POST /register**
app.post("/register", async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: "Nom d'utilisateur, email et mot de passe requis." });
    }

    let users = loadUsers();
    if (users.some(user => user.username === username)) {
        return res.status(400).json({ error: "L'utilisateur existe déjà." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    users.push({ username, email, password: hashedPassword });
    saveUsers(users);

    // 📂 Création automatique du dossier utilisateur
    const userDir = path.join(VIDEOS_DIR, username);
    if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
    }

    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "24h" });
    res.json({ message: "✅ Inscription réussie !", token });
});

// 📌 **Connexion - POST /login**
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Nom d'utilisateur et mot de passe requis." });

    let users = loadUsers();
    const user = users.find(user => user.username === username);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Identifiants incorrects." });
    }

    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "24h" });
    res.json({ message: "✅ Connexion réussie !", token });
});

// 📂 **Configuration de Multer (Stockage dynamique)**
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userDir = path.join(VIDEOS_DIR, req.user.username);

        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }

        cb(null, userDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); // Nom temporaire, sera modifié après l'upload
    }
});

const upload = multer({ storage }).fields([
    { name: "file", maxCount: 1 },
    { name: "fileName", maxCount: 1 }
]);

// 📤 **Upload vidéo - POST /upload**
app.post("/upload", authMiddleware, (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            console.error("❌ Erreur lors de l'upload :", err.message);
            return res.status(400).json({ message: "❌ Erreur lors de l'upload : " + err.message });
        }

        if (!req.files || !req.files.file) {
            console.error("❌ Aucune vidéo reçue !");
            return res.status(400).json({ message: "❌ Aucune vidéo reçue." });
        }

        console.log("📩 Champs reçus :", req.body);

        let fileName = req.body.fileName ? req.body.fileName.trim() : "";
        fileName = fileName.replace(/\s+/g, "_").replace(/[^\w.-]/g, ""); // Nettoie le nom

        if (!fileName) {
            fileName = path.parse(req.files.file[0].originalname).name; // Si vide, prend le nom original sans extension
        }

        const fileExtension = path.extname(req.files.file[0].originalname);
        const finalFileName = `${fileName}${fileExtension}`;

        // 🔹 Renommer le fichier avec le bon nom de l'utilisateur
        const oldPath = req.files.file[0].path;
        const newPath = path.join(path.dirname(oldPath), finalFileName);

        fs.rename(oldPath, newPath, (renameErr) => {
            if (renameErr) {
                console.error("❌ Erreur lors du renommage du fichier :", renameErr);
                return res.status(500).json({ message: "❌ Erreur lors du renommage du fichier." });
            }

            console.log(`✅ Vidéo renommée : ${finalFileName}`);
            res.json({ message: `✅ Vidéo "${finalFileName}" téléchargée avec succès !` });
        });
    });
});

// 📌 **Liste des vidéos d'un utilisateur - GET /videos**
app.get("/videos", authMiddleware, (req, res) => {
    const userDir = path.join(VIDEOS_DIR, req.user.username);

    if (!fs.existsSync(userDir)) {
        return res.json([]); // Aucun fichier si le dossier n'existe pas
    }

    fs.readdir(userDir, (err, files) => {
        if (err) return res.status(500).json({ error: "Erreur lors de la récupération des fichiers" });

        // Générer les URLs des vidéos de l'utilisateur
        const videoUrls = files.map(file => `/videos/${req.user.username}/${file}`);
        res.json(videoUrls);
    });
});

// 📌 **Streaming vidéo - GET /videos/:username/:filename**
app.get("/videos/:username/:filename", (req, res) => {
    const filePath = path.join(VIDEOS_DIR, req.params.username, req.params.filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Vidéo non trouvée" });
    }

    res.sendFile(filePath);
});

// 🚀 **Démarrer le serveur**
app.listen(PORT, () => console.log(`🚀 Serveur en cours d'exécution sur http://localhost:${PORT}`));
