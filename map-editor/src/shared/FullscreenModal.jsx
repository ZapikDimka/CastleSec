import { useEffect } from 'react';

export default function FullscreenModal({ imageUrl, onClose }) {
    // Close on escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    if (!imageUrl) return null;

    return (
        <div className="fullscreen-overlay" onClick={onClose}>
            <button className="fullscreen-close" onClick={onClose} title="Close (Escape)">
                &times;
            </button>
            <img
                src={imageUrl}
                className="fullscreen-image"
                alt="Fullscreen Preview"
                onClick={(e) => e.stopPropagation()} // Prevent click propagating to overlay close
            />
        </div>
    );
}
