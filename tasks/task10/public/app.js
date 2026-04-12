// public/app.js
const $ = (id) => document.getElementById(id);

const targetEl = $("target");
const btnPing = $("btnPing");
const cmdShownEl = $("cmdShown");
const outputEl = $("output");

const passwordEl = $("password");
const btnCheck = $("btnCheck");
const checkResultEl = $("checkResult");

function setBusy(isBusy) {
    btnPing.disabled = isBusy;
    btnCheck.disabled = isBusy;
    btnPing.textContent = isBusy ? "..." : "Відправити";
    btnCheck.textContent = isBusy ? "..." : "Перевірити";
}

async function postJSON(url, payload) {
    const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    // читаємо тіло навіть при 401/500, щоб показати message
    const text = await resp.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { ok: false, message: text || "Bad JSON from server" };
    }

    return { resp, data };
}

async function doPing() {
    const target = String(targetEl.value ?? "").trim();
    cmdShownEl.textContent = target ? `ping ${target}` : "—";
    outputEl.textContent = "…";

    setBusy(true);
    try {
        const { resp, data } = await postJSON("/api/tower/ping", { target });

        if (!resp.ok || !data.ok) {
            outputEl.textContent =
                `HTTP ${resp.status}\n` + (data?.message || "Ping failed");
            return;
        }

        cmdShownEl.textContent = data.commandShown ?? cmdShownEl.textContent;
        outputEl.textContent = data.output ?? "";
    } catch (e) {
        outputEl.textContent = `Network error: ${e?.message || e}`;
    } finally {
        setBusy(false);
    }
}

async function doCheck() {
    const password = String(passwordEl.value ?? "").trim();
    checkResultEl.textContent = "…";

    setBusy(true);
    try {
        const { resp, data } = await postJSON("/api/check", { password });

        if (!resp.ok || !data.ok) {
            checkResultEl.textContent = data?.message || `HTTP ${resp.status}`;
            return;
        }

        checkResultEl.textContent = data.message || "OK";
    } catch (e) {
        checkResultEl.textContent = `Network error: ${e?.message || e}`;
    } finally {
        setBusy(false);
    }
}

btnPing.addEventListener("click", doPing);
btnCheck.addEventListener("click", doCheck);

targetEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doPing();
});

passwordEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doCheck();
});