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

// --- Ініціалізація та наповнення бази даних ---
async function initDb() {
    const client = await pool.connect();
    try {
        console.log("Preparing STAFF database...");

        // 0. Видаляємо старі таблиці для чистого старту
        await client.query(`DROP TABLE IF EXISTS STAFF_all, STAFF_Service, STAFF_Guard, STAFF_Command CASCADE;`);

        // 1. ГОЛОВНА ТАБЛИЦЯ (STAFF_all)
        // Містить базову інфу та підказки-зірочки
        await client.query(`
            CREATE TABLE IF NOT EXISTS STAFF_all (
                                                     id SERIAL PRIMARY KEY,
                                                     full_name TEXT,
                                                     position TEXT,
                                                     security_stars TEXT
            );
        `);

        // 2. ПРИХОВАНІ ТАБЛИЦІ (Детальна інформація)
        await client.query(`CREATE TABLE IF NOT EXISTS STAFF_Service (id SERIAL PRIMARY KEY, full_name TEXT, task TEXT, secret_code TEXT);`);
        await client.query(`CREATE TABLE IF NOT EXISTS STAFF_Guard (id SERIAL PRIMARY KEY, full_name TEXT, rank TEXT, secret_code TEXT);`);
        await client.query(`CREATE TABLE IF NOT EXISTS STAFF_Command (id SERIAL PRIMARY KEY, full_name TEXT, clearance TEXT, secret_code TEXT);`);

        // --- НАПОВНЕННЯ ДАНИМИ ---

        // Рівень *: Обслуга
        await client.query(`INSERT INTO STAFF_all (full_name, position, security_stars) VALUES ('Alina Hrytsenko', 'Archivist', '*')`);
        await client.query(`INSERT INTO STAFF_Service (full_name, task, secret_code) VALUES ('Alina Hrytsenko', 'Managing ancient firewall scrolls', NULL)`);

        // Рівень **: Охорона
        await client.query(`INSERT INTO STAFF_all (full_name, position, security_stars) VALUES ('Danylo Marchenko', 'Guard Captain', '**')`);
        await client.query(`INSERT INTO STAFF_Guard (full_name, rank, secret_code) VALUES ('Danylo Marchenko', 'Elite Guard', NULL)`);

        // Рівень ***: Командування (ЦІЛЬ)
        await client.query(`INSERT INTO STAFF_all (full_name, position, security_stars) VALUES ('Zalizny General', 'Supreme Commander', '***')`);

        // Тільки тут ми ховаємо прапор
        await client.query(`INSERT INTO STAFF_Command (full_name, clearance, secret_code) VALUES ('Zalizny General', 'Level 10+', 'FLAG{FULL_N4ME_UN1ON_M4ST3R}')`);

        console.log("Database seeded successfully. Tables: STAFF_all, STAFF_Service, STAFF_Guard, STAFF_Command.");
    } catch (e) {
        console.error("DB Init Error:", e);
    } finally {
        client.release();
    }
}

// --- ВРАЗЛИВИЙ API ПОШУКУ ---
app.post("/api/search", async (req, res) => {
    // Отримуємо ввід користувача. Ключ тепер 'search'
    const name = req.body.search || "";

    // ВРАЗЛИВИЙ ЗАПИТ:
    // 1. Використовуємо full_name замість name.
    // 2. Використовуємо оператор '=' замість LIKE для строгої відповідності.
    // 3. Пряма конкатенація робить код вразливим до ін'єкцій.
    const sql = `SELECT id, full_name, position, security_stars FROM STAFF_all WHERE full_name = '${name}'`;

    console.log("Executing SQL:", sql);

    try {
        const result = await pool.query(sql);
        res.json({
            ok: true,
            rows: result.rows,
            debugSql: sql // Передаємо сформований запит для відображення у UI
        });
    } catch (e) {
        res.json({
            ok: false,
            error: "SQL Error",
            detail: e.message,
            debugSql: sql
        });
    }
});

app.get("/health", async (_req, res) => {
    try {
        await pool.query("SELECT 1;");
        res.json({ status: "ok" });
    } catch {
        res.status(500).json({ status: "db_error" });
    }
});

// Завершення роботи
const shutdown = () => pool.end().finally(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

initDb().then(() => {
    app.listen(PORT, () => console.log(`Castle Directory running on port ${PORT}`));
}).catch(e => {
    console.error("Startup error:", e);
});