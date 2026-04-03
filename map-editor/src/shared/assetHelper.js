const blobCache = new Map();
const folderCacheKeys = new Set();

const DEFAULT_ASSET_BASE_DIR =
    import.meta.env.VITE_MAP_EDITOR_ASSET_DIR ||
    '/Users/qenze/Work/Projects/CastleSec/game/assets';

let configuredAssetBaseDir = null;

export function cacheFileUrl(filename, url) {
    if (blobCache.has(filename)) {
        URL.revokeObjectURL(blobCache.get(filename));
    }
    blobCache.set(filename, url);
}

function cacheFolderFileUrl(filename, url) {
    folderCacheKeys.add(filename);
    cacheFileUrl(filename, url);
}

export function clearFolderFileCache() {
    for (const key of folderCacheKeys) {
        if (blobCache.has(key)) {
            URL.revokeObjectURL(blobCache.get(key));
            blobCache.delete(key);
        }
    }
    folderCacheKeys.clear();
}

export function setConfiguredAssetBaseDir(baseDir) {
    configuredAssetBaseDir = typeof baseDir === 'string' && baseDir.trim() ? baseDir.trim() : null;
}

export function getDefaultAssetBaseDir() {
    return DEFAULT_ASSET_BASE_DIR;
}

function joinPath(base, relative) {
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const cleanRelative = relative.startsWith('/') ? relative.slice(1) : relative;
    return `${cleanBase}/${cleanRelative}`;
}

async function cacheDirectoryEntryRecursive(directoryHandle, prefix = '') {
    // eslint-disable-next-line no-restricted-syntax
    for await (const entry of directoryHandle.values()) {
        if (entry.kind === 'directory') {
            await cacheDirectoryEntryRecursive(entry, `${prefix}${entry.name}/`);
            continue;
        }
        if (entry.kind !== 'file') continue;

        const file = await entry.getFile();
        const fileUrl = URL.createObjectURL(file);
        const relativeKey = `${prefix}${entry.name}`;

        cacheFolderFileUrl(relativeKey, fileUrl);
        // Also index by basename so maps that store only "file.png" can resolve
        // assets located in nested subfolders of the selected asset directory.
        cacheFolderFileUrl(entry.name, fileUrl);
    }
}

export async function hydrateAssetFolderFromDirectoryHandle(directoryHandle) {
    clearFolderFileCache();
    if (!directoryHandle) return;
    await cacheDirectoryEntryRecursive(directoryHandle);
}

/**
 * Converts a stored JSON image path to a local dev server path.
 * 
 * Example:
 * If the Map JSON file stores: `backgrounds/room.png`
 * The Vite Dev Server will fetch it from: `/@fs/Users/qenze/Work/Projects/CastleSec/game/assets/backgrounds/room.png`
 * 
 * Note: In production builds this logic would normally map to the hosted static asset folder.
 */
export function getAssetUrl(imagePath) {
    if (!imagePath) return null;

    if (blobCache.has(imagePath)) {
        return blobCache.get(imagePath);
    }

    // If it's already an absolute URL or blob, return it unmodified
    if (imagePath.startsWith('http') || imagePath.startsWith('blob:') || imagePath.startsWith('data:')) {
        return imagePath;
    }

    const baseDir = configuredAssetBaseDir || DEFAULT_ASSET_BASE_DIR;
    return `/@fs/${joinPath(baseDir, imagePath)}`;
}
