
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const users = new Map();
const messages = [];

fs.mkdirSync("uploads", { recursive: true });

app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" +
            Math.random().toString(36).slice(2) +
            path.extname(file.originalname).toLowerCase());
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        ];

        cb(null, allowed.includes(file.mimetype));
    }
});

app.post("/upload", upload.single("gambar"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            error: "File gambar tidak valid."
        });
    }

    res.json({
        url: "/uploads/" + req.file.filename
    });
});

io.on("connection", (socket) => {
    socket.on("join", (nama) => {
        nama = String(nama || "").trim().slice(0, 24);

        if (!nama) return;

        users.set(socket.id, nama);
        socket.join("umum");

        socket.emit("riwayat", messages);
        io.to("umum").emit("online", [...users.values()]);
    });

    socket.on("pesan", (teks) => {
        const nama = users.get(socket.id);
        if (!nama) return;

        teks = String(teks || "").trim().slice(0, 2000);
        if (!teks) return;

        const pesan = {
            nama,
            teks,
            waktu: new Date().toISOString()
        };

        messages.push(pesan);
        if (messages.length > 200) messages.shift();

        io.to("umum").emit("pesan-baru", pesan);
    });

    socket.on("gambar", (url) => {
        const nama = users.get(socket.id);
        if (!nama || typeof url !== "string") return;

        const filename = path.basename(url);
        if (url !== "/uploads/" + filename) return;
        if (!fs.existsSync(path.join("uploads", filename))) return;

        const pesan = {
            nama,
            gambar: url,
            waktu: new Date().toISOString()
        };

        messages.push(pesan);
        if (messages.length > 200) messages.shift();

        io.to("umum").emit("pesan-baru", pesan);
    });

    socket.on("disconnect", () => {
        users.delete(socket.id);
        io.to("umum").emit("online", [...users.values()]);
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Chat berjalan di port ${PORT}`);
});
