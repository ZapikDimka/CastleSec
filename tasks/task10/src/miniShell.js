// Безпечний «міні-shell»: НЕ виконує системні команди ОС.
// Дозволяє лише невеликий набір «псевдокоманд» для демонстрації ідеї command injection.

function nowIso() {
  return new Date().toISOString();
}

// Віртуальна файлово-директорійна структура.
// Завдання ускладнене: флаг НЕ лежить у корені — треба навігація через cd/pwd.
// Важливо: це лише VFS у пам'яті, жодного доступу до файлової системи ОС.

const FILES = new Map([
  [
    "/tower/well/readme.txt",
    () =>
      [
        "Тут глибоко. Колодязь дає лише відлуння.",
        "Кажуть, справжні секрети ховають вище — у архівах.",
        "Порада: знайди, як дізнатися поточну директорію та як переміщатися між ними.",
      ].join("\n"),
  ],
  [
    "/tower/archives/ledger.txt",
    () =>
      [
        "Журнал архіваріуса:",
        "— сховище позначене як 'vault'",
        "— вхід у глибині архівів",
        "— прапор зберігається не в корені, а поряд із замком.",
      ].join("\n"),
  ],
  [
    "/tower/archives/vault/lock.txt",
    () =>
      [
        "Замок простий: потрібен лише правильний пароль.",
        "Підказка: шукай file з назвою, що очевидна для CTF 🙂",
      ].join("\n"),
  ],
  // Флаг (пароль) лежить в іншій директорії.
  [
    "/tower/archives/vault/flag.txt",
    () => process.env.TASK10_PASSWORD || "FLAG{unset}",
  ],
  ["/etc/hostname", () => "signal-tower"],
]);

const DIRS = new Set(["/"]);
for (const p of FILES.keys()) {
  const parts = p.split("/").filter(Boolean);
  let cur = "";
  for (let i = 0; i < parts.length - 1; i++) {
    cur += "/" + parts[i];
    DIRS.add(cur);
  }
}

function splitIntoStatements(command) {
  // Симуляція shell-поведінки: розділювачі ; та && та \n.
  // Саме в цьому і «уразливість» концепту.
  return command
    .split(/\s*(?:;|&&|\n)\s*/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function tokenize(stmt) {
  // Дуже простий токенайзер: по пробілах (без кавичок).
  return stmt.split(/\s+/g).filter(Boolean);
}

function normalizePath(inputPath, cwd) {
  if (!inputPath) return null;
  const isAbs = inputPath.startsWith("/");
  const raw = isAbs ? inputPath : `${cwd}/${inputPath}`;

  const parts = raw.split("/");
  const out = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (out.length) out.pop();
      continue;
    }
    out.push(part);
  }
  return "/" + out.join("/");
}

function listDir(dirPath) {
  const dir = dirPath === "/" ? "/" : dirPath.replace(/\/+$/g, "");
  if (!DIRS.has(dir)) return null;

  const prefix = dir === "/" ? "/" : dir + "/";
  const names = new Map(); // name -> isDir

  // Директорії
  for (const d of DIRS) {
    if (!d.startsWith(prefix) || d === dir) continue;
    const rest = d.slice(prefix.length);
    if (!rest || rest.includes("/")) continue; // тільки 1-й рівень
    names.set(rest + "/", true);
  }

  // Файли
  for (const f of FILES.keys()) {
    if (!f.startsWith(prefix)) continue;
    const rest = f.slice(prefix.length);
    if (!rest || rest.includes("/")) continue; // тільки 1-й рівень
    names.set(rest, false);
  }

  return Array.from(names.keys()).sort();
}

function cmdHelp() {
  return [
    "Доступні команди:",
    "  ping <host>        — повертає PONG",
    "  echo <text>        — повертає текст",
    "  whoami             — показує користувача",
    "  date               — поточний час",
    "  pwd                — показує поточну директорію",
    "  cd <dir>           — змінює директорію",
    "  ls [dir]           — список у директорії",
    "  cat <path>         — читає віртуальний файл (абс/відносний шлях)",
    "  help               — ця довідка",
  ].join("\n");
}

function cmdLs(path, cwd) {
  const dir = path ? normalizePath(path, cwd) : cwd;
  if (!dir) return "ls: missing path";
  const items = listDir(dir);
  if (!items) return "ls: not a directory";
  return items.length ? items.join("\n") : "(empty)";
}

function cmdCat(path, cwd) {
  if (!path) return "cat: missing path";
  const abs = normalizePath(path, cwd);
  if (!abs) return "cat: missing path";
  if (!FILES.has(abs)) return "cat: access denied";
  const value = FILES.get(abs);
  return typeof value === "function" ? value() : String(value);
}

function cmdPing(host) {
  if (!host) return "ping: missing host";
  // Мінімальна «валідація» для правдоподібності, але не для безпеки (бо це симуляція).
  const safeHost = host.replace(/[^a-zA-Z0-9.:-]/g, "");
  return `PONG from ${safeHost}`;
}

function cmdCd(dir, cwd) {
  if (!dir) return { cwd, out: "cd: missing dir" };
  const target = normalizePath(dir, cwd);
  if (!target) return { cwd, out: "cd: missing dir" };
  if (!DIRS.has(target)) return { cwd, out: "cd: no such directory" };
  return { cwd: target, out: null };
}

export function runMiniShell(command) {
  const statements = splitIntoStatements(command);
  const outputs = [];

  // Стан «сесії» існує лише в межах одного запиту.
  // Тому для здобуття флага вигідно виконувати композитні команди через ; / &&.
  let cwd = "/tower/well";

  for (const stmt of statements) {
    const [name, ...args] = tokenize(stmt);
    switch ((name || "").toLowerCase()) {
      case "help":
        outputs.push(cmdHelp());
        break;
      case "echo":
        outputs.push(args.join(" "));
        break;
      case "whoami":
        outputs.push("tower");
        break;
      case "date":
        outputs.push(nowIso());
        break;
      case "ping":
        outputs.push(cmdPing(args[0]));
        break;
      case "pwd":
        outputs.push(cwd);
        break;
      case "cd": {
        const r = cmdCd(args[0], cwd);
        cwd = r.cwd;
        if (r.out) outputs.push(r.out);
        break;
      }
      case "ls":
        outputs.push(cmdLs(args[0], cwd));
        break;
      case "cat":
        outputs.push(cmdCat(args[0], cwd));
        break;
      default:
        outputs.push(`${name}: command not found`);
        break;
    }
  }

  return outputs.join("\n");
}
