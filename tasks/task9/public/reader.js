async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setHint(text) {
  const el = document.getElementById("hint");
  if (el) el.textContent = text || "";
}

function setOutput(text) {
  document.getElementById("output").textContent = text;
}

function renderDir(curPath, items) {
  const list = document.getElementById("dirList");
  list.innerHTML = "";

  for (const it of items) {
    const next = curPath ? (curPath.endsWith("/") ? curPath + it.name : curPath + "/" + it.name) : it.name;
    const a = document.createElement("a");
    a.className = "book";
    a.href = `/reader?path=${encodeURIComponent(next)}`;
    a.innerHTML = `<div style="font-weight:600">${it.kind === "dir" ? "📁" : "📄"} ${it.name}</div><div class="muted">${it.kind === "dir" ? "відкрити директорію" : "відкрити файл"}</div>`;
    list.appendChild(a);
  }
}

async function loadPath() {
  const p = (qs("path") || "").trim();
  setText("currentPath", p || "(порожньо)");
  setHint("");
  setOutput("...");
  renderDir("", []);

  if (!p) {
    setOutput("Укажи параметр у URL, наприклад: /reader?path=welcome.txt або /reader?path=.");
    setText("lore", "—");
    return;
  }

  const r = await fetchJSON(`/api/read?path=${encodeURIComponent(p)}`);
  const payload = r.data || {};

  setText("lore", payload.lore || "—");
  if (!r.ok) {
    setHint(payload.hint || "");
    setOutput(payload.error || `HTTP ${r.status}`);
    return;
  }

  if (payload.type === "dir") {
    setOutput(payload.note ? payload.note : "Це директорія. Обери сусідню полицю нижче.");
    renderDir(p, payload.items || []);
  } else {
    setOutput(payload.data || "");
  }
}

async function submitFlag() {
  const msg = document.getElementById("submitMsg");
  msg.textContent = "";
  const flag = document.getElementById("flagInput").value.trim();
  if (!flag) { msg.textContent = "Введи флаг."; return; }

  const r = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flag })
  });
  const data = await r.json().catch(() => ({}));
  msg.textContent = r.ok ? (data.message || "OK") : (data.error || `HTTP ${r.status}`);
}

document.getElementById("submitBtn").addEventListener("click", submitFlag);
loadPath();
