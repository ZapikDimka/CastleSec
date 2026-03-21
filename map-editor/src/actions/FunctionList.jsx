import { useMemo, useState, useEffect } from 'react';
import NodePicker from '../shared/NodePicker';
import ItemPicker from '../shared/ItemPicker';
import { useMapState } from '../state/MapContext';

const FUNCTION_TYPE_OPTIONS = [
    { type: 'MoveFunction', label: 'Move' },
    { type: 'PickUpItemFunction', label: 'Pick Up Item' },
    { type: 'SolveTaskFunction', label: 'Solve Task' },
    { type: 'IfFunction', label: 'If' },
    { type: 'ShowHintTextFunction', label: 'Show Hint' },
    { type: 'InspectFunction', label: 'Inspect' },
    { type: 'SetVariableFunction', label: 'Set Variable' },
];
const VARIABLE_PRESETS = ['text', 'name', 'image'];
const KNOWN_FUNCTION_TYPES = new Set([
    'MoveFunction',
    'PickUpItemFunction',
    'SolveTaskFunction',
    'IfFunction',
    'ShowHintTextFunction',
    'InspectFunction',
    'SetVariableFunction',
]);

function createDefaultFunction(type) {
    switch (type) {
        case 'MoveFunction':
            return { type: 'MoveFunction', to: '' };
        case 'PickUpItemFunction':
            return { type: 'PickUpItemFunction', item: '' };
        case 'SolveTaskFunction':
            return { type: 'SolveTaskFunction', task: '', on_success: [], on_failure: [] };
        case 'IfFunction':
            return {
                type: 'IfFunction',
                condition: { type: 'has_item', item: '' },
                then_functions: [],
                else_functions: [],
            };
        case 'ShowHintTextFunction':
            return { type: 'ShowHintTextFunction', text: '', once: false };
        case 'InspectFunction':
            return { type: 'InspectFunction', title: '', content: '', once: false };
        case 'SetVariableFunction':
            return { type: 'SetVariableFunction', target_node: null, variable: 'text', value: '' };
        default:
            return { type };
    }
}

function normalizeCondition(condition) {
    const raw = condition && typeof condition === 'object' && !Array.isArray(condition)
        ? condition
        : { type: 'has_item', item: '' };

    const type = typeof raw.type === 'string' ? raw.type : 'has_item';
    const next = { ...raw, type };
    if (['has_item', 'item_used', 'item_not_collected'].includes(type)) {
        next.item = typeof raw.item === 'string' ? raw.item : '';
    }
    return next;
}

function normalizeFunction(fn) {
    if (!fn || typeof fn !== 'object' || Array.isArray(fn)) return { type: 'UnknownFunction' };
    if (fn.type === 'SolveTaskFunction') {
        return {
            ...fn,
            task: typeof fn.task === 'string' ? fn.task : '',
            on_success: Array.isArray(fn.on_success) ? fn.on_success : [],
            on_failure: Array.isArray(fn.on_failure) ? fn.on_failure : [],
        };
    }
    if (fn.type === 'IfFunction') {
        return {
            ...fn,
            condition: normalizeCondition(fn.condition),
            then_functions: Array.isArray(fn.then_functions) ? fn.then_functions : [],
            else_functions: Array.isArray(fn.else_functions) ? fn.else_functions : [],
        };
    }
    if (fn.type === 'ShowHintTextFunction') {
        return {
            ...fn,
            text: typeof fn.text === 'string' ? fn.text : '',
            once: Boolean(fn.once),
        };
    }
    if (fn.type === 'InspectFunction') {
        return {
            ...fn,
            title: typeof fn.title === 'string' ? fn.title : '',
            content: typeof fn.content === 'string' ? fn.content : '',
            once: Boolean(fn.once),
        };
    }
    if (fn.type === 'SetVariableFunction') {
        return {
            ...fn,
            target_node: typeof fn.target_node === 'string' && fn.target_node.trim() ? fn.target_node : null,
            variable: typeof fn.variable === 'string' ? fn.variable : 'text',
            value: typeof fn.value === 'string' ? fn.value : '',
        };
    }
    return fn;
}

