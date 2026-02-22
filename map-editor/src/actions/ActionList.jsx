import { useState, useRef, useCallback } from 'react';
import { useMapDispatch } from '../state/MapContext';
import ActionEditor from './ActionEditor';
import ConfirmDialog from '../shared/ConfirmDialog';

const ACTION_TYPES = [
    { type: 'move', label: '↗ Move', color: 'var(--accent)' },
    { type: 'return', label: '↩ Return', color: 'var(--success)' },
    { type: 'pickup', label: '📦 Pickup', color: 'var(--warning)' },
    { type: 'solve_task', label: '✓ Solve Task', color: '#b39ddb' },
    { type: 'if', label: '❓ If', color: 'var(--edge-conditional-color)' },
];

const TYPE_DEFAULTS = {
    return: { type: 'return' },
    move: { type: 'move', to: '' },
    pickup: { type: 'pickup', item: '' },
    solve_task: { type: 'solve_task', name: '' },
    if: { type: 'if', condition: { type: 'has_item', item: '' }, action: { type: 'return' } },
    custom: { type: 'custom' },
};

function getActionSummary(action) {
    if (action._unknown || action.type === 'custom') return `⚠️ Unknown: ${action.type}`;
    switch (action.type) {
        case 'return': return 'Return';
        case 'move': return `move → ${action.to || '?'}`;
        case 'pickup': return `pickup → ${action.item || '?'}`;
        case 'solve_task': return `solve "${action.name || '?'}"`;
        case 'if': return `if ${action.condition?.type || '?'}`;
        default: return `${action.type || 'unknown'}`;
    }
}

function getTypeBadge(type, action) {
    if (action?._unknown || type === 'custom') {
        return { label: '⚠️', color: 'var(--warning)', isUnknown: true };
    }
    const meta = ACTION_TYPES.find(t => t.type === type);
    return {
        label: meta?.label?.charAt(0) || '?',
        color: meta?.color || 'var(--text-secondary)',
        isUnknown: false
    };
}

export default function ActionList({ nodeId, actions }) {
    const dispatch = useMapDispatch();
    const [expandedIndex, setExpandedIndex] = useState(null);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [deleteIndex, setDeleteIndex] = useState(null);

    // --- Drag reorder state ---
    const [dragIndex, setDragIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const dragStartY = useRef(0);

    const handleAdd = useCallback((type) => {
        dispatch({
            type: 'ADD_ACTION',
            payload: { nodeId, action: { ...TYPE_DEFAULTS[type] } },
        });
        setShowAddMenu(false);
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
                const badge = getTypeBadge(action.type, action);
                const isExpanded = expandedIndex === i;
                const isDragging = dragIndex === i;
                const isDragOver = dragOverIndex === i && dragIndex !== i;

                let rowClass = 'action-row';
                if (badge.isUnknown) rowClass += ' action-row--unknown';
                if (isDragging) rowClass += ' action-row--dragging';
                if (isDragOver) rowClass += ' action-row--drag-over';

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
                            <span
                                className="action-row__badge"
                                style={{ backgroundColor: badge.color }}
                            >
                                {action.type}
                            </span>
                            <span className="action-row__summary">
                                {getActionSummary(action)}
                            </span>
                            <span className="action-row__expand">
                                {isExpanded ? '▾' : '▸'}
                            </span>
                            <button
                                className="action-row__delete"
                                onClick={(e) => { e.stopPropagation(); setDeleteIndex(i); }}
                                title="Delete action"
                            >
                                ×
                            </button>
                        </div>

                        {isExpanded && (
                            <div className="action-row__body">
                                <ActionEditor
                                    action={action}
                                    nodeId={nodeId}
                                    index={i}
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
                    onClick={() => setShowAddMenu(!showAddMenu)}
                >
                    + Add Action
                </button>

                {showAddMenu && (
                    <div className="action-list__add-menu">
                        {ACTION_TYPES.map(({ type, label }) => (
                            <button
                                key={type}
                                className="action-list__add-option"
                                onClick={() => handleAdd(type)}
                            >
                                {label}
                            </button>
                        ))}
                        <div className="action-list__add-divider" style={{ height: 1, backgroundColor: 'var(--border)', margin: '4px 0' }} />
                        <button
                            className="action-list__add-option"
                            onClick={() => handleAdd('custom')}
                        >
                            ⚙️ Custom / Raw JSON
                        </button>
                    </div>
                )}
            </div>

            {/* Delete Confirmation */}
            {deleteIndex !== null && (
                <ConfirmDialog
                    title="Delete Action"
                    message={`Delete this ${actions[deleteIndex]?.type || 'unknown'} action?`}
                    confirmLabel="Delete"
                    danger
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => setDeleteIndex(null)}
                />
            )}
        </div>
    );
}
