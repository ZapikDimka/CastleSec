import { useState, useEffect } from 'react';
import { useMapState, useMapDispatch } from '../state/MapContext';
import { useValidation } from '../validation/ValidationContext';
import ImagePicker from '../shared/ImagePicker';
import ConfirmDialog from '../shared/ConfirmDialog';

export default function ItemEditor({ itemId }) {
    const state = useMapState();
    const dispatch = useMapDispatch();
    const item = state.items[itemId];
    const validation = useValidation();

    const [editingId, setEditingId] = useState(false);
    const [idValue, setIdValue] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    if (!item) return null;

    const itemIssues = validation.get(itemId) || [];
    const prefixIssue = itemIssues.find(i => i.id === 'V-08');

    // Count references to this item
    const refs = getItemReferences(state.nodes, itemId);

    // Listen for global delete shortcut
    useEffect(() => {
        const handleRequestDelete = () => {
            if (itemId) {
                setShowDeleteConfirm(true);
            }
        };
        window.addEventListener('requestDelete', handleRequestDelete);
        return () => window.removeEventListener('requestDelete', handleRequestDelete);
    }, [itemId]);

    // ---- Field Handlers ----
    const handleNameChange = (e) => {
        dispatch({
            type: 'UPDATE_ITEM',
            payload: { id: itemId, changes: { name: e.target.value } },
        });
    };

    const handleImageChange = (imagePath) => {
        dispatch({
            type: 'UPDATE_ITEM',
            payload: { id: itemId, changes: { image: imagePath || null } },
        });
    };

    // ---- ID Editing ----
    const handleIdEditStart = () => {
        setEditingId(true);
        setIdValue(itemId);
    };

    const handleIdEditEnd = () => {
        const newId = idValue.trim();
        setEditingId(false);

        if (!newId || newId === itemId) return;
        if (state.items[newId]) return; // Duplicate

        dispatch({
            type: 'RENAME_ITEM',
            payload: { oldId: itemId, newId },
        });
    };

    const handleIdKeyDown = (e) => {
        if (e.key === 'Enter') handleIdEditEnd();
        if (e.key === 'Escape') {
            setEditingId(false);
            setIdValue(itemId);
        }
    };

    // ---- Delete ----
    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const handleDeleteConfirm = () => {
        dispatch({ type: 'DELETE_ITEM', payload: { id: itemId } });
        setShowDeleteConfirm(false);
    };

    // Build delete warning message
    const deleteMessage = refs.length > 0
        ? `Delete "${item.name}" (${itemId})? This item is referenced by ${refs.length} action(s):\n\n${refs.map(r => `• ${r.nodeId} → ${r.type}`).join('\n')}\n\nAll references will be cleaned up.`
        : `Delete "${item.name}" (${itemId})?`;

    return (
        <div className="item-editor">
            <div className="item-editor__divider" />

            {/* Item ID */}
            <div className="panel__section">
                <label className="panel__label">Item ID</label>
                {editingId ? (
                    <input
                        className="panel__id-input"
                        value={idValue}
                        onChange={(e) => setIdValue(e.target.value)}
                        onBlur={handleIdEditEnd}
                        onKeyDown={handleIdKeyDown}
                        autoFocus
                        spellCheck={false}
                    />
                ) : (
                    <span
                        className="panel__id-label"
                        onClick={handleIdEditStart}
                        title="Click to edit ID"
                    >
                        {itemId}
                    </span>
                )}
                {prefixIssue && (
                    <div className="panel__validation-msg panel__validation-msg--warning">
                        ⚠️ {prefixIssue.message}
                    </div>
                )}
            </div>

            {/* Name */}
            <div className="panel__section">
                <label className="panel__label">Name</label>
                <input
                    className="panel__input"
                    type="text"
                    value={item.name}
                    onChange={handleNameChange}
                    placeholder="Item name"
                    spellCheck={false}
                />
            </div>

            {/* Image */}
            <div className="panel__section">
                <label className="panel__label">Image</label>
                <ImagePicker
                    value={item.image}
                    onChange={handleImageChange}
                />
            </div>

            {/* Delete */}
            <div className="panel__actions-row">
                <button
                    className="panel__btn panel__btn--danger"
                    onClick={handleDeleteClick}
                >
                    🗑 Delete Item
                </button>
            </div>

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <ConfirmDialog
                    title="Delete Item"
                    message={deleteMessage}
                    confirmLabel="Delete"
                    danger
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => setShowDeleteConfirm(false)}
                />
            )}
        </div>
    );
}

// Find all actions referencing this item
function getItemReferences(nodes, itemId) {
    const refs = [];
    for (const [nodeId, node] of Object.entries(nodes)) {
        findRefsInActions(node.actions, nodeId, itemId, refs);
    }
    return refs;
}

function findRefsInActions(actions, nodeId, itemId, refs) {
    for (const action of actions || []) {
        if (Array.isArray(action?.functions)) {
            findRefsInFunctions(action.functions, nodeId, itemId, refs);
            continue;
        }
        if (action.type === 'pickup' && action.item === itemId) {
            refs.push({ nodeId, type: 'pickup' });
        }
        if (action.type === 'if') {
            if (action.condition?.type === 'has_item' && action.condition.item === itemId) {
                refs.push({ nodeId, type: 'has_item condition' });
            }
            if (action.action) {
                findRefsInActions([action.action], nodeId, itemId, refs);
            }
        }
    }
}

function findRefsInFunctions(functions, nodeId, itemId, refs) {
    for (const fn of functions || []) {
        if (!fn) continue;
        if (fn.type === 'PickUpItemFunction' && fn.item === itemId) {
            refs.push({ nodeId, type: 'pickup function' });
        }
        if (fn.type === 'IfFunction') {
            if (fn.condition?.item === itemId) {
                refs.push({ nodeId, type: `${fn.condition.type || 'if'} condition` });
            }
            findRefsInFunctions(fn.then_functions || [], nodeId, itemId, refs);
            findRefsInFunctions(fn.else_functions || [], nodeId, itemId, refs);
        }
        if (fn.type === 'SolveTaskFunction') {
            findRefsInFunctions(fn.on_success || [], nodeId, itemId, refs);
            findRefsInFunctions(fn.on_failure || [], nodeId, itemId, refs);
        }
    }
}