function validateFunction(fn, refs = {}) {
    const { nodes = {}, items = {} } = refs;
    if (!fn || typeof fn !== 'object') return null;
    if (fn.type === 'MoveFunction') {
        if (!fn.to?.trim()) return 'Target node is required.';
        if (!nodes[fn.to]) return `Target node "${fn.to}" does not exist.`;
    }
    if (fn.type === 'PickUpItemFunction') {
        if (!fn.item?.trim()) return 'Item is required.';
        if (!items[fn.item]) return `Item "${fn.item}" does not exist.`;
    }
    if (fn.type === 'IfFunction') {
        const type = fn.condition?.type;
        const known = ['has_item', 'item_used', 'item_not_collected'];
        if (!known.includes(type)) return 'Condition type is required.';
        if (!fn.condition?.item?.trim()) return 'Condition item is required.';
        if (!items[fn.condition.item]) return `Condition item "${fn.condition.item}" does not exist.`;
        if (!Array.isArray(fn.then_functions)) return 'then_functions must be an array.';
        if (!Array.isArray(fn.else_functions)) return 'else_functions must be an array.';
    }
    if (fn.type === 'SolveTaskFunction') {
        if (!fn.task?.trim()) return 'Task is required.';
        if (!Array.isArray(fn.on_success)) return 'on_success must be an array.';
        if (!Array.isArray(fn.on_failure)) return 'on_failure must be an array.';
    }
    if (fn.type === 'ShowHintTextFunction' && !fn.text?.trim()) {
        return 'Hint text is required.';
    }
    if (fn.type === 'InspectFunction') {
        if (!fn.title?.trim()) return 'Inspect title is required.';
        if (!fn.content?.trim()) return 'Inspect content is required.';
    }
    if (fn.type === 'SetVariableFunction') {
        if (!fn.variable?.trim()) return 'Variable is required.';
        if (!fn.value?.trim()) return 'Value is required.';
    }
    return null;
}

function getFunctionSummary(fn) {
    switch (fn?.type) {
        case 'MoveFunction':
            return `Move to ${fn.to || '(missing node)'}`;
        case 'PickUpItemFunction':
            return `Pick up ${fn.item || '(missing item)'}`;
        case 'SolveTaskFunction': {
            const task = fn.task?.trim() || '(missing task)';
            const successCount = Array.isArray(fn.on_success) ? fn.on_success.length : 0;
            const failureCount = Array.isArray(fn.on_failure) ? fn.on_failure.length : 0;
            return `Solve "${task}" · success:${successCount} · failure:${failureCount}`;
        }
        case 'IfFunction': {
            const type = fn.condition?.type || 'condition';
            const item = fn.condition?.item ? `(${fn.condition.item})` : '';
            const thenCount = Array.isArray(fn.then_functions) ? fn.then_functions.length : 0;
            const elseCount = Array.isArray(fn.else_functions) ? fn.else_functions.length : 0;
            return `If ${type}${item} · then:${thenCount} · else:${elseCount}`;
        }
        case 'ShowHintTextFunction': {
            const text = fn.text?.trim();
            return text ? `Hint: ${text.slice(0, 40)}` : 'Hint: (missing text)';
        }
        case 'InspectFunction': {
            const title = fn.title?.trim() || '(missing title)';
            const contentStatus = fn.content?.trim() ? 'content' : 'missing content';
            return `Inspect "${title}" · ${contentStatus}`;
        }
        case 'SetVariableFunction': {
            const target = fn.target_node || 'current';
            const variable = fn.variable?.trim() || '(missing variable)';
            const valuePreview = fn.value?.trim() ? fn.value.trim().slice(0, 28) : '(missing value)';
            return `Set ${target}.${variable} = ${valuePreview}`;
        }
        default:
            return fn?.type ? `Unknown: ${fn.type}` : 'Unknown function';
    }
}

