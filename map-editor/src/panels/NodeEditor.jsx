import { useState, useCallback, useEffect } from 'react';
import { useMapState, useMapDispatch } from '../state/MapContext';
import { useValidation } from '../validation/ValidationContext';
import ImagePicker from '../shared/ImagePicker';
import ConfirmDialog from '../shared/ConfirmDialog';
import ActionList from '../actions/ActionList';

export default function NodeEditor() {
    const state = useMapState();
    const dispatch = useMapDispatch();
    const { selectedNodeId, root, nodes } = state;

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [idValue, setIdValue] = useState('');

    const node = selectedNodeId ? nodes[selectedNodeId] : null;
    const validation = useValidation();

    if (!node) return null;

    const nodeIssues = validation.get(selectedNodeId) || [];
    const orphanIssue = nodeIssues.find(i => i.id === 'V-09');
    const prefixIssue = nodeIssues.find(i => i.id === 'V-07');

    const isRoot = selectedNodeId === root;

    // Listen for global delete shortcut
    useEffect(() => {
        const handleRequestDelete = () => {
            if (selectedNodeId && !isRoot) {
                setShowDeleteConfirm(true);
            }
        };
        window.addEventListener('requestDelete', handleRequestDelete);
        return () => window.removeEventListener('requestDelete', handleRequestDelete);
    }, [selectedNodeId, isRoot]);

    // ---- Field Handlers ----
    const handleNameChange = (e) => {
        dispatch({
            type: 'UPDATE_NODE',
            payload: { id: selectedNodeId, changes: { name: e.target.value } },
        });
    };

    const handleTextChange = (e) => {
        dispatch({
            type: 'UPDATE_NODE',
            payload: { id: selectedNodeId, changes: { text: e.target.value } },
        });
    };

    const handleImageChange = (imagePath) => {
        dispatch({
            type: 'UPDATE_NODE',
            payload: { id: selectedNodeId, changes: { image: imagePath || null } },
        });
    };

    // ---- Root ----
    const handleSetRoot = () => {
        dispatch({ type: 'SET_ROOT', payload: { id: selectedNodeId } });
    };

    // ---- Delete ----
    const handleDeleteClick = () => {
        if (isRoot) return;
        setShowDeleteConfirm(true);
    };

    const handleDeleteConfirm = () => {
        dispatch({ type: 'DELETE_NODE', payload: { id: selectedNodeId } });
        setShowDeleteConfirm(false);
    };

    // ---- ID Editing ----
    const handleIdEditStart = () => {
        setEditingId(true);
        setIdValue(selectedNodeId);
    };

    const handleIdEditEnd = () => {
        const newId = idValue.trim();
        setEditingId(false);

        if (!newId || newId === selectedNodeId) return;
        if (nodes[newId]) return; // Duplicate

        // Rename node: create new entry, remove old
        dispatch({
            type: 'RENAME_NODE',
            payload: { oldId: selectedNodeId, newId },
        });
    };

    const handleIdKeyDown = (e) => {
        if (e.key === 'Enter') handleIdEditEnd();
        if (e.key === 'Escape') {
            setEditingId(false);
            setIdValue(selectedNodeId);
        }
    };

    // ---- Close ----
    const handleClose = () => {
        dispatch({ type: 'SELECT_NODE', payload: { id: null } });
    };

    return (
        <div className="panel">
            {/* Header */}
            <div className="panel__header">
                <div className="panel__header-row">
                    <span className="panel__header-title">Node Editor</span>
                    <button className="panel__close-btn" onClick={handleClose} title="Close">×</button>
                </div>

                {/* Node ID */}
                <div className="panel__id-row">
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
                            {selectedNodeId}
                        </span>
                    )}
                    {isRoot && <span className="panel__root-badge">★ Root</span>}
                </div>
                {prefixIssue && (
                    <div className="panel__validation-msg panel__validation-msg--warning">
                        ⚠️ {prefixIssue.message}
                    </div>
                )}
            </div>

            {/* Properties */}
            <div className="panel__body">
                {orphanIssue && (
                    <div className="panel__validation-msg panel__validation-msg--warning" style={{ marginBottom: '8px' }}>
                        ⚠️ {orphanIssue.message}
                    </div>
                )}
                <div className="panel__section">
                    <label className="panel__label">Name</label>
                    <input
                        className="panel__input"
                        type="text"
                        value={node.name}
                        onChange={handleNameChange}
                        placeholder="Node name"
                        spellCheck={false}
                    />
                </div>

                <div className="panel__section">
                    <label className="panel__label">Text</label>
                    <textarea
                        className="panel__textarea"
                        value={node.text}
                        onChange={handleTextChange}
                        placeholder="Description text shown in-game..."
                        rows={4}
                    />
                </div>

                <div className="panel__section">
                    <label className="panel__label">Image</label>
                    <ImagePicker
                        value={node.image}
                        onChange={handleImageChange}
                    />
                </div>

                {/* Actions */}
                <div className="panel__section">
                    <label className="panel__label">Actions</label>
                    <ActionList nodeId={selectedNodeId} actions={node.actions} />
                </div>

                {/* Buttons */}
                <div className="panel__actions-row">
                    {!isRoot && (
                        <button className="panel__btn panel__btn--accent" onClick={handleSetRoot}>
                            ★ Set as Root
                        </button>
                    )}
                    <button
                        className="panel__btn panel__btn--danger"
                        onClick={handleDeleteClick}
                        disabled={isRoot}
                        title={isRoot ? 'Cannot delete root node' : 'Delete this node'}
                    >
                        🗑 Delete
                    </button>
                </div>
            </div>

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <ConfirmDialog
                    title="Delete Node"
                    message={`Delete "${node.name}" (${selectedNodeId})? All actions referencing this node will also be removed.`}
                    confirmLabel="Delete"
                    danger
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => setShowDeleteConfirm(false)}
                />
            )}
        </div>
    );
}
