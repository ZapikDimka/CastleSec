import { useMemo } from 'react';
import FunctionList from './FunctionList';

function normalizeActionChoice(action) {
    return {
        label: typeof action?.label === 'string' ? action.label : '',
        once: Boolean(action?.once),
        functions: Array.isArray(action?.functions) ? action.functions : [],
    };
}

export default function ActionEditor({ action, onChange }) {
    const normalized = useMemo(() => normalizeActionChoice(action), [action]);

    const updateChoice = (patch) => {
        onChange({ ...normalized, ...patch });
    };

    return (
        <div className="action-editor">
            <div className="action-editor__field">
                <label className="action-editor__label">Action Label</label>
                <input
                    className="panel__input"
                    type="text"
                    value={normalized.label}
                    onChange={(e) => updateChoice({ label: e.target.value })}
                    placeholder="What player sees"
                    spellCheck={false}
                />
            </div>

            <div className="action-editor__field">
                <label className="action-editor__label action-editor__checkbox-label">
                    <input
                        type="checkbox"
                        checked={normalized.once}
                        onChange={(e) => updateChoice({ once: e.target.checked })}
                    />
                    <span>Once (hide after execution)</span>
                </label>
            </div>

            <div className="action-editor__field">
                <FunctionList
                    title="Functions"
                    functions={normalized.functions}
                    onChange={(functions) => updateChoice({ functions })}
                />
            </div>
        </div>
    );
}
