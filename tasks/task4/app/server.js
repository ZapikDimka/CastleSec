const express = require("express");
const path = require("path");
const { execFile } = require("child_process");

const app = express();
const PORT = Number(process.env.PORT) || 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// /info — конфіг + env (витік SECRET_KEY через env_dump)
app.get("/info", (req, res) => {
    res.json({
        app_name: "GlassHouse",
        version: "0.9.1-beta",
        environment: {
            NODE_VERSION: process.version,
            PLATFORM: process.platform,
            NODE_ENV: process.env.NODE_ENV || "unknown",
            DEBUG_LEVEL: process.env.DEBUG_LEVEL || "off"
        },
        env_dump: process.env
    });
});

// /status — printenv (альтернатива витоку)
app.get("/status", (req, res) => {
    execFile("printenv", { timeout: 2000, maxBuffer: 1024 * 1024 }, (err, stdout) => {
        res.type("text/plain");
        if (err) return res.status(200).send(JSON.stringify(process.env, null, 2));
        res.status(200).send(stdout.trim());
    });
});

// Серверна перевірка ключа
app.post("/api/verify-key", (req, res) => {
    const userKey = String(req.body?.key || "").trim();
    const realKey = String(process.env.SECRET_KEY || "").trim();

    if (!realKey) return res.status(500).json({ ok: false, error: "SECRET_KEY is not configured" });

    if (userKey !== realKey) return res.status(401).json({ ok: false });

    return res.status(200).json({ ok: true, unlocked: "phase2_garrison" });
});

app.use((req, res) => res.status(404).type("text/plain").send("Not found"));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
