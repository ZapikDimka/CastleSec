# CastleSec

A browser-based security CTF game where players explore a castle and solve hacking challenges.

## Requirements

- [Docker](https://docs.docker.com/get-docker/) with the Compose plugin
- Docker socket access (the backend spawns task containers at runtime)

## Quick start

```bash
docker compose up --build
```

Then open **http://localhost** in your browser.

The backend API is available at **http://localhost:8000**.

## Local development (without Docker)

**Requirements:** Python 3.12+, [uv](https://docs.astral.sh/uv/getting-started/installation/), Docker (still needed to run task containers)

**1. Install dependencies**

```bash
cd backend
uv sync
```

**2. Start the backend**

```bash
cd backend
uv run fastapi dev main.py
```

The API will be available at **http://127.0.0.1:8000**.

**3. Open the frontend**

Open `web/index.html` directly in your browser. The frontend already points to `http://127.0.0.1:8000` so no extra setup is needed.

---

## Warming up task images (optional)

Pre-builds all task Docker images so challenges launch instantly during gameplay:

```bash
./warmup.sh
```

Run this once after cloning or after modifying any task. Without it, the first time each task is started it will build on demand (takes longer).

## Map editor

The map editor is a visual node-based tool for creating and editing game maps, defining rooms and items, and wiring up interactions and routing.

**Requirements:** [Node.js](https://nodejs.org/) v16+

**1. Install dependencies** (first time only)

```bash
cd map-editor
npm install
```

**2. Start the editor**

```bash
cd map-editor
npm run dev
```

Then open **http://localhost:5173** in your browser.

**Saving maps:** Save map files into `map-editor/maps/` so the backend can find them. \
**Images:** Place image assets in `map-editor/images/`. The editor reads from that directory and stores only the filename in the map JSON, so the backend resolves them correctly. \
**Keyboard shortcuts:**

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd+S` | Save |
| `Ctrl/Cmd+Shift+S` | Save as |
| `Ctrl/Cmd+O` | Open |
| `Ctrl/Cmd+Z` | Undo |
| `Ctrl/Cmd+Shift+Z` | Redo |
| `Delete` / `Backspace` | Delete selected node or item |
| `Escape` | Deselect |

---

## Project structure

```
docker-compose.yml   # Main compose file (web + backend)
warmup.sh            # Pre-builds all task images
backend/             # FastAPI backend (Python)
web/                 # Nginx frontend (HTML/JS)
game/                # Game engine (Python package)
tasks/               # CTF challenge containers (task1-task13)
map-editor/          # Map data and assets
```

## How it works

1. The **frontend** (`web`) serves the game UI and talks to the backend API.
2. The **backend** runs the game engine and, when a player enters a challenge room, spins up the corresponding task container via Docker Compose.
3. Each **task** is an isolated Docker container exposing a web challenge on port 8080. The backend proxies the player to it and tears the container down when the task is closed or completed.
