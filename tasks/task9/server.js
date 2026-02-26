const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// Config
const PORT = Number(process.env.PORT || 8080);
const BASE_DIR = process.env.BASE_DIR || "/data/keep/west_tower/library/scriptorium";
const FLAG_FILE = process.env.FLAG_FILE || "/data/keep/royal_quarter/inner_palace/antechamber/seal_vault/royal_sigil.txt";
const KEEP_DIR = process.env.KEEP_DIR || "/data/keep";

// Serve frontend
app.use("/", express.static(path.join(__dirname, "public")));

// Pretty routes
app.get("/reader", (req, res) => res.sendFile(path.join(__dirname, "public", "reader.html")));

// Helpers
function safeStat(p) { try { return fs.statSync(p); } catch { return null; } }

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

function hasTraversal(rel) {
  return rel.split("/").some(seg => seg === "..");
}

function loreForResolved(resolved) {
  // "Room state" oracle (no raw paths)
  if (resolved.startsWith(path.join(KEEP_DIR, "royal_chamber"))) return "Ти біля Королівської кімнати.";
  if (resolved.startsWith(path.join(KEEP_DIR, "west_tower", "library"))) return "Ти все ще в бібліотечному крилі Західної Вежі.";
  if (resolved.startsWith(path.join(KEEP_DIR, "west_tower"))) return "Ти в Західній Вежі.";
  if (resolved.startsWith(KEEP_DIR)) return "Ти у Цитаделі (Keep).";
  return "Ти в темному коридорі замку.";
}


function isInside(resolvedPath, root) {
  const rootResolved = path.resolve(root) + path.sep;
  const pResolved = path.resolve(resolvedPath) + path.sep;
  return pResolved.startsWith(rootResolved);
}

function canListDirectory(resolvedDir) {
  // Player should see BOTH lore and directories, but not everywhere.
  // Listing is allowed:
  // 1) inside BASE_DIR (scriptorium) — exploration / finding scrolls
  // 2) inside KEEP_DIR (citadel) — once the player "counts ../" correctly, they can browse rooms there
  const baseResolved = path.resolve(BASE_DIR) + path.sep;
  const keepResolved = path.resolve(KEEP_DIR) + path.sep;
  const dirResolved = path.resolve(resolvedDir) + path.sep;

  return dirResolved.startsWith(baseResolved) || dirResolved.startsWith(keepResolved);
}

// API: list visible scrolls (BASE_DIR files only)
app.get("/api/list", (req, res) => {
  const st = safeStat(BASE_DIR);
  if (!st || !st.isDirectory()) return res.status(500).json({ ok: false, error: "BASE_DIR is not a directory" });

  const items = fs.readdirSync(BASE_DIR, { withFileTypes: true })
    .filter(d => d.isFile())
    .map(d => d.name)
    .sort((a, b) => a.localeCompare(b));

  res.json({ ok: true, baseDirLabel: "Скрипторій", items });
});

// API: read file/dir by ?path= (INTENTIONALLY VULNERABLE)
app.get("/api/read", (req, res) => {
  const rel = String(req.query.path || "");
  if (!rel) return res.status(400).json({ ok: false, error: "Missing ?path=" });

  const cookies = parseCookies(req.headers.cookie);
  const seenUp = cookies.t9_seen_up === "1";

  // Vulnerable join (no boundary checks) — for gameplay
  const target = path.join(BASE_DIR, rel);
  const resolved = path.resolve(target);
  const lore = loreForResolved(resolved);

  // One-time hint when traversal is used first time
  if (!seenUp && hasTraversal(rel)) {
    res.setHeader("Set-Cookie", "t9_seen_up=1; Path=/; Max-Age=86400; SameSite=Lax");
    return res.status(400).json({
      ok: false,
      error: "Ти відсунув полицю — знайшов прихований прохід.",
      lore,
      hint: "Кажуть, у Цитаделі є Королівська кімната з королівським файлом. Підбери кількість кроків вгору, щоб вийти з Вежі до Цитаделі."
    });
  }

  fs.stat(target, (stErr, st) => {
    if (stErr) {
      return res.status(404).json({ ok: false, error: "Not found", lore });
    }

    if (st.isDirectory()) {
      const allowed = canListDirectory(resolved);

      if (!allowed) {
        return res.status(403).json({
          ok: false,
          error: "Запечатане крило (перелік не показується).",
          lore
        });
      }

      let items = [];
      try {
        items = fs.readdirSync(target, { withFileTypes: true })
          .filter(d => {
            // Variant A: in Keep we list only rooms (directories), not files.
            // In the open Scriptorium we list everything.
            const insideBase = isInside(resolved, BASE_DIR);
            return insideBase ? true : d.isDirectory();
          })
          .map(d => ({
            name: d.name,
            kind: d.isDirectory() ? "dir" : "file"
          }))
          .sort((a, b) => (a.kind + a.name).localeCompare(b.kind + b.name));
} catch {
        return res.status(500).json({ ok: false, error: "Cannot read directory", lore });
      }

      const insideBase = isInside(resolved, BASE_DIR);
      return res.json({
        ok: true,
        type: "dir",
        path: rel,
        lore,
        filesHidden: !insideBase,
        note: insideBase ? undefined : "У цьому крилі видно лише кімнати. Назви книг потрібно знати точно.",
        items
      });
}

    fs.readFile(target, "utf8", (err, data) => {
      if (err) return res.status(404).json({ ok: false, error: "Not found", lore });
      return res.json({ ok: true, type: "file", path: rel, data, lore });
    });
  });
});

// API: submit flag
app.post("/api/submit", (req, res) => {
  const input = String((req.body && req.body.flag) || "").trim();

  let expected = "";
  try { expected = fs.readFileSync(FLAG_FILE, "utf8").trim(); }
  catch { return res.status(500).json({ ok: false, error: "Flag file is missing on server" }); }

  if (!input) return res.status(400).json({ ok: false, error: "Empty flag" });

  if (input === expected) {
    return res.json({ ok: true, message: "✅ Flag accepted. The Librarian nods silently." });
  }
  return res.status(400).json({ ok: false, error: "❌ Wrong flag" });
});

app.get("/healthz", (req, res) => res.type("text").send("ok"));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[T9] listening on :${PORT}`);
  console.log(`[T9] BASE_DIR=${BASE_DIR}`);
  console.log(`[T9] KEEP_DIR=${KEEP_DIR}`);
  console.log(`[T9] FLAG_FILE=${FLAG_FILE}`);
});
