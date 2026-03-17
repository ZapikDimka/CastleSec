import { serialize } from './serialize';
import { deserialize } from './deserialize';
import { validate } from '../validation/validate';

// Store live file handles outside of React state since they aren't serializable
let currentGameHandle = null;

/**
 * Common picker options for game JSON
 */
const pickerOptions = {
    types: [
        {
            description: 'Map JSON',
            accept: { 'application/json': ['.json'] },
        },
    ],
    excludeAcceptAllOption: true,
};

function canOpenWithFSA() {
    return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
}

function canSaveWithFSA() {
    return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

/**
 * Check if the browser supports any File System Access API picker.
 */
export const supportsFSA =
    (typeof window !== 'undefined') &&
    (typeof window.showOpenFilePicker === 'function' || typeof window.showSaveFilePicker === 'function');

/**
 * Opens a map file.
 * Coordinates are expected in the main JSON under `nodePositions`.
 * A legacy sidecar payload can still be passed into `deserialize` by other callers.
 * @returns {Promise<{ state: Object, filename: string }>}
 */
export async function openMapFile() {
    if (!canOpenWithFSA()) {
        return openMapFallback();
    }

    try {
        const [handle] = await window.showOpenFilePicker(pickerOptions);
        currentGameHandle = handle;

        const file = await handle.getFile();
        const gameJsonStr = await file.text();
        const state = deserialize(gameJsonStr, null);
        return { state, filename: file.name };
    } catch (err) {
        // User aborted or error
        if (err.name !== 'AbortError') {
            console.error('Failed to open file:', err);
            throw err;
        }
        return null;
    }
}

/**
 * Saves current state to current file handle. If none, prompts Save As.
 */
export async function saveMapFile(state, currentFilename) {
    const issues = validate(state);
    for (const entityIssues of issues.values()) {
        if (entityIssues.some(i => i.severity === 'error')) {
            throw new Error('Cannot save map with validation errors.');
        }
    }

    if (!canSaveWithFSA()) {
        return saveMapFallback(state, currentFilename || 'map.json');
    }

    if (!currentGameHandle) {
        return saveAsMapFile(state);
    }

    try {
        const { gameJson } = serialize(state);

        // Write game JSON
        const writable = await currentGameHandle.createWritable();
        await writable.write(gameJson);
        await writable.close();

        return { filename: currentGameHandle.name };
    } catch (err) {
        console.error('Failed to save file:', err);
        throw err;
    }
}

/**
 * Prompts user for location, then saves
 */
export async function saveAsMapFile(state) {
    const issues = validate(state);
    for (const entityIssues of issues.values()) {
        if (entityIssues.some(i => i.severity === 'error')) {
            throw new Error('Cannot save map with validation errors.');
        }
    }

    if (!canSaveWithFSA()) {
        return saveMapFallback(state, 'map.json');
    }

    try {
        const handle = await window.showSaveFilePicker(pickerOptions);
        currentGameHandle = handle;

        const { gameJson } = serialize(state);

        const writable = await handle.createWritable();
        await writable.write(gameJson);
        await writable.close();

        return { filename: handle.name };
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Failed to save-as file:', err);
            throw err;
        }
        return null;
    }
}

/**
 * Clear the current handle (used when creating a New Map)
 */
export function clearCurrentFileHandle() {
    currentGameHandle = null;
}

// ============================================
// Fallbacks for Firefox/Safari
// ============================================

function openMapFallback() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return resolve(null);

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const state = deserialize(e.target.result, null);
                    resolve({ state, filename: file.name });
                } catch (err) {
                    console.error('Fallback parse failed', err);
                    resolve(null);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    });
}

function saveMapFallback(state, filename) {
    const { gameJson } = serialize(state);
    const blob = new Blob([gameJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);

    return Promise.resolve({ filename });
}
