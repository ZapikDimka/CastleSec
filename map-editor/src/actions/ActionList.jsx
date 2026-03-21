import { useState, useRef, useCallback } from 'react';
import { useMapState, useMapDispatch } from '../state/MapContext';
import ActionEditor from './ActionEditor';
import ConfirmDialog from '../shared/ConfirmDialog';

const ACTION_DEFAULT = {
    label: 'New action choice',
    once: false,
    functions: [],
};

function getActionSummary(action) {
    const label = action?.label?.trim() || '(missing label)';
    const count = Array.isArray(action?.functions) ? action.functions.length : 0;
    const once = action?.once ? ' · once' : '';
    return `${label} · ${count} function${count === 1 ? '' : 's'}${once}`;
}

function getFunctionError(fn, refs = {}) {
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

function findFirstFunctionError(functions, refs) {
    if (!Array.isArray(functions)) return null;

    for (let i = 0; i < functions.length; i++) {
        const fn = functions[i];
        const directError = getFunctionError(fn, refs);
        if (directError) return `Function ${i + 1}: ${directError}`;

        if (fn?.type === 'IfFunction') {
            const thenError = findFirstFunctionError(fn.then_functions, refs);
            if (thenError) return `Function ${i + 1} (then): ${thenError}`;

            const elseError = findFirstFunctionError(fn.else_functions, refs);
            if (elseError) return `Function ${i + 1} (else): ${elseError}`;
        }

        if (fn?.type === 'SolveTaskFunction') {
            const successError = findFirstFunctionError(fn.on_success, refs);
            if (successError) return `Function ${i + 1} (on_success): ${successError}`;

            const failureError = findFirstFunctionError(fn.on_failure, refs);
            if (failureError) return `Function ${i + 1} (on_failure): ${failureError}`;
        }
    }

    return null;
}

function getActionError(action, state) {
    if (!action?.label?.trim()) return 'Label is required';
    if (!Array.isArray(action?.functions)) return 'Functions must be an array';
    const functionError = findFirstFunctionError(action.functions, {
        nodes: state?.nodes || {},
        items: state?.items || {},
    });
    if (functionError) return functionError;
    return null;
}

export default function ActionList({ nodeId, actions }) {
    const state = useMapState();
    const dispatch = useMapDispatch();
    const [expandedIndex, setExpandedIndex] = useState(null);
    const [deleteIndex, setDeleteIndex] = useState(null);

    // --- Drag reorder state ---
    const [dragIndex, setDragIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const dragStartY = useRef(0);

    const handleAdd = useCallback(() => {
        dispatch({
            type: 'ADD_ACTION',
            payload: { nodeId, action: { ...ACTION_DEFAULT } },
        });
        setExpandedIndex(actions.length); // expand the newly added action
    }, [dispatch, nodeId, actions.length]);

    const handleChange = useCallback((index, updatedAction) => {
        dispatch({
            type: 'UPDATE_ACTION',
            payload: { nodeId, index, action: updatedAction },
        });
    }, [dispatch, nodeId]);

    const handleDeleteConfirm = useCallback(() => {
        if (deleteIndex === null) return;
        dispatch({
            type: 'DELETE_ACTION',
            payload: { nodeId, index: deleteIndex },
        });
        setDeleteIndex(null);
        if (expandedIndex === deleteIndex) setExpandedIndex(null);
        else if (expandedIndex !== null && expandedIndex > deleteIndex) {
            setExpandedIndex(expandedIndex - 1);
        }
    }, [dispatch, nodeId, deleteIndex, expandedIndex]);

    // --- Drag handlers ---
    const handleDragStart = (e, index) => {
        e.dataTransfer.effectAllowed = 'move';
        setDragIndex(index);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIndex(index);
    };

    const handleDrop = (e, toIndex) => {
        e.preventDefault();
        if (dragIndex !== null && dragIndex !== toIndex) {
            dispatch({
                type: 'REORDER_ACTIONS',
                payload: { nodeId, fromIndex: dragIndex, toIndex },
            });
            // Update expanded index to follow the moved item
            if (expandedIndex === dragIndex) setExpandedIndex(toIndex);
            else if (expandedIndex !== null) {
                let newExpanded = expandedIndex;
                if (dragIndex < expandedIndex && toIndex >= expandedIndex) newExpanded--;
                else if (dragIndex > expandedIndex && toIndex <= expandedIndex) newExpanded++;
                setExpandedIndex(newExpanded);
            }
        }
        setDragIndex(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDragIndex(null);
        setDragOverIndex(null);
    };

    return (
        <div className="action-list">
            {actions.length === 0 && (
                <div className="action-list__empty">No actions</div>
            )}

            {actions.map((action, i) => {
                const isExpanded = expandedIndex === i;
                const isDragging = dragIndex === i;
                const isDragOver = dragOverIndex === i && dragIndex !== i;
                const actionError = getActionError(action, state);

                let rowClass = 'action-row';
                if (isDragging) rowClass += ' action-row--dragging';
                if (isDragOver) rowClass += ' action-row--drag-over';
                if (actionError) rowClass += ' action-row--error';

                return (
                    <div
                        key={i}
                        className={rowClass}
                        draggable
                        onDragStart={(e) => handleDragStart(e, i)}
                        onDragOver={(e) => handleDragOver(e, i)}
                        onDrop={(e) => handleDrop(e, i)}
                        onDragEnd={handleDragEnd}
                    >
                        <div
                            className="action-row__header"
                            onClick={() => setExpandedIndex(isExpanded ? null : i)}
                        >
                            <span className="action-row__drag" title="Drag to reorder">⠿</span>
                            <span className="action-row__summary">
                                {getActionSummary(action)}
                            </span>
                            <span className="action-row__expand">
                                {isExpanded ? '▾' : '▸'}
                            </span>
                            {actionError && (
                                <span className="action-row__error-icon" title={actionError}>
                                    🔴
                                </span>
                            )}
                            <button
                                className="action-row__delete"
                                onClick={(e) => { e.stopPropagation(); setDeleteIndex(i); }}
                                title="Delete action choice"
                            >
                                ×
                            </button>
                        </div>

                        {isExpanded && (
                            <div className="action-row__body">
                                <ActionEditor
                                    action={action}
                                    onChange={(updated) => handleChange(i, updated)}
                                />
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Add Action Button */}
            <div className="action-list__add-wrapper">
                <button
                    className="action-list__add-btn"
                    onClick={handleAdd}
                >
                    + Add Action Choice
                </button>
            </div>

            {/* Delete Confirmation */}
            {deleteIndex !== null && (
                <ConfirmDialog
                    title="Delete Action Choice"
                    message={`Delete "${actions[deleteIndex]?.label || 'this action choice'}"?`}
                    confirmLabel="Delete"
                    danger
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => setDeleteIndex(null)}
                />
            )}
        </div>
    );
}
