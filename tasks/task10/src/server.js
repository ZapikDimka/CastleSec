import express from "express";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { runMiniShell } from "./miniShell.js";

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "64kb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Static фронтенд
app.use("/", express.static(path.join(__dirname, "..", "public")));

// API: симуляція "вежі"
app.post("/api/tower/ping", (req, res) => {
  const target = String(req.body?.target ?? "").trim();

  // «Уразливий» концепт: команда формується конкатенацією.
  // Але виконання йде через runMiniShell, а не через ОС.
  const command = `ping ${target}`;

  const output = runMiniShell(command);
  res.json({ ok: true, output, commandShown: command });
});

// API: перевірка "пароля"
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

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`[task10] listening on :${port}`);
});