function FunctionUnknownEditor({ fn, onChange }) {
    const [raw, setRaw] = useState(JSON.stringify(fn, null, 2));
    const [error, setError] = useState(null);

    useEffect(() => {
        setRaw(JSON.stringify(fn, null, 2));
        setError(null);
    }, [fn]);

    const handleBlur = () => {
        try {
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !parsed.type) {
                setError('Function must be an object with a "type" field.');
                return;
            }
            setError(null);
            onChange(parsed);
        } catch {
            setError('Invalid JSON.');
        }
    };

    const handleRevert = () => {
        setRaw(JSON.stringify(fn, null, 2));
        setError(null);
    };

    return (
        <div className="action-editor__unknown">
            <div className="action-editor__unknown-label">
                Unknown function type: <code>{fn?.type || 'UnknownFunction'}</code>
            </div>
            <textarea
                className="action-editor__unknown-textarea"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                onBlur={handleBlur}
                rows={5}
                spellCheck={false}
            />
            {error && <div className="action-editor__error">{error}</div>}
            <div className="action-editor__unknown-actions">
                <button
                    type="button"
                    className="function-row__btn"
                    onClick={handleRevert}
                >
                    Revert
                </button>
            </div>
        </div>
    );
}

function MoveFunctionEditor({ fn, onChange, excludeNodeId }) {
    return (
        <div className="action-editor__field">
            <label className="action-editor__label">Target Node</label>
            <NodePicker
                value={fn?.to || ''}
                onChange={(to) => onChange({ ...fn, type: 'MoveFunction', to })}
                excludeId={excludeNodeId}
            />
        </div>
    );
}

function PickUpItemFunctionEditor({ fn, onChange }) {
    return (
        <div className="action-editor__field">
            <label className="action-editor__label">Item</label>
            <ItemPicker
                value={fn?.item || ''}
                onChange={(item) => onChange({ ...fn, type: 'PickUpItemFunction', item })}
            />
        </div>
    );
}

function SolveTaskFunctionEditor({ fn, onChange, excludeNodeId }) {
    const normalized = normalizeFunction(fn);

    return (
        <div className="solve-task-editor">
            <div className="action-editor__field">
                <label className="action-editor__label">Task</label>
                <input
                    className="panel__input"
                    type="text"
                    value={normalized.task}
                    onChange={(e) => onChange({ ...normalized, type: 'SolveTaskFunction', task: e.target.value })}
                    placeholder="Task id or name"
                    spellCheck={false}
                />
            </div>

            <FunctionList
                title="On Success"
                emptyLabel="No success functions"
                functions={normalized.on_success}
                onChange={(on_success) => onChange({ ...normalized, type: 'SolveTaskFunction', on_success })}
                excludeNodeId={excludeNodeId}
            />

            <FunctionList
                title="On Failure"
                emptyLabel="No failure functions"
                functions={normalized.on_failure}
                onChange={(on_failure) => onChange({ ...normalized, type: 'SolveTaskFunction', on_failure })}
                excludeNodeId={excludeNodeId}
            />
        </div>
    );
}

function IfConditionEditor({ condition, onChange }) {
    const normalized = normalizeCondition(condition);
    const showItem = ['has_item', 'item_used', 'item_not_collected'].includes(normalized.type);

    return (
        <div className="condition-editor">
            <div className="action-editor__field">
                <label className="action-editor__label">Condition Type</label>
                <select
                    className="panel__select"
                    value={normalized.type}
                    onChange={(e) => onChange(normalizeCondition({ ...normalized, type: e.target.value }))}
                >
                    <option value="has_item">has_item</option>
                    <option value="item_used">item_used</option>
                    <option value="item_not_collected">item_not_collected</option>
                </select>
            </div>

            {showItem && (
                <div className="action-editor__field">
                    <label className="action-editor__label">Item</label>
                    <ItemPicker
                        value={normalized.item || ''}
                        onChange={(item) => onChange({ ...normalized, item })}
                    />
                </div>
            )}
        </div>
    );
}

