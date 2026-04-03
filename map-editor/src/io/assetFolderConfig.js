const STORAGE_KEY = 'map-editor.asset-folder-by-map.v1';
const DB_NAME = 'map-editor-fs-handles';
const STORE_NAME = 'asset-folder-handles';

function readStorageMap() {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeStorageMap(map) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
        // ignore
    }
}

function supportsIndexedDb() {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDb() {
    if (!supportsIndexedDb()) return Promise.resolve(null);

    return new Promise((resolve, reject) => {
        const request = window.indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function putHandle(mapKey, handle) {
    const db = await openDb();
    if (!db) return;

    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore(STORE_NAME).put(handle, mapKey);
    });

    db.close();
}

async function getHandle(mapKey) {
    const db = await openDb();
    if (!db) return null;

    const handle = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(mapKey);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });

    db.close();
    return handle;
}

async function deleteHandle(mapKey) {
    const db = await openDb();
    if (!db) return;

    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore(STORE_NAME).delete(mapKey);
    });

    db.close();
}

export async function loadMapAssetFolderConfig(mapKey) {
    if (!mapKey) return null;
    const byMap = readStorageMap();
    const entry = byMap[mapKey];
    if (!entry || typeof entry !== 'object') return null;

    if (entry.mode === 'path') {
        return {
            mode: 'path',
            path: typeof entry.path === 'string' ? entry.path : '',
            label: typeof entry.label === 'string' ? entry.label : '',
        };
    }

    if (entry.mode === 'handle') {
        try {
            const handle = await getHandle(mapKey);
            return {
                mode: 'handle',
                handle,
                label: typeof entry.label === 'string' ? entry.label : '',
            };
        } catch {
            return null;
        }
    }

    return null;
}

export async function saveMapAssetFolderPath(mapKey, path) {
    if (!mapKey) return;
    const byMap = readStorageMap();
    byMap[mapKey] = {
        mode: 'path',
        path,
        label: path,
    };
    writeStorageMap(byMap);
    await deleteHandle(mapKey);
}

export async function saveMapAssetFolderHandle(mapKey, handle) {
    if (!mapKey || !handle) return;
    const byMap = readStorageMap();
    byMap[mapKey] = {
        mode: 'handle',
        label: handle.name || 'Selected folder',
    };
    writeStorageMap(byMap);
    await putHandle(mapKey, handle);
}

export async function clearMapAssetFolderConfig(mapKey) {
    if (!mapKey) return;
    const byMap = readStorageMap();
    if (mapKey in byMap) {
        delete byMap[mapKey];
        writeStorageMap(byMap);
    }
    await deleteHandle(mapKey);
}
