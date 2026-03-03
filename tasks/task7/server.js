const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 8080;

const pool = new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
});

async function initDb() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                                                 id SERIAL PRIMARY KEY,
                                                 username TEXT UNIQUE NOT NULL,
                                                 password TEXT NOT NULL,
                                                 role TEXT NOT NULL
            );
        `);

        const { rows } = await client.query("SELECT count(*) FROM users");
        if (parseInt(rows[0].count, 10) > 0) return;

        console.log("Seeding DB (users)...");
        await client.query(
            "INSERT INTO users (username, password, role) VALUES ($1, $2, $3)",
            ["admin", "change_me", "admin"]
        );
        await client.query(
            "INSERT INTO users (username, password, role) VALUES ($1, $2, $3)",
            ["guard", "welcome", "user"]
        );
    } finally {
        client.release();
    }
}

// Vulnerable login endpoint (SQLi lab)
app.post("/api/login", async (req, res) => {
    const username = String(req.body?.username ?? "");
    const password = String(req.body?.password ?? "");

    // Vulnerability: string concatenation into SQL
    const sql =
        `SELECT id, username, role FROM users ` +
        `WHERE username = '${username}' AND password = '${password}' ` +
        `LIMIT 1`;

    try {
        const result = await pool.query(sql);

        if (result.rows.length !== 1) {
            return res.json({
                ok: false,
                error: "Invalid credentials",
                debug: { sql },
            });
        }

        const user = result.rows[0];
        const payload = { ok: true, user, debug: { sql } };

        if (user.role === "admin") {
            payload.flag = process.env.FLAG || "FLAG{missing_flag_env}";
        }

        return res.json(payload);
    } catch (e) {
        return res.status(400).json({
            ok: false,
            error: e.message,
            debug: { sql },
        });
    }
});

// Flag verification endpoint
app.post("/api/verify-flag", (req, res) => {
    const got = String(req.body?.flag ?? "").trim();
    const expected = String(process.env.FLAG ?? "").trim();
    return res.json({ ok: got.length > 0 && expected.length > 0 && got === expected });
});

initDb()
    .then(() => {
        app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
    })
    .catch((e) => {
        console.error("Startup failed:", e);
        process.exit(1);
    });