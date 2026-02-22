import { useRef, useState, useEffect } from 'react';

export default function ImagePicker({ value, onChange }) {
    const fileInputRef = useRef(null);
    const [localPreview, setLocalPreview] = useState(null);

    // Clear local preview if value is cleared externally
    useEffect(() => {
        if (!value) {
            if (localPreview) {
                URL.revokeObjectURL(localPreview);
            }
            setLocalPreview(null);
        }
    }, [value]);

    // Clean up object URLs on unmount
    useEffect(() => {
        return () => {
            if (localPreview) {
                URL.revokeObjectURL(localPreview);
            }
        };
    }, [localPreview]);


    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (localPreview) {
            URL.revokeObjectURL(localPreview);
        }

        const url = URL.createObjectURL(file);
        setLocalPreview(url);

        // Store just the filename for now; relative path logic added in File I/O step
        onChange(file.name);
        // Reset input so the same file can be re-selected
        e.target.value = '';
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange(null);
    };

    const previewSrc = localPreview || value;

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
                    <img src={previewSrc} alt="Thumbnail preview" className="image-picker__thumbnail" />
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
