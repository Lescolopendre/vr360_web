const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const PORT = 5000;
const SECRET_KEY = process.env.SECRET_KEY || "supersecret";
const USERS_FILE = path.join(__dirname, "users.json"); // Fichier contenant les utilisateurs
const VIDEOS_DIR = path.join(__dirname, "videos"); // Dossier principal des vidéos

app.use(cors());
app.use(express.json());

// 📂 Vérifier que le dossier principal des vidéos existe
if (!fs.existsSync(VIDEOS_DIR)) {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

// 🔐 Middleware d'authentification pour protéger les routes
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Accès non autorisé. Token manquant." });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Token invalide." });
        req.user = decoded; // Ajouter l'utilisateur à la requête
        next();
    });
};

// 📌 **Inscription - POST /register**
app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Nom d'utilisateur et mot de passe requis." });

    let users = [];
    if (fs.existsSync(USERS_FILE)) {
        users = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    }

    if (users.some(user => user.username === username)) {
        return res.status(400).json({ error: "L'utilisateur existe déjà." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    users.push({ username, password: hashedPassword });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

    res.json({ message: "Utilisateur créé avec succès." });
});

// 📌 **Connexion - POST /login**
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Nom d'utilisateur et mot de passe requis." });

    if (!fs.existsSync(USERS_FILE)) return res.status(400).json({ error: "Utilisateur non trouvé." });

    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    const user = users.find(user => user.username === username);

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Identifiants incorrects." });
    }

    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "2h" });
    res.json({ message: "Connexion réussie.", token });
});

// 📌 **Déconnexion - POST /logout** (côté client, on supprime le token)
app.post("/logout", (req, res) => {
    res.json({ message: "Déconnexion réussie." });
});

// 📂 ⚙️ **Configuration de Multer avec un dossier utilisateur dynamique**
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userDir = path.join(VIDEOS_DIR, req.user.username);

        // Créer le dossier utilisateur s'il n'existe pas
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }

        cb(null, userDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Nom unique pour éviter les conflits
    }
});

const upload = multer({ storage });

// 📤 **Upload vidéo (protégé) - POST /upload**
app.post("/upload", authMiddleware, upload.single("video"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu" });

    res.json({
        url: `/videos/${req.user.username}/${req.file.filename}`,
        message: "Vidéo envoyée avec succès"
    });
});

// 📋 **Liste des vidéos de l'utilisateur connecté - GET /videos**
app.get("/videos", authMiddleware, (req, res) => {
    const userDir = path.join(VIDEOS_DIR, req.user.username);

    if (!fs.existsSync(userDir)) {
        return res.json([]); // Aucun fichier si le dossier n'existe pas encore
    }

    fs.readdir(userDir, (err, files) => {
        if (err) return res.status(500).json({ error: "Erreur lors de la récupération des fichiers" });

        // Générer les URLs des vidéos de l'utilisateur
        const videoUrls = files.map(file => `/videos/${req.user.username}/${file}`);
        res.json(videoUrls);
    });
});

// 🎥 **Streaming vidéo - GET /videos/:username/:filename**
app.get("/videos/:username/:filename", (req, res) => {
    const filePath = path.join(VIDEOS_DIR, req.params.username, req.params.filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Vidéo non trouvée" });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        const file = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize,
            "Content-Type": "video/mp4",
        });

        file.pipe(res);
    } else {
        res.writeHead(200, {
            "Content-Length": fileSize,
            "Content-Type": "video/mp4",
        });
        fs.createReadStream(filePath).pipe(res);
    }
});

// 🚀 Démarrage du serveur
app.listen(PORT, () => {
    console.log(`✅ Serveur en écoute sur http://localhost:${PORT}`);
});
