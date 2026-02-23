# CastleSec Map Editor

This is the visual node-based map editor for the **CastleSec** game engine. It allows you to create and edit game maps, define nodes and items, and set up interactions and routing paths visually.

## Requirements

- [Node.js](https://nodejs.org/) (v16 or newer recommended)
- [npm](https://www.npmjs.com/) (installed automatically with Node)

## How to Launch

1. Open a terminal and navigate to the map editor directory:
   ```bash
   cd CastleSec/map-editor
   ```

2. Install dependencies (only required the first time):
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open the displayed local URL (usually `http://localhost:5173`) in your web browser.

## Managing Map Files

- The editor saves mapping data in `.json` format.
- **Where to save maps**: It is highly recommended to save your maps inside the `CastleSec/game/maps/` directory so they are alongside your game engine files.
- The editor supports opening existing `.json` map files, auto-saving your current file (`Ctrl/Cmd + S`), or saving as a new file (`Ctrl/Cmd + Shift + S`).

## Managing Image Assets

In order for your images (backgrounds, item icons, etc.) to be visible both in the **Map Editor** and in the **Python Game Engine**, follow these rules:

1. **Where to place images**: Always place your image files locally inside the `CastleSec/game/assets/` directory (or a subdirectory like `icons/` or `backgrounds/`).
2. **Assigning images in the Editor**: When you use the Map Editor's "Select Image" picker, you can pick the image from your `game/assets/` folder.
3. **How it works**: The Map Editor is configured to mount the `game/assets/` directory and will automatically show previews. The resulting saved `.json` file will simply store the image's relative filename (e.g. `key.png` or `backgrounds/room.png`), allowing the Python engine to load it natively without broken paths!

## Keyboard Shortcuts

- `Ctrl/Cmd + S`: Save map
- `Ctrl/Cmd + Shift + S`: Save map as...
- `Ctrl/Cmd + O`: Open map
- `Ctrl/Cmd + Z`: Undo
- `Ctrl/Cmd + Shift + Z`: Redo
- `Delete` / `Backspace`: Delete selected node or item
- `Escape`: Deselect current node or item
