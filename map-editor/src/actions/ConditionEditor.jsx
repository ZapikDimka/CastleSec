import { useState } from 'react';
import ItemPicker from '../shared/ItemPicker';

export default function ConditionEditor({ condition, onChange }) {
    if (!condition) {
        // Default to has_item
        return (
            <div className="condition-editor">
                <label className="action-editor__label">Condition Type</label>
                <select
                    className="panel__select"
                    value=""
                    onChange={(e) => onChange({ type: e.target.value })}
                >
                    <option value="">— select —</option>
                    <option value="has_item">has_item</option>
                </select>
            </div>
        );
    }

    const handleTypeChange = (e) => {
        onChange({ type: e.target.value });
    };

    return (
        <div className="condition-editor">
            <div className="action-editor__field">
                <label className="action-editor__label">Condition Type</label>
                <select
                    className="panel__select"
                    value={condition.type || ''}
                    onChange={handleTypeChange}
                >
                    <option value="">— select —</option>
                    <option value="has_item">has_item</option>
                </select>
            </div>

            {condition.type === 'has_item' && (
                <div className="action-editor__field">
                    <label className="action-editor__label">Item</label>
                    <ItemPicker
                        value={condition.item || ''}
                        onChange={(item) => onChange({ ...condition, item })}
                    />
                </div>
            )}

            {condition.type && condition.type !== 'has_item' && (
                <UnknownConditionEditor condition={condition} onChange={onChange} />
            )}
        </div>
    );
}

function UnknownConditionEditor({ condition, onChange }) {
    const [raw, setRaw] = useState(JSON.stringify(condition, null, 2));
    const [error, setError] = useState(null);

    const handleBlur = () => {
        try {
            const parsed = JSON.parse(raw);
            setError(null);
            onChange(parsed);
        } catch (e) {
            setError('Invalid JSON');
        }
    };

    return (
        <div className="action-editor__unknown">
            <div className="action-editor__unknown-label">
                ⚠️ Unknown condition: <code>{condition.type}</code>
            </div>
            <textarea
                className="action-editor__unknown-textarea"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                onBlur={handleBlur}
                rows={4}
                spellCheck={false}
            />
            {error && <div className="action-editor__error">{error}</div>}
        </div>
    );
}
