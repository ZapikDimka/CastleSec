import { useMemo, useState, useEffect } from 'react';
import NodePicker from '../shared/NodePicker';
import ItemPicker from '../shared/ItemPicker';
import { useMapState } from '../state/MapContext';

const FUNCTION_TYPE_OPTIONS = [
    { type: 'MoveFunction', label: 'Move' },
    { type: 'PickUpItemFunction', label: 'Pick Up Item' },
    { type: 'RemoveItemFunction', label: 'Remove Item' },
    { type: 'SolveTaskFunction', label: 'Solve Task' },
    { type: 'ConditionalFunction', label: 'Conditional' },
    { type: 'SetNodeStateFunction', label: 'Set Node State' },
    { type: 'SetGameVariableFunction', label: 'Set Game Variable' },
    { type: 'IncrementGameVariableFunction', label: 'Increment Variable' },
    { type: 'SetTextFunction', label: 'Set Text Field' },
    { type: 'SetImageFunction', label: 'Set Image Field' },
    { type: 'ChangeMapFunction', label: 'Change Map' },
    { type: 'ShowMessageFunction', label: 'Show Message' },
    { type: 'EndGameFunction', label: 'End Game' },
    { type: 'RandomFunction', label: 'Random Branch' },
];

const CONDITION_TYPE_OPTIONS = [
    { type: 'HasItemCondition', label: 'Has Item' },
    { type: 'NodeStateCondition', label: 'Node State' },
    { type: 'GameVariableCondition', label: 'Game Variable' },
    { type: 'AnyCondition', label: 'Any (OR)' },
    { type: 'AllCondition', label: 'All (AND)' },
];

export const KNOWN_FUNCTION_TYPES = new Set(FUNCTION_TYPE_OPTIONS.map((f) => f.type));
export const KNOWN_CONDITION_TYPES = new Set(CONDITION_TYPE_OPTIONS.map((c) => c.type));

function createDefaultCondition(type = 'HasItemCondition') {
    switch (type) {
        case 'HasItemCondition':
            return { type: 'HasItemCondition', item: '', negate: false };
        case 'NodeStateCondition':
            return { type: 'NodeStateCondition', target_node: null, value: '', negate: false };
        case 'GameVariableCondition':
            return { type: 'GameVariableCondition', key: '', value: '', operator: 'eq', negate: false };
        case 'AnyCondition':
            return { type: 'AnyCondition', conditions: [], negate: false };
        case 'AllCondition':
            return { type: 'AllCondition', conditions: [], negate: false };
        default:
            return { type };
    }
}

function createDefaultFunction(type) {
    switch (type) {
        case 'MoveFunction':
            return { type: 'MoveFunction', to: '' };
        case 'PickUpItemFunction':
            return { type: 'PickUpItemFunction', item: '' };
        case 'RemoveItemFunction':
            return { type: 'RemoveItemFunction', item: '' };
        case 'SolveTaskFunction':
            return { type: 'SolveTaskFunction', task: '', on_success: [], on_failure: [], remove_on_success: true };
        case 'ConditionalFunction':
            return {
                type: 'ConditionalFunction',
                condition: createDefaultCondition('HasItemCondition'),
                on_success: [],
                on_failure: [],
            };
        case 'SetNodeStateFunction':
            return { type: 'SetNodeStateFunction', target_node: null, value: '' };
        case 'SetGameVariableFunction':
            return { type: 'SetGameVariableFunction', key: '', value: '' };
        case 'IncrementGameVariableFunction':
            return { type: 'IncrementGameVariableFunction', key: '', amount: 1 };
        case 'SetTextFunction':
            return { type: 'SetTextFunction', target_node: null, variable: 'text', value: '' };
        case 'SetImageFunction':
            return { type: 'SetImageFunction', target_node: null, value: '' };
        case 'ChangeMapFunction':
            return { type: 'ChangeMapFunction', map: '', node: '' };
        case 'ShowMessageFunction':
            return { type: 'ShowMessageFunction', message: '' };
        case 'EndGameFunction':
            return { type: 'EndGameFunction', message: '' };
        case 'RandomFunction':
            return { type: 'RandomFunction', branches: [{ weight: 1, functions: [], once: false }] };
        default:
            return { type };
    }
}

