import { useRef } from 'react';
import { cacheFileUrl } from './assetHelper';

function stripTopFolder(relativePath) {
    if (!relativePath || typeof relativePath !== 'string') return '';
    const segments = relativePath.split('/').filter(Boolean);
    if (segments.length <= 1) return segments[0] || '';
    return segments.slice(1).join('/');
}

function inferBasePath(firstFile) {
    if (!firstFile || typeof firstFile.path !== 'string' || typeof firstFile.webkitRelativePath !== 'string') {
        return '';
    }

    const absolute = firstFile.path;
    const relative = firstFile.webkitRelativePath.replaceAll('\\', '/');
    const normalizedAbsolute = absolute.replaceAll('\\', '/');
    const marker = `/${relative}`;

    if (!normalizedAbsolute.endsWith(relative) && !normalizedAbsolute.endsWith(marker)) {
        return '';
    }

    const cutoff = normalizedAbsolute.lastIndexOf(relative);
    if (cutoff < 0) return '';

    const folderPath = normalizedAbsolute.slice(0, cutoff).replace(/\/$/, '');
    return folderPath;
}

export default function FolderPicker({ disabled = false, onPickHandle, onPickPath }) {
    const fileInputRef = useRef(null);

    const handleNativeFolderSelect = async () => {
        if (typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function') {
            try {
                const handle = await window.showDirectoryPicker();
                await onPickHandle?.(handle);
                return;
            } catch (err) {
                if (err?.name !== 'AbortError') {
                    console.error('Failed to select directory', err);
                }
                return;
            }
        }

        fileInputRef.current?.click();
    };

    const handleFileSelection = async (event) => {
        const files = Array.from(event.target.files || []);
        if (!files.length) return;

        for (const file of files) {
            const relative = stripTopFolder(file.webkitRelativePath || file.name);
            if (!relative) continue;

            const url = URL.createObjectURL(file);
            cacheFileUrl(relative, url);
            if (!relative.includes('/')) {
                cacheFileUrl(file.name, url);
            }
        }

        const inferredBasePath = inferBasePath(files[0]);
        if (inferredBasePath) {
            await onPickPath?.(inferredBasePath);
        }

        event.target.value = '';
    };

    return (
        <div className="image-picker">
            <input
                ref={fileInputRef}
                type="file"
                // `webkitdirectory` enables folder selection in Chromium-based browsers.
                // eslint-disable-next-line react/no-unknown-property
                webkitdirectory=""
                directory=""
                multiple
                className="visually-hidden"
                onChange={handleFileSelection}
            />
            <button className="image-picker__select" onClick={handleNativeFolderSelect} disabled={disabled}>
                Select Folder…
            </button>
        </div>
    );
}