function IfFunctionEditor({ fn, onChange, excludeNodeId }) {
    const normalized = normalizeFunction(fn);
    return (
        <div className="if-editor">
            <div className="if-editor__section">
                <div className="if-editor__heading">Condition</div>
                <IfConditionEditor
                    condition={normalized.condition}
                    onChange={(condition) => onChange({ ...normalized, type: 'IfFunction', condition })}
                />
            </div>

            <div className="if-editor__section">
                <div className="if-editor__heading">Then</div>
                <div className="if-editor__nested">
                    <FunctionList
                        title="Then Functions"
                        emptyLabel="No then functions"
                        functions={normalized.then_functions}
                        onChange={(then_functions) => onChange({ ...normalized, type: 'IfFunction', then_functions })}
                        excludeNodeId={excludeNodeId}
                    />
                </div>
            </div>

            <div className="if-editor__section">
                <div className="if-editor__heading">Else</div>
                <div className="if-editor__nested">
                    <FunctionList
                        title="Else Functions"
                        emptyLabel="No else functions"
                        functions={normalized.else_functions}
                        onChange={(else_functions) => onChange({ ...normalized, type: 'IfFunction', else_functions })}
                        excludeNodeId={excludeNodeId}
                    />
                </div>
            </div>
        </div>
    );
}

function ShowHintTextFunctionEditor({ fn, onChange }) {
    const normalized = normalizeFunction(fn);
    return (
        <div className="solve-task-editor">
            <div className="action-editor__field">
                <label className="action-editor__label">Hint Text</label>
                <textarea
                    className="panel__textarea"
                    value={normalized.text}
                    onChange={(e) => onChange({ ...normalized, type: 'ShowHintTextFunction', text: e.target.value })}
                    rows={3}
                    placeholder="Hint shown to player"
                    spellCheck={false}
                />
                {!normalized.text.trim() && (
                    <div className="action-editor__error">Hint text is required.</div>
                )}
            </div>
            <label className="action-editor__label action-editor__checkbox-label">
                <input
                    type="checkbox"
                    checked={normalized.once}
                    onChange={(e) => onChange({ ...normalized, type: 'ShowHintTextFunction', once: e.target.checked })}
                />
                <span>Once (show only first time)</span>
            </label>
        </div>
    );
}

function InspectFunctionEditor({ fn, onChange }) {
    const normalized = normalizeFunction(fn);
    return (
        <div className="solve-task-editor">
            <div className="action-editor__field">
                <label className="action-editor__label">Title</label>
                <input
                    className="panel__input"
                    type="text"
                    value={normalized.title}
                    onChange={(e) => onChange({ ...normalized, type: 'InspectFunction', title: e.target.value })}
                    placeholder="Inspect popup title"
                    spellCheck={false}
                />
                {!normalized.title.trim() && (
                    <div className="action-editor__error">Inspect title is required.</div>
                )}
            </div>
            <div className="action-editor__field">
                <label className="action-editor__label">Content</label>
                <textarea
                    className="panel__textarea"
                    value={normalized.content}
                    onChange={(e) => onChange({ ...normalized, type: 'InspectFunction', content: e.target.value })}
                    rows={5}
                    placeholder="Details shown in inspect view"
                    spellCheck={false}
                />
                {!normalized.content.trim() && (
                    <div className="action-editor__error">Inspect content is required.</div>
                )}
            </div>
            <label className="action-editor__label action-editor__checkbox-label">
                <input
                    type="checkbox"
                    checked={normalized.once}
                    onChange={(e) => onChange({ ...normalized, type: 'InspectFunction', once: e.target.checked })}
                />
                <span>Once (inspect only first time)</span>
            </label>
        </div>
    );
}

