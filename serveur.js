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
const SECRET_KEY = process.env.SECRET_KEY || "supersecret";
const USERS_FILE = path.join(__dirname, "users.json");
const VIDEOS_DIR = path.join(__dirname, "videos");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static("public"));

if (!fs.existsSync(VIDEOS_DIR)) {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

// Middleware d'authentification
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Accès non autorisé. Token manquant." });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Token invalide." });
        req.user = decoded;
        next();
    });
};

// Gestion des utilisateurs
function loadUsers() {
    return fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE)) : [];
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Inscription
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

    const userDir = path.join(VIDEOS_DIR, username);
    if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
    }

    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "24h" });
    res.json({ message: "✅ Inscription réussie !", token });
});

// Connexion
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

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userDir = path.join(VIDEOS_DIR, req.user.username);
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        cb(null, userDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage }).single("file");

// Upload vidéo
app.post("/upload", authMiddleware, (req, res) => {
    upload(req, res, (err) => {
        if (err) return res.status(400).json({ message: "❌ Erreur lors de l'upload : " + err.message });
        if (!req.file) return res.status(400).json({ message: "❌ Aucune vidéo reçue." });

        const { apartmentName, timeOfDay } = req.body;
        if (!apartmentName || !timeOfDay ) {
            return res.status(400).json({ message: "❌ Tous les champs doivent être remplis." });
        }

        const userDir = path.join(VIDEOS_DIR, req.user.username);
        const apartmentDir = path.join(userDir, apartmentName);
        if (!fs.existsSync(apartmentDir)) {
            fs.mkdirSync(apartmentDir, { recursive: true });
        }

        const fileExtension = path.extname(req.file.originalname);
        const finalFileName = `${apartmentName}_${timeOfDay}${fileExtension}`;
        const newPath = path.join(apartmentDir, finalFileName);

        fs.rename(req.file.path, newPath, (renameErr) => {
            if (renameErr) return res.status(500).json({ message: "❌ Erreur lors du renommage du fichier." });
            res.json({ message: `✅ Vidéo téléchargée : ${finalFileName}` });
        });
    });
});

// Lister les vidéos d'un utilisateur
app.get("/videos", authMiddleware, (req, res) => {
    const userDir = path.join(VIDEOS_DIR, req.user.username);
    if (!fs.existsSync(userDir)) {
        return res.json([]);
    }
    let videoList = [];
    fs.readdirSync(userDir).forEach(apartment => {
        const apartmentPath = path.join(userDir, apartment);
        if (fs.lstatSync(apartmentPath).isDirectory()) {
            const files = fs.readdirSync(apartmentPath);
            files.forEach(file => {
                videoList.push(`/videos/${req.user.username}/${apartment}/${file}`);
            });
        }
    });
    res.json(videoList);
});

// Récupérer une vidéo spécifique
app.get("/videos/:username/:apartment/:filename", (req, res) => {
    const filePath = path.join(VIDEOS_DIR, req.params.username, req.params.apartment, req.params.filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Vidéo non trouvée" });
    }
    res.sendFile(filePath);
});
// Lister les vidéos d'un utilisateur avec son nom d'utilisateur
app.get("/videos/:username", authMiddleware, (req, res) => {
    const { username } = req.params;
    if (req.user.username !== username) {
        return res.status(403).json({ error: "Accès interdit." });
    }

    const userDir = path.join(VIDEOS_DIR, username);
    if (!fs.existsSync(userDir)) {
        return res.json([]);
    }

    let videoList = [];
    fs.readdirSync(userDir).forEach(apartment => {
        const apartmentPath = path.join(userDir, apartment);
        if (fs.lstatSync(apartmentPath).isDirectory()) {
            const files = fs.readdirSync(apartmentPath);
            files.forEach(file => {
                videoList.push(`/videos/${username}/${apartment}/${file}`);
            });
        }
    });
    res.json(videoList);
});
app.listen(PORT, () => console.log(`🚀 Serveur en cours d'exécution sur http://localhost:${PORT}`));
