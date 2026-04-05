const API_URL = "http://127.0.0.1:8000";

console.log("CastleSec app.js build 2026-04-06-3");

let mapState = {
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    startX: 0,
    startY: 0
};

let taskLaunchInProgress = false;

function assetUrl(name) {
    return `${API_URL}/assets/${encodeURIComponent(name)}`;
}

async function fetchCurrentState() {
    const url = `${API_URL}/current-state?_ts=${Date.now()}`;
    const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: {
            "accept": "application/json",
            "cache-control": "no-cache"
        }
    });

    if (!response.ok) {
        throw new Error("Server unreachable");
    }

    return await response.json();
}

async function waitForTaskUrl(timeoutMs = 60000, delayMs = 700) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        const data = await fetchCurrentState();

        if (!data.is_solving_task) {
            return data;
        }

        if (data.task_url) {
            return data;
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw new Error("Task startup timeout");
}

async function updateState() {
    try {
        const data = await fetchCurrentState();
        const overlay = document.getElementById("taskOverlay");
        const overlayShown = overlay && overlay.classList.contains("show");

        if (data.is_solving_task && data.task_url && !overlayShown) {
            log(`SYSTEM: Модуль активовано: ${data.task_url}`);
            openTask(data.task_url);
        }

        if (!data.is_solving_task && overlayShown) {
            hideTaskOverlay();
        }

        renderGame(data);
    } catch (err) {
        log("ERROR: Не вдалося отримати стан з API.");
        document.getElementById("sceneTitle").innerText = "Connection Error";
    }
}

async function doAction(index) {
    if (taskLaunchInProgress) {
        return;
    }

    taskLaunchInProgress = true;

    try {
        const response = await fetch(`${API_URL}/perform-action/${index}`, {
            method: "POST",
            cache: "no-store",
            headers: { "accept": "application/json" }
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.detail || "Action failed");
        }

        const immediateState = await fetchCurrentState();

        if (!immediateState.is_solving_task) {
            renderGame(immediateState);
            return;
        }

        if (immediateState.task_url) {
            renderGame(immediateState);
            const overlay = document.getElementById("taskOverlay");
            if (overlay && !overlay.classList.contains("show")) {
                log(`SYSTEM: Модуль активовано: ${immediateState.task_url}`);
                openTask(immediateState.task_url);
            }
            return;
        }

        renderGame(immediateState);
        log("SYSTEM: Очікування запуску модуля...");

        const readyState = await waitForTaskUrl();

        renderGame(readyState);

        const overlay = document.getElementById("taskOverlay");
        if (readyState.task_url && overlay && !overlay.classList.contains("show")) {
            log(`SYSTEM: Модуль активовано: ${readyState.task_url}`);
            openTask(readyState.task_url);
        }
    } catch (err) {
        log(`ERROR: Помилка при відправці дії. ${err.message || ""}`.trim());
    } finally {
        taskLaunchInProgress = false;
    }
}

async function solveCurrentTask() {
    try {
        const response = await fetch(`${API_URL}/task/solve-current`, {
            method: "POST",
            cache: "no-store"
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.detail || "Solve request failed");
        }

        log("SYSTEM: Завдання позначене як вирішене.");
        hideTaskOverlay();
        await updateState();
    } catch (err) {
        log(`ERROR: Не вдалося завершити завдання. ${err.message || ""}`.trim());
    }
}