function normalizeCondition(condition) {
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
        return createDefaultCondition('HasItemCondition');
    }

    const type = typeof condition.type === 'string' ? condition.type : 'HasItemCondition';
    if (type === 'HasItemCondition') {
        return {
            ...condition,
            type,
            item: typeof condition.item === 'string' ? condition.item : '',
            negate: Boolean(condition.negate),
        };
    }
    if (type === 'NodeStateCondition') {
        return {
            ...condition,
            type,
            target_node: typeof condition.target_node === 'string' && condition.target_node.trim() ? condition.target_node : null,
            value: typeof condition.value === 'string' ? condition.value : '',
            negate: Boolean(condition.negate),
        };
    }
    if (type === 'GameVariableCondition') {
        const validOperator = ['eq', 'gt', 'gte', 'lt', 'lte'].includes(condition.operator) ? condition.operator : 'eq';
        return {
            ...condition,
            type,
            key: typeof condition.key === 'string' ? condition.key : '',
            value: typeof condition.value === 'string' ? condition.value : '',
            operator: validOperator,
            negate: Boolean(condition.negate),
        };
    }
    if (type === 'AnyCondition' || type === 'AllCondition') {
        return {
            ...condition,
            type,
            conditions: Array.isArray(condition.conditions) ? condition.conditions.map(normalizeCondition) : [],
            negate: Boolean(condition.negate),
        };
    }

    return { ...condition, type, negate: Boolean(condition.negate) };
}

function normalizeFunction(fn) {
    if (!fn || typeof fn !== 'object' || Array.isArray(fn)) return { type: 'UnknownFunction' };

    if (fn.type === 'SolveTaskFunction') {
        return {
            ...fn,
            task: typeof fn.task === 'string' ? fn.task : '',
            on_success: Array.isArray(fn.on_success) ? fn.on_success : [],
            on_failure: Array.isArray(fn.on_failure) ? fn.on_failure : [],
            remove_on_success: fn.remove_on_success !== false,
        };
    }

    if (fn.type === 'ConditionalFunction') {
        return {
            ...fn,
            condition: normalizeCondition(fn.condition),
            on_success: Array.isArray(fn.on_success) ? fn.on_success : [],
            on_failure: Array.isArray(fn.on_failure) ? fn.on_failure : [],
        };
    }

    if (fn.type === 'SetNodeStateFunction') {
        return {
            ...fn,
            target_node: typeof fn.target_node === 'string' && fn.target_node.trim() ? fn.target_node : null,
            value: typeof fn.value === 'string' ? fn.value : '',
        };
    }

    if (fn.type === 'SetTextFunction') {
        return {
            ...fn,
            target_node: typeof fn.target_node === 'string' && fn.target_node.trim() ? fn.target_node : null,
            variable: typeof fn.variable === 'string' ? fn.variable : 'text',
            value: typeof fn.value === 'string' ? fn.value : '',
        };
    }

    if (fn.type === 'SetImageFunction') {
        return {
            ...fn,
            target_node: typeof fn.target_node === 'string' && fn.target_node.trim() ? fn.target_node : null,
            value: typeof fn.value === 'string' ? fn.value : '',
        };
    }

    if (fn.type === 'SetGameVariableFunction') {
        return {
            ...fn,
            key: typeof fn.key === 'string' ? fn.key : '',
            value: typeof fn.value === 'string' ? fn.value : '',
        };
    }

    if (fn.type === 'IncrementGameVariableFunction') {
        const amount = Number(fn.amount);
        return {
            ...fn,
            key: typeof fn.key === 'string' ? fn.key : '',
            amount: Number.isFinite(amount) ? Math.trunc(amount) : 1,
        };
    }

    if (fn.type === 'RandomFunction') {
        return {
            ...fn,
            branches: Array.isArray(fn.branches)
                ? fn.branches.map((branch) => ({
                    weight: Number.isFinite(Number(branch?.weight)) ? Number(branch.weight) : 1,
                    once: Boolean(branch?.once),
                    functions: Array.isArray(branch?.functions) ? branch.functions : [],
                }))
                : [],
        };
    }

    if (fn.type === 'ChangeMapFunction') {
        return {
            ...fn,
            map: typeof fn.map === 'string' ? fn.map : '',
            node: typeof fn.node === 'string' ? fn.node : '',
        };
    }

    if (fn.type === 'ShowMessageFunction' || fn.type === 'EndGameFunction') {
        return {
            ...fn,
            message: typeof fn.message === 'string' ? fn.message : '',
        };
    }

    if (fn.type === 'MoveFunction') return { ...fn, to: typeof fn.to === 'string' ? fn.to : '' };
    if (fn.type === 'PickUpItemFunction' || fn.type === 'RemoveItemFunction') {
        return { ...fn, item: typeof fn.item === 'string' ? fn.item : '' };
    }

    return fn;
}

