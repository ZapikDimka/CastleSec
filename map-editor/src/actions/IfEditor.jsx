import ConditionEditor from './ConditionEditor';
import ActionEditor from './ActionEditor';

const ACTION_TYPES = [
    { type: 'move', label: 'Move' },
    { type: 'return', label: 'Return' },
    { type: 'pickup', label: 'Pickup' },
    { type: 'solve_task', label: 'Solve Task' },
    { type: 'if', label: 'If' },
];

const TYPE_DEFAULTS = {
    return: { type: 'return' },
    move: { type: 'move', to: '' },
    pickup: { type: 'pickup', item: '' },
    solve_task: { type: 'solve_task', name: '' },
    if: { type: 'if', condition: { type: 'has_item', item: '' }, action: { type: 'return' } },
};

export default function IfEditor({ action, nodeId, index, onChange }) {
    const handleConditionChange = (newCondition) => {
        onChange({ ...action, condition: newCondition });
    };

    const handleNestedActionChange = (newNestedAction) => {
        onChange({ ...action, action: newNestedAction });
    };

    const handleTypeChange = (e) => {
        onChange({ ...action, action: { ...TYPE_DEFAULTS[e.target.value] } });
    };

    const nestedAction = action.action || { type: 'return' };

    return (
        <div className="if-editor">
            <div className="if-editor__section">
                <div className="if-editor__heading">Condition</div>
                <ConditionEditor
                    condition={action.condition}
                    onChange={handleConditionChange}
                />
            </div>

            <div className="if-editor__section">
                <div className="if-editor__heading">Then</div>
                <div className="if-editor__nested">
                    <div className="action-editor__field">
                        <label className="action-editor__label">Action Type</label>
                        <select
                            className="panel__select"
                            value={nestedAction.type || ''}
                            onChange={handleTypeChange}
                        >
                            {ACTION_TYPES.map(({ type, label }) => (
                                <option key={type} value={type}>{label}</option>
                            ))}
                        </select>
                    </div>
                    <ActionEditor
                        action={nestedAction}
                        nodeId={nodeId}
                        index={index}
                        onChange={handleNestedActionChange}
                    />
                </div>
            </div>
        </div>
    );
}