function SetVariableFunctionEditor({ fn, onChange }) {
    const { nodes = {} } = useMapState();
    const normalized = normalizeFunction(fn);
    const isPreset = VARIABLE_PRESETS.includes(normalized.variable);

    return (
        <div className="solve-task-editor">
            <div className="action-editor__field">
                <label className="action-editor__label">Target Node</label>
                <select
                    className="panel__select"
                    value={normalized.target_node || '__current__'}
                    onChange={(e) => onChange({
                        ...normalized,
                        type: 'SetVariableFunction',
                        target_node: e.target.value === '__current__' ? null : e.target.value,
                    })}
                >
                    <option value="__current__">Current node</option>
                    {Object.keys(nodes).map((nodeId) => (
                        <option key={nodeId} value={nodeId}>
                            {nodeId} — {nodes[nodeId].name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="action-editor__field">
                <label className="action-editor__label">Variable</label>
                <select
                    className="panel__select"
                    value={isPreset ? normalized.variable : '__custom__'}
                    onChange={(e) => {
                        const next = e.target.value;
                        onChange({
                            ...normalized,
                            type: 'SetVariableFunction',
                            variable: next === '__custom__'
                                ? (isPreset ? '' : normalized.variable)
                                : next,
                        });
                    }}
                >
                    <option value="text">text</option>
                    <option value="name">name</option>
                    <option value="image">image</option>
                    <option value="__custom__">Custom…</option>
                </select>
            </div>

            {!isPreset && (
                <div className="action-editor__field">
                    <label className="action-editor__label">Custom Variable</label>
                    <input
                        className="panel__input"
                        type="text"
                        value={normalized.variable}
                        onChange={(e) => onChange({ ...normalized, type: 'SetVariableFunction', variable: e.target.value })}
                        placeholder="e.g. subtitle"
                        spellCheck={false}
                    />
                    {!normalized.variable.trim() && (
                        <div className="action-editor__error">Variable is required.</div>
                    )}
                </div>
            )}

            <div className="action-editor__field">
                <label className="action-editor__label">Value</label>
                <textarea
                    className="panel__textarea"
                    value={normalized.value}
                    onChange={(e) => onChange({ ...normalized, type: 'SetVariableFunction', value: e.target.value })}
                    rows={4}
                    placeholder="Replacement value"
                    spellCheck={false}
                />
                {!normalized.value.trim() && (
                    <div className="action-editor__error">Value is required.</div>
                )}
            </div>
        </div>
    );
}

function FunctionEditor({ fn, onChange, excludeNodeId }) {
    switch (fn?.type) {
        case 'MoveFunction':
            return <MoveFunctionEditor fn={fn} onChange={onChange} excludeNodeId={excludeNodeId} />;
        case 'PickUpItemFunction':
            return <PickUpItemFunctionEditor fn={fn} onChange={onChange} />;
        case 'SolveTaskFunction':
            return <SolveTaskFunctionEditor fn={fn} onChange={onChange} excludeNodeId={excludeNodeId} />;
        case 'IfFunction':
            return <IfFunctionEditor fn={fn} onChange={onChange} excludeNodeId={excludeNodeId} />;
        case 'ShowHintTextFunction':
            return <ShowHintTextFunctionEditor fn={fn} onChange={onChange} />;
        case 'InspectFunction':
            return <InspectFunctionEditor fn={fn} onChange={onChange} />;
        case 'SetVariableFunction':
            return <SetVariableFunctionEditor fn={fn} onChange={onChange} />;
        default:
            return <FunctionUnknownEditor fn={fn} onChange={onChange} />;
    }
}

export default function FunctionList({
    functions,
    onChange,
    excludeNodeId,
    title = 'Functions',
    emptyLabel = 'No functions',
}) {
    const { nodes = {}, items = {} } = useMapState();
    const normalizedFunctions = useMemo(
        () => (Array.isArray(functions) ? functions.map(normalizeFunction) : []),
        [functions],
    );
    const [expandedIndex, setExpandedIndex] = useState(null);

    const handleAdd = (type) => {
        const next = [...normalizedFunctions, createDefaultFunction(type)];
        onChange(next);
        setExpandedIndex(next.length - 1);
    };

    const handleUpdate = (index, nextFn) => {
        const next = [...normalizedFunctions];
        next[index] = normalizeFunction(nextFn);
        onChange(next);
    };

    const handleDelete = (index) => {
        const next = normalizedFunctions.filter((_, i) => i !== index);
        onChange(next);
        if (expandedIndex === index) setExpandedIndex(null);
        if (expandedIndex !== null && expandedIndex > index) setExpandedIndex(expandedIndex - 1);
    };

    const handleMove = (index, direction) => {
        const toIndex = index + direction;
        if (toIndex < 0 || toIndex >= normalizedFunctions.length) return;
        const next = [...normalizedFunctions];
        const [moved] = next.splice(index, 1);
        next.splice(toIndex, 0, moved);
        onChange(next);

        if (expandedIndex === index) setExpandedIndex(toIndex);
        else if (expandedIndex === toIndex) setExpandedIndex(index);
    };

    return (
        <div className="function-list">
            <div className="function-list__header">
                <span className="action-editor__label">{title}</span>
                <div className="function-list__add">
                    {FUNCTION_TYPE_OPTIONS.map((option) => (
                        <button
                            key={option.type}
                            type="button"
                            className="function-list__add-btn"
                            onClick={() => handleAdd(option.type)}
                        >
                            + {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {normalizedFunctions.length === 0 && (
                <div className="function-list__empty">{emptyLabel}</div>
            )}

            {normalizedFunctions.map((fn, index) => {
                const expanded = expandedIndex === index;
                const error = validateFunction(fn, { nodes, items });
                const isUnknownType = Boolean(fn?._unknown) || (fn?.type && !KNOWN_FUNCTION_TYPES.has(fn.type));
                let rowClass = 'function-row';
                if (error) rowClass += ' function-row--error';
                if (isUnknownType) rowClass += ' function-row--unknown';
                return (
                    <div key={index} className={rowClass}>
                        <div className="function-row__header" onClick={() => setExpandedIndex(expanded ? null : index)}>
                            <span className="function-row__summary">{getFunctionSummary(fn)}</span>
                            <div className="function-row__actions">
                                <button
                                    type="button"
                                    className="function-row__btn"
                                    onClick={(e) => { e.stopPropagation(); handleMove(index, -1); }}
                                    disabled={index === 0}
                                    title="Move up"
                                >
                                    ↑
                                </button>
                                <button
                                    type="button"
                                    className="function-row__btn"
                                    onClick={(e) => { e.stopPropagation(); handleMove(index, 1); }}
                                    disabled={index === normalizedFunctions.length - 1}
                                    title="Move down"
                                >
                                    ↓
                                </button>
                                <button
                                    type="button"
                                    className="function-row__btn function-row__btn--danger"
                                    onClick={(e) => { e.stopPropagation(); handleDelete(index); }}
                                    title="Delete function"
                                >
                                    ×
                                </button>
                                {error && (
                                    <span className="function-row__error-icon" title={error}>!</span>
                                )}
                                {isUnknownType && (
                                    <span className="function-row__unknown-icon" title="Unknown function type">?</span>
                                )}
                            </div>
                        </div>

                        {expanded && (
                            <div className="function-row__body">
                                <FunctionEditor
                                    fn={fn}
                                    onChange={(nextFn) => handleUpdate(index, nextFn)}
                                    excludeNodeId={excludeNodeId}
                                />
                                {error && <div className="action-editor__error">{error}</div>}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