export function validateCondition(condition, refs = {}) {
    const { nodes = {}, items = {} } = refs;
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return 'Condition must be an object.';

    if (!KNOWN_CONDITION_TYPES.has(condition.type)) {
        return `Unsupported condition type "${condition.type || ''}".`;
    }

    if (condition.type === 'HasItemCondition') {
        if (!condition.item?.trim()) return 'HasItemCondition.item is required.';
        if (!items[condition.item]) return `Condition item "${condition.item}" does not exist.`;
    }

    if (condition.type === 'NodeStateCondition') {
        if (condition.target_node && !nodes[condition.target_node]) {
            return `Condition target node "${condition.target_node}" does not exist.`;
        }
    }

    if (condition.type === 'GameVariableCondition') {
        if (!condition.key?.trim()) return 'GameVariableCondition.key is required.';
        const validOperator = ['eq', 'gt', 'gte', 'lt', 'lte'];
        if (!validOperator.includes(condition.operator)) return 'GameVariableCondition.operator is invalid.';
    }

    if (condition.type === 'AnyCondition' || condition.type === 'AllCondition') {
        if (!Array.isArray(condition.conditions)) return `${condition.type}.conditions must be an array.`;
        for (const nested of condition.conditions) {
            const nestedErr = validateCondition(nested, refs);
            if (nestedErr) return nestedErr;
        }
    }

    return null;
}

export function validateFunction(fn, refs = {}) {
    const { nodes = {}, items = {}, mapsById = {} } = refs;
    if (!fn || typeof fn !== 'object') return null;
    if (!KNOWN_FUNCTION_TYPES.has(fn.type)) {
        return `Unsupported function type "${fn.type || ''}".`;
    }

    if (fn.type === 'MoveFunction') {
        if (!fn.to?.trim()) return 'Target node is required.';
        if (!nodes[fn.to]) return `Target node "${fn.to}" does not exist.`;
        return null;
    }

    if (fn.type === 'PickUpItemFunction' || fn.type === 'RemoveItemFunction') {
        if (!fn.item?.trim()) return 'Item is required.';
        if (!items[fn.item]) return `Item "${fn.item}" does not exist.`;
        return null;
    }

    if (fn.type === 'SolveTaskFunction') {
        if (!fn.task?.trim()) return 'Task is required.';
        if (!Array.isArray(fn.on_success)) return 'on_success must be an array.';
        if (!Array.isArray(fn.on_failure)) return 'on_failure must be an array.';
        for (const nested of fn.on_success) {
            const nestedErr = validateFunction(nested, refs);
            if (nestedErr) return nestedErr;
        }
        for (const nested of fn.on_failure) {
            const nestedErr = validateFunction(nested, refs);
            if (nestedErr) return nestedErr;
        }
        return null;
    }

    if (fn.type === 'ConditionalFunction') {
        const conditionError = validateCondition(fn.condition, refs);
        if (conditionError) return conditionError;
        if (!Array.isArray(fn.on_success)) return 'on_success must be an array.';
        if (!Array.isArray(fn.on_failure)) return 'on_failure must be an array.';
        for (const nested of fn.on_success) {
            const nestedErr = validateFunction(nested, refs);
            if (nestedErr) return nestedErr;
        }
        for (const nested of fn.on_failure) {
            const nestedErr = validateFunction(nested, refs);
            if (nestedErr) return nestedErr;
        }
        return null;
    }

    if (fn.type === 'SetNodeStateFunction') {
        if (fn.target_node && !nodes[fn.target_node]) return `Target node "${fn.target_node}" does not exist.`;
        return null;
    }

    if (fn.type === 'SetTextFunction') {
        if (fn.target_node && !nodes[fn.target_node]) return `Target node "${fn.target_node}" does not exist.`;
        if (!fn.variable?.trim()) return 'Variable is required.';
        if (!fn.value?.trim()) return 'Value is required.';
        return null;
    }

    if (fn.type === 'SetImageFunction') {
        if (fn.target_node && !nodes[fn.target_node]) return `Target node "${fn.target_node}" does not exist.`;
        if (!fn.value?.trim()) return 'Image value is required.';
        return null;
    }

    if (fn.type === 'SetGameVariableFunction') {
        if (!fn.key?.trim()) return 'Variable key is required.';
        return null;
    }

    if (fn.type === 'IncrementGameVariableFunction') {
        if (!fn.key?.trim()) return 'Variable key is required.';
        if (!Number.isFinite(Number(fn.amount))) return 'Amount must be a number.';
        return null;
    }

    if (fn.type === 'ChangeMapFunction') {
        if (!fn.map?.trim()) return 'Map is required.';
        if (!mapsById[fn.map]) return `Map "${fn.map}" does not exist.`;
        if (!fn.node?.trim()) return 'Node is required.';
        return null;
    }

    if (fn.type === 'ShowMessageFunction') {
        if (!fn.message?.trim()) return 'Message is required.';
        return null;
    }

    if (fn.type === 'EndGameFunction') {
        return null;
    }

    if (fn.type === 'RandomFunction') {
        if (!Array.isArray(fn.branches) || fn.branches.length === 0) return 'RandomFunction.branches must contain at least one branch.';
        for (const branch of fn.branches) {
            if (!Number.isFinite(Number(branch.weight)) || Number(branch.weight) <= 0) {
                return 'Random branch weight must be > 0.';
            }
            if (!Array.isArray(branch.functions)) return 'Random branch functions must be an array.';
            for (const nested of branch.functions) {
                const nestedErr = validateFunction(nested, refs);
                if (nestedErr) return nestedErr;
            }
        }
        return null;
    }

    return null;
}

