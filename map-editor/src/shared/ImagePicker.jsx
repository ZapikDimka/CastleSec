import { useRef } from 'react';
import { getAssetUrl, cacheFileUrl } from './assetHelper';
import { useOptimizedImage } from './useOptimizedImage';

export default function ImagePicker({ value, onChange }) {
    const fileInputRef = useRef(null);


    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        cacheFileUrl(file.name, url);

        // Store just the filename for now; relative path logic added in File I/O step
        onChange(file.name);
        // Reset input so the same file can be re-selected
        e.target.value = '';
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange(null);
    };

    const absoluteImagePath = getAssetUrl(value);
    const optimizedImageSrc = useOptimizedImage(absoluteImagePath, 256, 256);

    const handleImageClick = (e) => {
        if (!absoluteImagePath) return;
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('openFullscreenImage', { detail: absoluteImagePath }));
    };

    return (
        <div className="image-picker">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="visually-hidden"
            />

            {value ? (
                <div className="image-picker__preview">
                    {optimizedImageSrc && (
                        <img
                            src={optimizedImageSrc}
                            alt="Thumbnail preview"
                            className="image-picker__thumbnail"
                            onClick={handleImageClick}
                        />
                    )}
                    <div className="image-picker__footer">
                        <div className="image-picker__filename" title={value}>
                            🖼 {value}
                        </div>
                        <button
                            className="image-picker__clear"
                            onClick={handleClear}
                            title="Remove image"
                        >
                            ×
                        </button>
                    </div>
                </div>
            ) : (
                <button className="image-picker__select" onClick={handleClick}>
                    📁 Select Image…
                </button>
            )}
        </div>
    );
}