function renderGame(data) {
    document.getElementById("isSolving").innerText = data.is_solving_task ? "ACTIVE" : "FALSE";
    document.getElementById("sceneTitle").innerText = data.node.name || "Unknown";
    document.getElementById("sceneSub").innerText = data.is_solving_task ? "Потрібне вирішення завдання" : "Локація дослідження";
    document.getElementById("sceneDescText").innerText = data.node.text || "";

    const imgBox = document.getElementById("sceneImgBox");
    if (data.node.image) {
        imgBox.innerHTML = `<img src="${assetUrl(data.node.image)}" alt="${data.node.name}" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
        imgBox.innerHTML = `<div style="color:var(--muted)">No Image Signal</div>`;
    }

    const btnRow = document.getElementById("navButtons");
    btnRow.innerHTML = "";

    if (data.actions) {
        data.actions.forEach((act, idx) => {
            const btn = document.createElement("button");
            btn.className = "primary";
            btn.innerText = act.text;
            btn.onclick = () => {
                log(`Виконую: ${act.text}`);
                doAction(idx);
            };
            btnRow.appendChild(btn);
        });
    }

    const invBox = document.getElementById("inventoryContainer");
    invBox.innerHTML = "";
    const items = data.inventory?.items || [];

    if (items.length === 0) {
        invBox.innerHTML = `<div style="font-size:13px; color:var(--muted); text-align:center; padding:10px;">Порожньо</div>`;
    } else {
        items.forEach(item => {
            const itemEl = document.createElement("div");
            itemEl.className = "inv-item";

            if (item.image) {
                itemEl.innerHTML = `<img src="${assetUrl(item.image)}" alt="icon" style="max-height: 50px"><div class="inv-name">${item.name}</div>`;
            } else {
                itemEl.innerHTML = `<div class="inv-name">${item.name}</div>`;
            }

            invBox.appendChild(itemEl);
        });
    }
}

function openTask(url) {
    const overlay = document.getElementById("taskOverlay");
    const iframe = document.getElementById("taskIframe");

    iframe.src = url;
    overlay.classList.add("show");
}

function hideTaskOverlay() {
    const overlay = document.getElementById("taskOverlay");
    const iframe = document.getElementById("taskIframe");

    overlay.classList.remove("show");
    iframe.src = "about:blank";
}

async function closeTask() {
    try {
        const response = await fetch(`${API_URL}/task/close-current`, {
            method: "POST",
            cache: "no-store"
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.detail || "Close request failed");
        }

        log("SYSTEM: Завдання закрито користувачем.");
    } catch (err) {
        log(`ERROR: Не вдалося закрити завдання. ${err.message || ""}`.trim());
    } finally {
        hideTaskOverlay();
        await updateState();
    }
}

function toggleMap() {
    const overlay = document.getElementById("mapOverlay");
    overlay.classList.toggle("show");
    if (overlay.classList.contains("show")) {
        mapState = { zoom: 1, offsetX: 0, offsetY: 0, isDragging: false };
        buildMap();
        initMapControls();
    }
}

function initMapControls() {
    const container = document.getElementById("mapContainer");

    container.onwheel = (e) => {
        e.preventDefault();

        const zoomSpeed = 0.1;
        const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
        const oldZoom = mapState.zoom;
        const newZoom = Math.min(Math.max(oldZoom + delta, 0.2), 3);

        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        mapState.offsetX -= (mouseX - mapState.offsetX) * (newZoom / oldZoom - 1);
        mapState.offsetY -= (mouseY - mapState.offsetY) * (newZoom / oldZoom - 1);
        mapState.zoom = newZoom;

        applyMapTransform();
    };

    container.onmousedown = (e) => {
        if (e.button !== 0) return;
        mapState.isDragging = true;
        mapState.startX = e.clientX - mapState.offsetX;
        mapState.startY = e.clientY - mapState.offsetY;
        container.style.cursor = "grabbing";
    };

    window.onmousemove = (e) => {
        if (!mapState.isDragging) return;
        mapState.offsetX = e.clientX - mapState.startX;
        mapState.offsetY = e.clientY - mapState.startY;
        applyMapTransform();
    };

    window.onmouseup = () => {
        mapState.isDragging = false;
        container.style.cursor = "default";
    };
}

function applyMapTransform() {
    const content = document.getElementById("mapContent");
    if (content) {
        content.style.transform = `translate(${mapState.offsetX}px, ${mapState.offsetY}px) scale(${mapState.zoom})`;
    }
}

async function buildMap() {
    const container = document.getElementById("mapContainer");
    container.innerHTML = `<div id="mapContent" style="position: absolute; top:0; left:0; transform-origin: 0 0;"></div>`;
    const content = document.getElementById("mapContent");

    try {
        const data = await fetchCurrentState();
        const gridScale = 2;
        const currentId = data.node.id;

        if (data.map_nodes) {
            const nodeLookup = new Map();
            data.map_nodes.forEach(n => nodeLookup.set(n.id, n));

            if (data.edges) {
                data.edges.forEach(edge => {
                    const n1 = nodeLookup.get(edge.from_id);
                    const n2 = nodeLookup.get(edge.to_id);
                    if (n1 && n2) createConnectionLine(n1, n2, content, gridScale);
                });
            }

            let targetNode = null;
            data.map_nodes.forEach(node => {
                const isCurrent = node.id === currentId;
                createNodeElement(node, content, gridScale, isCurrent);
                if (isCurrent) targetNode = node;
            });

            if (targetNode) centerMapOnNode(targetNode, gridScale);
            log("SYSTEM: Карта завантажена успішно.");
        }
    } catch (err) {
        log("ERROR: Не вдалося побудувати карту.");
    }
}

function centerMapOnNode(node, scale) {
    const container = document.getElementById("mapContainer");
    const centerX = container.clientWidth / 2;
    const centerY = container.clientHeight / 2;

    mapState.offsetX = centerX - (node.coords.x * scale * mapState.zoom);
    mapState.offsetY = centerY - (node.coords.y * scale * mapState.zoom);

    applyMapTransform();
}

function createNodeElement(node, container, scale, isCurrent) {
    const nodeEl = document.createElement("div");
    nodeEl.className = `map-node ${node.visited ? "" : "unvisited"} ${isCurrent ? "current-node" : ""}`;
    nodeEl.style.left = `${node.coords.x * scale}px`;
    nodeEl.style.top = `${node.coords.y * scale}px`;

    let nodeContent = `<div class="map-node-img-wrapper">`;
    if (node.visited) {
        nodeContent += `<img src="${assetUrl(node.image)}" class="map-node-img">`;
    } else {
        nodeContent += `<div class="lock-icon">🔒</div>`;
    }
    nodeContent += `</div><div class="map-node-name">${node.visited ? node.name : "??"}</div>`;
    nodeEl.innerHTML = nodeContent;
    container.appendChild(nodeEl);
}

function createConnectionLine(node1, node2, content, scale) {
    const x1 = node1.coords.x * scale;
    const y1 = node1.coords.y * scale;
    const x2 = node2.coords.x * scale;
    const y2 = node2.coords.y * scale;
    const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    const line = document.createElement("div");
    line.className = `map-connection ${(!node1.visited || !node2.visited) ? "dimmed" : ""}`;
    line.style.width = `${length}px`;
    line.style.left = `${x1}px`;
    line.style.top = `${y1}px`;
    line.style.transform = `rotate(${angle}deg)`;
    content.appendChild(line);
}

function log(msg) {
    const logEl = document.getElementById("gameLog");
    if (!logEl) return;
    const time = new Date().toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    logEl.innerText += `[${time}] ${msg}\n`;
    logEl.scrollTop = logEl.scrollHeight;
}

function showConfirm() { document.getElementById("confirmOverlay").classList.add("show"); }
function closeConfirm() { document.getElementById("confirmOverlay").classList.remove("show"); }
function confirmReset() { closeConfirm(); log("SYSTEM: Скидання стану..."); updateState(); }

window.addEventListener("message", async (event) => {
    const data = event.data || {};
    if (data.source !== "castlesec-task") return;

    if (data.type === "task-solved") {
        await solveCurrentTask();
    }
});

window.onload = async () => {
    await updateState();
};