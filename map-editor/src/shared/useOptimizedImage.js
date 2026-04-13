import { useState, useEffect } from 'react';

// Global cache to avoid re-crunching the same image source at the same size
const optimizationCache = new Map();

/**
 * Custom React hook that takes an original image source URL and returns
 * a downscaled Blob URL to improve rendering performance.
 * 
 * @param {string} src - The original image source (local path, http url, or raw blob)
 * @param {number} maxWidth - Maximum allowed width
 * @param {number} maxHeight - Maximum allowed height
 * @returns {string|null} The optimized image src, or null if loading.
 */
export function useOptimizedImage(src, maxWidth = 128, maxHeight = 128) {
    const [optimizedSrc, setOptimizedSrc] = useState(null);

    useEffect(() => {
        if (!src) {
            setOptimizedSrc(null);
            return;
        }

        const cacheKey = `${src}_${maxWidth}x${maxHeight}`;

        // Return from memory cache if already generated
        if (optimizationCache.has(cacheKey)) {
            setOptimizedSrc(optimizationCache.get(cacheKey));
            return;
        }

        let isMounted = true;

        const img = new Image();
        img.crossOrigin = 'Anonymous'; // Help with external resources if any

        img.onload = () => {
            if (!isMounted) return;

            // If image is already smaller than max dimensions, just use the original src
            if (img.width <= maxWidth && img.height <= maxHeight) {
                optimizationCache.set(cacheKey, src);
                setOptimizedSrc(src);
                return;
            }

            // Calculate new dimensions maintaining aspect ratio
            const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
            const targetWidth = Math.round(img.width * ratio);
            const targetHeight = Math.round(img.height * ratio);

            // Draw to an offscreen canvas to scale down precisely
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');

            // Use better scaling quality if supported by the browser
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

            canvas.toBlob((blob) => {
                if (!isMounted) return;
                if (!blob) {
                    // Fallback to original if blob creation fails for some reason
                    optimizationCache.set(cacheKey, src);
                    setOptimizedSrc(src);
                    return;
                }

                const url = URL.createObjectURL(blob);
                optimizationCache.set(cacheKey, url);
                setOptimizedSrc(url);
            }, 'image/webp', 0.9); // Use WebP for better memory footprint where available
        };

        img.onerror = () => {
            // If the image fails to load (e.g. 404), fallback to passing the src through
            // so standard browser alt-text/broken-icons handle it gracefully
            if (isMounted) {
                optimizationCache.set(cacheKey, src);
                setOptimizedSrc(src);
            }
        };

        img.src = src;

        return () => {
            isMounted = false;
        };
    }, [src, maxWidth, maxHeight]);

    return optimizedSrc;
}
