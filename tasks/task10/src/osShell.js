import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";

const JAIL = "/tower";              // "корінь" гри
const TIMEOUT_MS = 1500;
const MAX_OUTPUT = 120_000;

function shellSplit(s) {
  const out = [];
  let cur = "";
  let q = null; // "'" | '"'
  let esc = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (esc) {
      cur += ch;
      esc = false;
      continue;
    }

    if (ch === "\\") {
      esc = true;
      continue;
    }

    if (q) {
      if (ch === q) q = null;
      else cur += ch;
      continue;
    }

    if (ch === "'" || ch === '"') {
      q = ch;
      continue;
    }

    if (/\s/.test(ch)) {
      if (cur) out.push(cur), (cur = "");
      continue;
    }

    cur += ch;
  }

  if (cur) out.push(cur);
  return out;
}

function splitStatements(s) {
  // розділювачі: ;  &&  \n  (ігноруємо всередині лапок)
  const parts = [];
  let buf = "";
  let q = null;
  let esc = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const next = s[i + 1];

    if (esc) {
      buf += ch;
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      buf += ch;
      continue;
    }

    if (q) {
      if (ch === q) q = null;
      buf += ch;
      continue;
    }

    if (ch === "'" || ch === '"') {
      q = ch;
      buf += ch;
      continue;
    }

    if (ch === "\n" || ch === ";") {
      const t = buf.trim();
      if (t) parts.push(t);
      buf = "";
      continue;
    }

    if (ch === "&" && next === "&") {
      const t = buf.trim();
      if (t) parts.push(t);
      buf = "";
      i++;
      continue;
    }

    buf += ch;
  }

  const t = buf.trim();
  if (t) parts.push(t);
  return parts;
}

function ensureInJail(abs) {
  const norm = path.posix.normalize(abs);
  return norm === JAIL || norm.startsWith(JAIL + "/") ? norm : null;
}

function resolveInJail(p, cwdAbs) {
  const base = cwdAbs || path.posix.join(JAIL, "well");
  const raw = p?.startsWith("/")
      ? path.posix.join(JAIL, p) // "/" означає корінь гри
      : path.posix.join(base, p || "");

  return ensureInJail(raw);
}

function prettyPwd(cwdAbs) {
  const rel = path.posix.relative(JAIL, cwdAbs);
  return rel ? `/${rel}` : "/";
}

async function spawnCapture(cmd, args, cwdAbs) {
  return await new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: cwdAbs,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let out = "";
    let err = "";

    const kill = (msg) => {
      try { child.kill("SIGKILL"); } catch {}
      resolve(msg);
    };

    const timer = setTimeout(() => kill(`${cmd}: timeout`), TIMEOUT_MS);

    const onData = (d, isErr) => {
      const str = d.toString("utf-8");
      if (isErr) err += str;
      else out += str;

      if (out.length + err.length > MAX_OUTPUT) {
        clearTimeout(timer);
        kill(`${cmd}: output limit exceeded`);
      }
    };

    child.stdout.on("data", (d) => onData(d, false));
    child.stderr.on("data", (d) => onData(d, true));

    child.on("close", () => {
      clearTimeout(timer);
      const text = (out || err || "").trimEnd();
      resolve(text || "");
    });

    child.on("error", () => {
      clearTimeout(timer);
      resolve(`${cmd}: failed to execute`);
    });
  });
}

function rewritePathArgsForLs(args, cwdAbs) {
  // підтримка: ls [options] [--] [paths...]
  const out = [];
  let afterDoubleDash = false;

  for (const a of args) {
    if (a === "--") {
      afterDoubleDash = true;
      out.push(a);
      continue;
    }

    const isOption = !afterDoubleDash && a.startsWith("-");
    if (isOption) {
      out.push(a);
      continue;
    }

    const resolved = resolveInJail(a, cwdAbs);
    if (!resolved) return { ok: false, args: [], msg: "ls: access denied" };
    out.push(resolved);
  }

  return { ok: true, args: out };
}

function rewritePathArgSingle(arg, cwdAbs, label) {
  const resolved = resolveInJail(arg, cwdAbs);
  if (!resolved) return { ok: false, path: "", msg: `${label}: access denied` };
  return { ok: true, path: resolved };
}

export async function runOsShell(command) {
  const statements = splitStatements(command);
  const outputs = [];

  let cwdAbs = path.posix.join(JAIL, "well");

  for (const stmt of statements) {
    const argv = shellSplit(stmt);
    const name = (argv[0] || "").toLowerCase();
    const args = argv.slice(1);

    if (!name) continue;

    // builtins
    if (name === "pwd") {
      outputs.push(prettyPwd(cwdAbs));
      continue;
    }

    if (name === "cd") {
      const target = args[0];
      if (!target) {
        outputs.push("cd: missing dir");
        continue;
      }
      const r = rewritePathArgSingle(target, cwdAbs, "cd");
      if (!r.ok) {
        outputs.push(r.msg);
        continue;
      }
      try {
        const st = await fs.stat(r.path);
        if (!st.isDirectory()) outputs.push("cd: not a directory");
        else cwdAbs = r.path;
      } catch {
        outputs.push("cd: no such directory");
      }
      continue;
    }

    if (name === "echo") {
      outputs.push(args.join(" "));
      continue;
    }

    if (name === "help") {
      outputs.push(
          [
            "Allowed commands:",
            "  ls [opts] [--] [path...]",
            "  cat <path>",
            "  cd <dir>",
            "  pwd",
            "  whoami | id | uname | date",
            "  ping <host>  (only localhost/127.0.0.1)",
          ].join("\n")
      );
      continue;
    }

    // whitelist external
    if (name === "ls") {
      const rr = rewritePathArgsForLs(args, cwdAbs);
      if (!rr.ok) {
        outputs.push(rr.msg);
        continue;
      }
      outputs.push(await spawnCapture("ls", rr.args, cwdAbs));
      continue;
    }

    if (name === "cat") {
      const target = args[0];
      if (!target) {
        outputs.push("cat: missing path");
        continue;
      }
      const r = rewritePathArgSingle(target, cwdAbs, "cat");
      if (!r.ok) {
        outputs.push(r.msg);
        continue;
      }
      outputs.push(await spawnCapture("cat", [r.path], cwdAbs));
      continue;
    }

    if (name === "whoami" || name === "id" || name === "uname" || name === "date") {
      outputs.push(await spawnCapture(name, args, cwdAbs));
      continue;
    }

    if (name === "ping") {
      const host = String(args[0] || "").trim().toLowerCase();
      if (!(host === "localhost" || host === "127.0.0.1")) {
        outputs.push("ping: forbidden host (allowed: localhost, 127.0.0.1)");
        continue;
      }
      outputs.push(await spawnCapture("ping", ["-c", "1", "-W", "1", host], cwdAbs));
      continue;
    }

    outputs.push(`${name}: command not found`);
  }

  return outputs.join("\n");
}