function getFunctionSummary(fn) {
    switch (fn?.type) {
        case 'MoveFunction':
            return `Move to ${fn.to || '(missing node)'}`;
        case 'PickUpItemFunction':
            return `Pick up ${fn.item || '(missing item)'}`;
        case 'RemoveItemFunction':
            return `Remove ${fn.item || '(missing item)'}`;
        case 'SolveTaskFunction': {
            const task = fn.task?.trim() || '(missing task)';
            const successCount = Array.isArray(fn.on_success) ? fn.on_success.length : 0;
            const failureCount = Array.isArray(fn.on_failure) ? fn.on_failure.length : 0;
            return `Solve "${task}" · success:${successCount} · failure:${failureCount}`;
        }
        case 'ConditionalFunction':
            return `Conditional (${fn.condition?.type || 'missing condition'})`;
        case 'SetNodeStateFunction':
            return `Set state on ${fn.target_node || 'current'} = ${fn.value || '(empty)'}`;
        case 'SetGameVariableFunction':
            return `Set var ${fn.key || '(key)'} = ${fn.value ?? ''}`;
        case 'IncrementGameVariableFunction':
            return `Inc var ${fn.key || '(key)'} by ${fn.amount ?? 1}`;
        case 'SetTextFunction':
            return `Set ${fn.target_node || 'current'}.${fn.variable || 'text'} = ${fn.value?.slice(0, 20) || '(empty)'}`;
        case 'SetImageFunction':
            return `Set image on ${fn.target_node || 'current'} -> ${fn.value || '(missing)'}`;
        case 'ChangeMapFunction':
            return `Change map to ${fn.map || '(map)'}/${fn.node || '(node)'}`;
        case 'ShowMessageFunction':
            return fn.message ? `Message: ${fn.message.slice(0, 40)}` : 'Message: (missing)';
        case 'EndGameFunction':
            return fn.message ? `End game: ${fn.message.slice(0, 32)}` : 'End game';
        case 'RandomFunction':
            return `Random branches: ${Array.isArray(fn.branches) ? fn.branches.length : 0}`;
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
        </div>
    );
}

function OptionalNodeTargetEditor({ value, onChange }) {
    const usingCurrent = !value;
    return (
        <div className="action-editor__field">
            <label className="action-editor__label action-editor__checkbox-label">
                <input
                    type="checkbox"
                    checked={usingCurrent}
                    onChange={(e) => onChange(e.target.checked ? null : '')}
                />
                <span>Use current node</span>
            </label>
            {!usingCurrent && (
                <NodePicker value={value || ''} onChange={(target_node) => onChange(target_node)} />
            )}
        </div>
    );
}

