import express from "express";
import helmet from "helmet";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import util from "util";

const execPromise = util.promisify(exec);

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "64kb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Static фронтенд
app.use("/", express.static(path.join(__dirname, "..", "public")));

// Використовуємо /tmp, оскільки користувач `node` в Docker не має доступу до кореня `/`
const ROOT = "/tmp/tower";

async function initTowerFS() {
    // Реальна структура в контейнері
    await fs.mkdir(`${ROOT}/well`, { recursive: true });
    await fs.mkdir(`${ROOT}/archives/vault`, { recursive: true });

    await fs.writeFile(
        `${ROOT}/well/readme.txt`,
        [
            "Тут глибоко. Колодязь дає лише відлуння.",
            "Кажуть, справжні секрети ховають вище — у архівах.",
            "Порада: знайди, як дізнатися поточну директорію та як переміщатися між ними.",
        ].join("\n"),
        "utf-8"
    );

    await fs.writeFile(
        `${ROOT}/archives/ledger.txt`,
        [
            "Журнал архіваріуса:",
            "— сховище позначене як 'vault'",
            "— вхід у глибині архівів",
            "— прапор зберігається не в корені, а поряд із замком.",
        ].join("\n"),
        "utf-8"
    );

    await fs.writeFile(
        `${ROOT}/archives/vault/lock.txt`,
        [
            "Замок простий: потрібен лише правильний пароль.",
            "Підказка: шукай file з назвою, що очевидна для CTF 🙂",
        ].join("\n"),
        "utf-8"
    );

    const expected = String(process.env.TASK10_PASSWORD ?? "FLAG{unset}");
    await fs.writeFile(`${ROOT}/archives/vault/flag.txt`, expected, "utf-8");
}

// API: “вежа” (СПРАВЖНЯ ВРАЗЛИВІСТЬ)
app.post("/api/tower/ping", async (req, res) => {
    const target = String(req.body?.target ?? "").trim();

    // Додано -c 1 для Linux, щоб ping не тривав вічно.
    const command = `ping -c 1 ${target}`;

    try {
        // Виконуємо команду в системі. Задаємо cwd, щоб гравець "починав" з правильної папки.
        const { stdout, stderr } = await execPromise(command, {
            cwd: `${ROOT}/well`,
            timeout: 5000 // Захист від зависання на 5 секунд
        });

        res.json({ ok: true, output: stdout || stderr, commandShown: command });
    } catch (error) {
        // Якщо команда падає (наприклад, ping не знайшов хост, або гравцем введено "127.0.0.1; false"),
        // ми все одно повертаємо вивід, щоб гравець бачив результат виконання своїх ін'єкцій.
        const output = error.stdout || error.stderr || error.message;
        res.json({ ok: true, output: output, commandShown: command });
    }
});

// API: перевірка “пароля”
app.post("/api/check", (req, res) => {
    const password = String(req.body?.password ?? "").trim();
    const expected = String(process.env.TASK10_PASSWORD ?? "");

    if (!expected) {
        return res.status(500).json({ ok: false, message: "Server misconfigured" });
    }

    if (password === expected) {
        return res.json({ ok: true, message: "✅ Прийнято. Брама відгукнулась.", flag: expected });
    }

    return res.status(401).json({ ok: false, message: "❌ Невірний пароль." });
});

// Health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

await initTowerFS();

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
    console.log(`[task10] listening on :${port} (DANGER: REAL RCE ENABLED)`);
});