const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 8080;
const FLAG = process.env.FLAG || "FLAG{FULL_N4ME_UN1ON_M4ST3R}";

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
        console.log("Preparing STAFF database...");

        await client.query(
            `DROP TABLE IF EXISTS STAFF_all, STAFF_Service, STAFF_Guard, STAFF_Command CASCADE;`
        );

        await client.query(`
      CREATE TABLE IF NOT EXISTS STAFF_all (
        id SERIAL PRIMARY KEY,
        full_name TEXT,
        position TEXT,
        security_stars TEXT
      );
    `);

        await client.query(
            `CREATE TABLE IF NOT EXISTS STAFF_Service (id SERIAL PRIMARY KEY, full_name TEXT, task TEXT, secret_code TEXT);`
        );
        await client.query(
            `CREATE TABLE IF NOT EXISTS STAFF_Guard (id SERIAL PRIMARY KEY, full_name TEXT, rank TEXT, secret_code TEXT);`
        );
        await client.query(
            `CREATE TABLE IF NOT EXISTS STAFF_Command (id SERIAL PRIMARY KEY, full_name TEXT, clearance TEXT, secret_code TEXT);`
        );

        await client.query(
            `INSERT INTO STAFF_all (full_name, position, security_stars) VALUES ('Alina Hrytsenko', 'Archivist', '*')`
        );
        await client.query(
            `INSERT INTO STAFF_Service (full_name, task, secret_code) VALUES ('Alina Hrytsenko', 'Managing ancient firewall scrolls', NULL)`
        );

        await client.query(
            `INSERT INTO STAFF_all (full_name, position, security_stars) VALUES ('Danylo Marchenko', 'Guard Captain', '**')`
        );
        await client.query(
            `INSERT INTO STAFF_Guard (full_name, rank, secret_code) VALUES ('Danylo Marchenko', 'Elite Guard', NULL)`
        );

        await client.query(
            `INSERT INTO STAFF_all (full_name, position, security_stars) VALUES ('Zalizny General', 'Supreme Commander', '***')`
        );

        await client.query(
            "INSERT INTO STAFF_Command (full_name, clearance, secret_code) VALUES ($1, $2, $3)",
            ["Zalizny General", "Level 10+", FLAG]
        );

        console.log("Database seeded successfully.");
    } catch (e) {
        console.error("DB Init Error:", e);
    } finally {
        client.release();
    }
}

app.post("/api/search", async (req, res) => {
    const name = req.body.search || "";
    const sql = `SELECT id, full_name, position, security_stars FROM STAFF_all WHERE full_name = '${name}'`;

    console.log("Executing SQL:", sql);

    try {
        const result = await pool.query(sql);
        res.json({ ok: true, rows: result.rows, debugSql: sql });
    } catch (e) {
        res.json({ ok: false, error: "SQL Error", detail: e.message, debugSql: sql });
    }
});

// NEW: перевірка флагу
app.post("/api/submit-flag", async (req, res) => {
    const submitted = (req.body && req.body.flag ? String(req.body.flag) : "").trim();
    if (!submitted) return res.status(400).json({ ok: false, error: "Missing flag" });

    if (submitted === FLAG) return res.json({ ok: true, message: "FLAG ACCEPTED" });
    return res.json({ ok: false, message: "WRONG FLAG" });
});

app.get("/health", async (_req, res) => {
    try {
        await pool.query("SELECT 1;");
        res.json({ status: "ok" });
    } catch {
        res.status(500).json({ status: "db_error" });
    }
});

const shutdown = () => pool.end().finally(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

initDb()
    .then(() => app.listen(PORT, () => console.log(`Castle Directory running on port ${PORT}`)))
    .catch((e) => console.error("Startup error:", e));