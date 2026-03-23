const API_URL = "http://127.0.0.1:8000";

let mapState = {
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    startX: 0,
    startY: 0
};

async function updateState() {
    try {
        const response = await fetch(`${API_URL}/current-state`);
        if (!response.ok) throw new Error("Server unreachable");

        const data = await response.json();
        renderGame(data);
    } catch (err) {
        log("ERROR: Не вдалося отримати стан з API.");
        document.getElementById("sceneTitle").innerText = "Connection Error";
    }
}

async function doAction(index) {
    try {
        const response = await fetch(`${API_URL}/perform-action/${index}`, {
            method: 'POST',
            headers: { 'accept': 'application/json' }
        });

        if (response.status === 422) {
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

    const imgBox = document.getElementById("sceneImgBox");
    if (data.node.image) {
        imgBox.innerHTML = `<img src="/game/assets/${data.node.image}" alt="${data.node.name}" style="width:100%; height:100%; object-fit:cover;">`;
    }

    const btnRow = document.getElementById("navButtons");
    btnRow.innerHTML = "";

    if (data.actions && data.actions.length > 0) {
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
            itemEl.innerHTML = `
                <img src="/game/assets/item_icon_placeholder.png" alt="icon" style="max-height: 50px">
                <div class="inv-name">${item.name}</div>
            `;
            invBox.appendChild(itemEl);
        });
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
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        mapState.zoom = Math.min(Math.max(mapState.zoom * delta, 0.5), 3);
        applyMapTransform();
    };

    container.onmousedown = (e) => {
        if (e.button !== 0) return;
        mapState.isDragging = true;
        mapState.startX = e.clientX - mapState.offsetX;
        mapState.startY = e.clientY - mapState.offsetY;
        container.style.cursor = 'grabbing';
    };

    window.onmousemove = (e) => {
        if (!mapState.isDragging) return;
        mapState.offsetX = e.clientX - mapState.startX;
        mapState.offsetY = e.clientY - mapState.startY;
        applyMapTransform();
    };

    window.onmouseup = () => {
        mapState.isDragging = false;
        container.style.cursor = 'default';
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
    container.innerHTML = `<div id="mapContent" style="position: absolute; inset: 0; transform-origin: 0 0;"></div>`;
    const content = document.getElementById("mapContent");

    try {
        const response = await fetch(`${API_URL}/current-state`);
        const data = await response.json();
        const gridScale = 250;
        const currentId = data.node.id;

        if (data.map_nodes) {
            if (data.edges) {
                const nodeLookup = new Map();
                data.map_nodes.forEach(n => nodeLookup.set(n.id, n));

                data.edges.forEach(edge => {
                    const n1 = nodeLookup.get(edge.from_id);
                    const n2 = nodeLookup.get(edge.to_id);
                    if (n1 && n2) createConnectionLine(n1, n2, content, gridScale);
                });
            }

            let targetNode = null;

            data.map_nodes.forEach(node => {
                const isCurrent = node.id === currentId;
                const nodeEl = createNodeElement(node, content, gridScale, isCurrent);
                if (isCurrent) targetNode = node;
            });

            if (targetNode) {
                centerMapOnNode(targetNode, gridScale);
            }

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
    nodeEl.className = `map-node ${node.visited ? '' : 'unvisited'}`;
    if (isCurrent) nodeEl.classList.add("current-node");

    nodeEl.style.left = `${node.coords.x * scale}px`;
    nodeEl.style.top = `${node.coords.y * scale}px`;

    const imgPath = node.visited ? `/game/assets/${node.image || 'background1.jpg'}` : 'assets/locked_node.png';

    nodeEl.innerHTML = `
        <div class="map-node-img-wrapper">
            <img src="${imgPath}" class="map-node-img">
            ${!node.visited ? '<div class="lock-icon">🔒</div>' : ''}
        </div>
        <div class="map-node-name">${node.visited ? node.name : '??'}</div>
    `;

    container.appendChild(nodeEl);
    return nodeEl;
}

function createConnectionLine(node1, node2, content, scale) {
    const x1 = node1.coords.x * scale;
    const y1 = node1.coords.y * scale;
    const x2 = node2.coords.x * scale;
    const y2 = node2.coords.y * scale;

    const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;

    const line = document.createElement("div");
    line.className = `map-connection ${(!node1.visited || !node2.visited) ? 'dimmed' : ''}`;
    line.style.width = `${length}px`;
    line.style.left = `${x1}px`;
    line.style.top = `${y1}px`;
    line.style.transform = `rotate(${angle}deg)`;

    content.appendChild(line);
}

function log(msg) {
    const logEl = document.getElementById("gameLog");
    const time = new Date().toLocaleTimeString('uk-UA', {hour: '2-digit', minute:'2-digit', second:'2-digit'});
    logEl.innerText += `[${time}] ${msg}\n`;
    logEl.scrollTop = logEl.scrollHeight;
}

function showConfirm() {
    document.getElementById("confirmOverlay").classList.add("show");
}

function closeConfirm() {
    document.getElementById("confirmOverlay").classList.remove("show");
}

function confirmReset() {
    closeConfirm();
    log("SYSTEM: Скидання стану до початкового...");
    updateState();
}

window.onload = updateState;