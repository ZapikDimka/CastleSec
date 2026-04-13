import { useState } from 'react';

export default function UnknownEditor({ action, onChange }) {
    const [raw, setRaw] = useState(JSON.stringify(action, null, 2));
    const [error, setError] = useState(null);

    const handleBlur = () => {
        try {
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !parsed.type) {
                setError('Invalid: JSON must be an object with a "type" field.');
                return;
            }
            setError(null);
            onChange(parsed);
        } catch (e) {
            setError('Invalid JSON');
        }
    };

    return (
        <div className="action-editor__unknown">
            <div className="action-editor__unknown-label">
                ⚠️ Unknown action type: <code>{action.type}</code>
            </div>
            <textarea
                className="action-editor__unknown-textarea"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                onBlur={handleBlur}
                rows={6}
                spellCheck={false}
            />
            {error && <div className="action-editor__error">{error}</div>}
        </div>
    );
}
