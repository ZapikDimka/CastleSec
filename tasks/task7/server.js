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
    database: process.env.PGDATABASE
});

async function initDb() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS employees (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                secret_data TEXT
            );
        `);

        // Перевіряємо, чи є дані
        const { rows } = await client.query('SELECT count(*) FROM employees');
        if (parseInt(rows[0].count) > 0) return;

        console.log("Seeding DB...");
        const staff = [
            { n: "Alex", r: "Guard", s: "Code: 7712" },
            { n: "Sam", r: "Manager", s: "Salary: 5000" },
            { n: "Eve", r: "Director", s: "Password: admin" },
            { n: "Bob", r: "Janitor", s: "Likes cats" }
        ];

        for (const s of staff) {
            await client.query(
                `INSERT INTO employees (name, role, secret_data) VALUES ($1, $2, $3)`,
                [s.n, s.r, s.s]
            );
        }
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
    }
}

// --- ВРАЗЛИВИЙ ЕНДПОІНТ ---
app.post("/api/search", async (req, res) => {
    const userInput = req.body.name || "";

    // Вразливість: пряма конкатенація
    const sql = `SELECT id, name, role, secret_data FROM employees WHERE name = '${userInput}'`;

    try {
        const result = await pool.query(sql);
        res.json({
            ok: true,
            rows: result.rows,
            debugSql: sql // Повертаємо SQL, щоб показати його юзеру
        });
    } catch (e) {
        res.status(400).json({
            ok: false,
            error: e.message,
            debugSql: sql
        });
    }
});

initDb().then(() => {
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
});