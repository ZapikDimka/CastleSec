const blobCache = new Map();

export function cacheFileUrl(filename, url) {
    if (blobCache.has(filename)) {
        URL.revokeObjectURL(blobCache.get(filename));
    }
    blobCache.set(filename, url);
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

    // In Vite dev mode, we can use the special /@fs/ prefix to serve files from allowed parent directories.
    // Ensure this path matches the absolute path to your CastleSec/game/assets folder.
    return `/@fs/Users/qenze/Work/Projects/CastleSec/game/assets/${imagePath}`;
}
