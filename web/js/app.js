const API_URL = "http://127.0.0.1:8000";

// Отримання поточного стану (GET /current-state)
async function updateState() {
    try {
        const response = await fetch(`${API_URL}/current-state`); // [cite: 6, 13]
        if (!response.ok) throw new Error("Server unreachable");

        const data = await response.json(); // [cite: 20]
        renderGame(data);
    } catch (err) {
        log("ERROR: Не вдалося отримати стан з API.");
        document.getElementById("sceneTitle").innerText = "Connection Error";
    }
}

// Виконання дії (POST /perform-action/{index})
async function doAction(index) {
    try {
        const response = await fetch(`${API_URL}/perform-action/${index}`, { // [cite: 84]
            method: 'POST',
            headers: { 'accept': 'application/json' } // [cite: 13, 61]
        });

        if (response.status === 422) { //
            log("SYSTEM: Помилка валідації (невірний індекс).");
            return;
        }

        await updateState();
    } catch (err) {
        log("ERROR: Помилка при відправці дії.");
    }
}

function renderGame(data) {
    document.getElementById("isSolving").innerText = data.is_solving_task ? "ACTIVE" : "FALSE";
    document.getElementById("sceneTitle").innerText = data.node.name || "Unknown";
    document.getElementById("sceneSub").innerText = data.is_solving_task ? "Потрібне вирішення завдання" : "Локація дослідження";
    document.getElementById("sceneDescText").innerText = data.node.text || "";

    // Рендер кнопок дій [cite: 27-35]
    const btnRow = document.getElementById("navButtons");
    btnRow.innerHTML = "";

    if (data.actions && data.actions.length > 0) {
        data.actions.forEach((act, idx) => {
            const btn = document.createElement("button");
            btn.className = "primary";
            btn.innerText = act.text;
            btn.onclick = () => {
                log(`Виконую: ${act.text}`);
                doAction(idx); // Передаємо індекс дії [cite: 88-91]
            };
            btnRow.appendChild(btn);
        });
    }

    // Рендер інвентарю [cite: 46-48, 75-82]
    const invBox = document.getElementById("inventoryContainer");
    invBox.innerHTML = "";
    const items = data.inventory?.items || [];

    if (items.length === 0) {
        invBox.innerHTML = `<div style="font-size:13px; color:var(--muted); text-align:center; padding:10px;">(Порожньо)</div>`;
    } else {
        items.forEach(item => {
            const itemEl = document.createElement("div");
            itemEl.className = "inv-item";
            itemEl.innerHTML = `<div style="font-size:13px">${item.name}</div>`;
            invBox.appendChild(itemEl);
        });
    }
}

function log(msg) {
    const logEl = document.getElementById("gameLog");
    const time = new Date().toLocaleTimeString('uk-UA', {hour: '2-digit', minute:'2-digit', second:'2-digit'});
    logEl.innerText = `[${time}] ${msg}\n` + logEl.innerText;
}

window.onload = updateState;