function ConditionEditor({ condition, onChange }) {
    const normalized = normalizeCondition(condition);

    const update = (patch) => onChange(normalizeCondition({ ...normalized, ...patch }));

    if (!KNOWN_CONDITION_TYPES.has(normalized.type)) {
        return <UnknownConditionEditor condition={normalized} onChange={onChange} />;
    }

    return (
        <div className="action-editor__unknown" style={{ marginTop: 6 }}>
            <div className="action-editor__field">
                <label className="action-editor__label">Condition Type</label>
                <select
                    className="panel__select"
                    value={normalized.type}
                    onChange={(e) => onChange(createDefaultCondition(e.target.value))}
                >
                    {CONDITION_TYPE_OPTIONS.map((option) => (
                        <option key={option.type} value={option.type}>{option.label}</option>
                    ))}
                </select>
            </div>

            <label className="action-editor__label action-editor__checkbox-label">
                <input
                    type="checkbox"
                    checked={Boolean(normalized.negate)}
                    onChange={(e) => update({ negate: e.target.checked })}
                />
                <span>Negate</span>
            </label>

            {normalized.type === 'HasItemCondition' && (
                <div className="action-editor__field">
                    <label className="action-editor__label">Item</label>
                    <ItemPicker value={normalized.item || ''} onChange={(item) => update({ item })} />
                </div>
            )}

            {normalized.type === 'NodeStateCondition' && (
                <>
                    <OptionalNodeTargetEditor value={normalized.target_node} onChange={(target_node) => update({ target_node })} />
                    <div className="action-editor__field">
                        <label className="action-editor__label">State Value</label>
                        <input
                            className="panel__input"
                            type="text"
                            value={normalized.value || ''}
                            onChange={(e) => update({ value: e.target.value })}
                            spellCheck={false}
                        />
                    </div>
                </>
            )}

            {normalized.type === 'GameVariableCondition' && (
                <>
                    <div className="action-editor__field">
                        <label className="action-editor__label">Variable Key</label>
                        <input
                            className="panel__input"
                            type="text"
                            value={normalized.key || ''}
                            onChange={(e) => update({ key: e.target.value })}
                            spellCheck={false}
                        />
                    </div>
                    <div className="action-editor__field">
                        <label className="action-editor__label">Operator</label>
                        <select
                            className="panel__select"
                            value={normalized.operator || 'eq'}
                            onChange={(e) => update({ operator: e.target.value })}
                        >
                            <option value="eq">eq</option>
                            <option value="gt">gt</option>
                            <option value="gte">gte</option>
                            <option value="lt">lt</option>
                            <option value="lte">lte</option>
                        </select>
                    </div>
                    <div className="action-editor__field">
                        <label className="action-editor__label">Value</label>
                        <input
                            className="panel__input"
                            type="text"
                            value={normalized.value || ''}
                            onChange={(e) => update({ value: e.target.value })}
                            spellCheck={false}
                        />
                    </div>
                </>
            )}

            {(normalized.type === 'AnyCondition' || normalized.type === 'AllCondition') && (
                <ConditionList
                    title="Nested Conditions"
                    conditions={normalized.conditions || []}
                    onChange={(conditions) => update({ conditions })}
                />
            )}

        </div>
    );
}

function UnknownConditionEditor({ condition, onChange }) {
    const [raw, setRaw] = useState(JSON.stringify(condition, null, 2));
    const [error, setError] = useState(null);

    useEffect(() => {
        setRaw(JSON.stringify(condition, null, 2));
        setError(null);
    }, [condition]);

    const handleBlur = () => {
        try {
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !parsed.type) {
                setError('Condition must be an object with a "type" field.');
                return;
            }
            setError(null);
            onChange(parsed);
        } catch {
            setError('Invalid JSON.');
        }
    };

    return (
        <div className="action-editor__unknown">
            <div className="action-editor__unknown-label">
                Unknown condition type: <code>{condition?.type || 'UnknownCondition'}</code>
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
        </div>
    );
}

function ConditionList({ conditions, onChange, title = 'Conditions' }) {
    const normalizedConditions = useMemo(
        () => (Array.isArray(conditions) ? conditions.map(normalizeCondition) : []),
        [conditions],
    );
    const [expandedIndex, setExpandedIndex] = useState(null);

    const addCondition = (type) => {
        onChange([...normalizedConditions, createDefaultCondition(type)]);
    };

    const updateCondition = (index, nextCondition) => {
        const next = [...normalizedConditions];
        next[index] = normalizeCondition(nextCondition);
        onChange(next);
    };

    const deleteCondition = (index) => {
        onChange(normalizedConditions.filter((_, i) => i !== index));
        if (expandedIndex === index) setExpandedIndex(null);
    };

    return (
        <div className="function-list" style={{ marginTop: 8 }}>
            <div className="function-list__header">
                <span className="action-editor__label">{title}</span>
                <div className="function-list__add">
                    {CONDITION_TYPE_OPTIONS.map((option) => (
                        <button
                            key={option.type}
                            type="button"
                            className="function-list__add-btn"
                            onClick={() => addCondition(option.type)}
                        >
                            + {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {normalizedConditions.length === 0 && <div className="function-list__empty">No conditions</div>}

            {normalizedConditions.map((condition, index) => {
                const expanded = expandedIndex === index;
                return (
                    <div key={index} className="function-row">
                        <div className="function-row__header" onClick={() => setExpandedIndex(expanded ? null : index)}>
                            <span className="function-row__summary">{condition.type}</span>
                            <div className="function-row__actions">
                                <button
                                    type="button"
                                    className="function-row__btn function-row__btn--danger"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteCondition(index);
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                        {expanded && (
                            <div className="function-row__body">
                                <ConditionEditor condition={condition} onChange={(next) => updateCondition(index, next)} />
                            </div>
                        )}
                    </div>
                );
            })}
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

function PickOrRemoveItemEditor({ fn, onChange, typeLabel }) {
    return (
        <div className="action-editor__field">
            <label className="action-editor__label">{typeLabel} Item</label>
            <ItemPicker
                value={fn?.item || ''}
                onChange={(item) => onChange({ ...fn, item })}
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
                    onChange={(e) => onChange({ ...normalized, task: e.target.value })}
                    placeholder="Task id or path"
                    spellCheck={false}
                />
            </div>

            <label className="action-editor__label action-editor__checkbox-label">
                <input
                    type="checkbox"
                    checked={Boolean(normalized.remove_on_success)}
                    onChange={(e) => onChange({ ...normalized, remove_on_success: e.target.checked })}
                />
                <span>Remove action on task success</span>
            </label>

            <FunctionList
                title="On Success"
                emptyLabel="No success functions"
                functions={normalized.on_success}
                onChange={(on_success) => onChange({ ...normalized, on_success })}
                excludeNodeId={excludeNodeId}
            />

            <FunctionList
                title="On Failure"
                emptyLabel="No failure functions"
                functions={normalized.on_failure}
                onChange={(on_failure) => onChange({ ...normalized, on_failure })}
                excludeNodeId={excludeNodeId}
            />
        </div>
    );
}

function ConditionalFunctionEditor({ fn, onChange, excludeNodeId }) {
    const normalized = normalizeFunction(fn);
    return (
        <div className="solve-task-editor">
            <div className="if-editor__section">
                <div className="if-editor__heading">Condition</div>
                <ConditionEditor
                    condition={normalized.condition}
                    onChange={(condition) => onChange({ ...normalized, condition })}
                />
            </div>

            <FunctionList
                title="On Success"
                emptyLabel="No success functions"
                functions={normalized.on_success}
                onChange={(on_success) => onChange({ ...normalized, on_success })}
                excludeNodeId={excludeNodeId}
            />

            <FunctionList
                title="On Failure"
                emptyLabel="No failure functions"
                functions={normalized.on_failure}
                onChange={(on_failure) => onChange({ ...normalized, on_failure })}
                excludeNodeId={excludeNodeId}
            />
        </div>
    );
}

function SetNodeStateFunctionEditor({ fn, onChange }) {
    const normalized = normalizeFunction(fn);
    return (
        <>
            <OptionalNodeTargetEditor value={normalized.target_node} onChange={(target_node) => onChange({ ...normalized, target_node })} />
            <div className="action-editor__field">
                <label className="action-editor__label">State Value</label>
                <input
                    className="panel__input"
                    type="text"
                    value={normalized.value || ''}
                    onChange={(e) => onChange({ ...normalized, value: e.target.value })}
                    spellCheck={false}
                />
            </div>
        </>
    );
}

function SetTextFunctionEditor({ fn, onChange }) {
    const normalized = normalizeFunction(fn);
    return (
        <>
            <OptionalNodeTargetEditor value={normalized.target_node} onChange={(target_node) => onChange({ ...normalized, target_node })} />
            <div className="action-editor__field">
                <label className="action-editor__label">Field</label>
                <select
                    className="panel__select"
                    value={normalized.variable || 'text'}
                    onChange={(e) => onChange({ ...normalized, variable: e.target.value })}
                >
                    <option value="text">text</option>
                    <option value="name">name</option>
                </select>
            </div>
            <div className="action-editor__field">
                <label className="action-editor__label">Value</label>
                <textarea
                    className="panel__textarea"
                    value={normalized.value || ''}
                    onChange={(e) => onChange({ ...normalized, value: e.target.value })}
                    rows={3}
                />
            </div>
        </>
    );
}

function SetImageFunctionEditor({ fn, onChange }) {
    const normalized = normalizeFunction(fn);
    return (
        <>
            <OptionalNodeTargetEditor value={normalized.target_node} onChange={(target_node) => onChange({ ...normalized, target_node })} />
            <div className="action-editor__field">
                <label className="action-editor__label">Image Ref (asset id/path)</label>
                <input
                    className="panel__input"
                    type="text"
                    value={normalized.value || ''}
                    onChange={(e) => onChange({ ...normalized, value: e.target.value })}
                    spellCheck={false}
                />
            </div>
        </>
    );
}

function SetGameVariableFunctionEditor({ fn, onChange }) {
    const normalized = normalizeFunction(fn);
    return (
        <>
            <div className="action-editor__field">
                <label className="action-editor__label">Variable Key</label>
                <input
                    className="panel__input"
                    type="text"
                    value={normalized.key || ''}
                    onChange={(e) => onChange({ ...normalized, key: e.target.value })}
                    spellCheck={false}
                />
            </div>
            <div className="action-editor__field">
                <label className="action-editor__label">Value (empty clears)</label>
                <input
                    className="panel__input"
                    type="text"
                    value={normalized.value || ''}
                    onChange={(e) => onChange({ ...normalized, value: e.target.value })}
                    spellCheck={false}
                />
            </div>
        </>
    );
}

function IncrementGameVariableFunctionEditor({ fn, onChange }) {
    const normalized = normalizeFunction(fn);
    return (
        <>
            <div className="action-editor__field">
                <label className="action-editor__label">Variable Key</label>
                <input
                    className="panel__input"
                    type="text"
                    value={normalized.key || ''}
                    onChange={(e) => onChange({ ...normalized, key: e.target.value })}
                    spellCheck={false}
                />
            </div>
            <div className="action-editor__field">
                <label className="action-editor__label">Amount</label>
                <input
                    className="panel__input"
                    type="number"
                    value={normalized.amount}
                    onChange={(e) => onChange({ ...normalized, amount: Number(e.target.value) })}
                />
            </div>
        </>
    );
}

function ChangeMapFunctionEditor({ fn, onChange }) {
    const normalized = normalizeFunction(fn);
    const state = useMapState();
    const selectedMap = state.mapsById?.[normalized.map];
    const nodeOptions = selectedMap?.nodes ? Object.keys(selectedMap.nodes) : [];

    return (
        <>
            <div className="action-editor__field">
                <label className="action-editor__label">Target Map</label>
                <select
                    className="panel__select"
                    value={normalized.map || ''}
                    onChange={(e) => onChange({ ...normalized, map: e.target.value, node: '' })}
                >
                    <option value="">— select map —</option>
                    {(state.mapOrder || []).map((mapId) => (
                        <option key={mapId} value={mapId}>{mapId}</option>
                    ))}
                </select>
            </div>
            <div className="action-editor__field">
                <label className="action-editor__label">Target Node</label>
                <select
                    className="panel__select"
                    value={normalized.node || ''}
                    onChange={(e) => onChange({ ...normalized, node: e.target.value })}
                >
                    <option value="">— select node —</option>
                    {nodeOptions.map((nodeId) => (
                        <option key={nodeId} value={nodeId}>{nodeId}</option>
                    ))}
                </select>
            </div>
        </>
    );
}

function ShowMessageFunctionEditor({ fn, onChange }) {
    const normalized = normalizeFunction(fn);
    return (
        <div className="action-editor__field">
            <label className="action-editor__label">Message</label>
            <textarea
                className="panel__textarea"
                value={normalized.message || ''}
                onChange={(e) => onChange({ ...normalized, message: e.target.value })}
                rows={3}
            />
        </div>
    );
}

function EndGameFunctionEditor({ fn, onChange }) {
    const normalized = normalizeFunction(fn);
    return (
        <div className="action-editor__field">
            <label className="action-editor__label">Final Message (optional)</label>
            <textarea
                className="panel__textarea"
                value={normalized.message || ''}
                onChange={(e) => onChange({ ...normalized, message: e.target.value })}
                rows={3}
            />
        </div>
    );
}

function RandomFunctionEditor({ fn, onChange, excludeNodeId }) {
    const normalized = normalizeFunction(fn);

    const updateBranch = (index, patch) => {
        const next = [...normalized.branches];
        next[index] = { ...next[index], ...patch };
        onChange({ ...normalized, branches: next });
    };

    const addBranch = () => {
        onChange({
            ...normalized,
            branches: [...normalized.branches, { weight: 1, functions: [], once: false }],
        });
    };

    const deleteBranch = (index) => {
        onChange({ ...normalized, branches: normalized.branches.filter((_, i) => i !== index) });
    };

    return (
        <div className="solve-task-editor">
            {(normalized.branches || []).map((branch, index) => (
                <div key={index} className="function-row">
                    <div className="function-row__body">
                        <div className="action-editor__field">
                            <label className="action-editor__label">Branch {index + 1} Weight</label>
                            <input
                                className="panel__input"
                                type="number"
                                min="0.0001"
                                step="0.1"
                                value={branch.weight}
                                onChange={(e) => updateBranch(index, { weight: Number(e.target.value) })}
                            />
                        </div>
                        <label className="action-editor__label action-editor__checkbox-label">
                            <input
                                type="checkbox"
                                checked={Boolean(branch.once)}
                                onChange={(e) => updateBranch(index, { once: e.target.checked })}
                            />
                            <span>Use this branch once</span>
                        </label>

                        <FunctionList
                            title={`Branch ${index + 1} Functions`}
                            emptyLabel="No branch functions"
                            functions={branch.functions || []}
                            onChange={(functions) => updateBranch(index, { functions })}
                            excludeNodeId={excludeNodeId}
                        />

                        <button
                            type="button"
                            className="function-row__btn function-row__btn--danger"
                            onClick={() => deleteBranch(index)}
                            title="Delete branch"
                        >
                            ×
                        </button>
                    </div>
                </div>
            ))}
            <button type="button" className="function-list__add-btn" onClick={addBranch}>+ Add Branch</button>
        </div>
    );
}

function FunctionEditor({ fn, onChange, excludeNodeId }) {
    switch (fn?.type) {
        case 'MoveFunction':
            return <MoveFunctionEditor fn={fn} onChange={onChange} excludeNodeId={excludeNodeId} />;
        case 'PickUpItemFunction':
            return <PickOrRemoveItemEditor fn={fn} onChange={onChange} typeLabel="Pickup" />;
        case 'RemoveItemFunction':
            return <PickOrRemoveItemEditor fn={fn} onChange={onChange} typeLabel="Remove" />;
        case 'SolveTaskFunction':
            return <SolveTaskFunctionEditor fn={fn} onChange={onChange} excludeNodeId={excludeNodeId} />;
        case 'ConditionalFunction':
            return <ConditionalFunctionEditor fn={fn} onChange={onChange} excludeNodeId={excludeNodeId} />;
        case 'SetNodeStateFunction':
            return <SetNodeStateFunctionEditor fn={fn} onChange={onChange} />;
        case 'SetGameVariableFunction':
            return <SetGameVariableFunctionEditor fn={fn} onChange={onChange} />;
        case 'IncrementGameVariableFunction':
            return <IncrementGameVariableFunctionEditor fn={fn} onChange={onChange} />;
        case 'SetTextFunction':
            return <SetTextFunctionEditor fn={fn} onChange={onChange} />;
        case 'SetImageFunction':
            return <SetImageFunctionEditor fn={fn} onChange={onChange} />;
        case 'ChangeMapFunction':
            return <ChangeMapFunctionEditor fn={fn} onChange={onChange} />;
        case 'ShowMessageFunction':
            return <ShowMessageFunctionEditor fn={fn} onChange={onChange} />;
        case 'EndGameFunction':
            return <EndGameFunctionEditor fn={fn} onChange={onChange} />;
        case 'RandomFunction':
            return <RandomFunctionEditor fn={fn} onChange={onChange} excludeNodeId={excludeNodeId} />;
        default:
            return <FunctionUnknownEditor fn={fn} onChange={onChange} />;
    }
}

export function ConditionListEditor({ conditions, onChange, title = 'Conditions' }) {
    return <ConditionList conditions={conditions} onChange={onChange} title={title} />;
}

export default function FunctionList({
    functions,
    onChange,
    excludeNodeId,
    title = 'Functions',
    emptyLabel = 'No functions',
}) {
    const state = useMapState();
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

    const handleFunctionChange = (index, nextFn) => {
        const next = [...normalizedFunctions];
        next[index] = normalizeFunction(nextFn);
        onChange(next);
    };

    const handleDelete = (index) => {
        const next = normalizedFunctions.filter((_, i) => i !== index);
        onChange(next);
        if (expandedIndex === index) setExpandedIndex(null);
        else if (expandedIndex !== null && expandedIndex > index) setExpandedIndex(expandedIndex - 1);
    };

    const handleReorder = (index, dir) => {
        const toIndex = index + dir;
        if (toIndex < 0 || toIndex >= normalizedFunctions.length) return;
        const next = [...normalizedFunctions];
        const [moved] = next.splice(index, 1);
        next.splice(toIndex, 0, moved);
        onChange(next);
        if (expandedIndex === index) setExpandedIndex(toIndex);
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
                const error = validateFunction(fn, {
                    nodes: state.nodes,
                    items: state.items,
                    mapsById: state.mapsById,
                });
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
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleReorder(index, -1);
                                    }}
                                    disabled={index === 0}
                                    title="Move up"
                                >
                                    ↑
                                </button>
                                <button
                                    type="button"
                                    className="function-row__btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleReorder(index, 1);
                                    }}
                                    disabled={index === normalizedFunctions.length - 1}
                                    title="Move down"
                                >
                                    ↓
                                </button>
                                <button
                                    type="button"
                                    className="function-row__btn function-row__btn--danger"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(index);
                                    }}
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
                                    onChange={(nextFn) => handleFunctionChange(index, nextFn)}
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
