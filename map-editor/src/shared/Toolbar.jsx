import { useState } from 'react';
import { useMapState, useMapDispatch } from '../state/MapContext';
import { openMapFile, saveMapFile, saveAsMapFile, clearCurrentFileHandle } from '../io/fileIO';
import ConfirmDialog from '../shared/ConfirmDialog';

export default function Toolbar() {
    const state = useMapState();
    const dispatch = useMapDispatch();

    const nodeCount = Object.keys(state.nodes).length;
    const itemCount = Object.keys(state.items).length;

    const [pendingAction, setPendingAction] = useState(null);

    const handleAddNode = () => {
        window.__mapEditorAddNode?.();
    };

    const runAction = (actionStr) => {
        if (state.isDirty && (actionStr === 'NEW' || actionStr === 'OPEN')) {
            setPendingAction(actionStr);
        } else {
            executeAction(actionStr);
        }
    };

    const executeAction = async (actionStr) => {
        try {
            switch (actionStr) {
                case 'NEW':
                    clearCurrentFileHandle();
                    dispatch({ type: 'NEW_MAP' });
                    break;
                case 'OPEN': {
                    const result = await openMapFile();
                    if (result) {
                        dispatch({ type: 'LOAD_MAP', payload: result });
                    }
                    break;
                }
                case 'SAVE': {
                    const result = await saveMapFile(state, state.filePath);
                    if (result) {
                        dispatch({ type: 'MARK_SAVED', payload: { filename: result.filename } });
                    }
                    break;
                }
                case 'SAVE_AS': {
                    const result = await saveAsMapFile(state);
                    if (result) {
                        dispatch({ type: 'MARK_SAVED', payload: { filename: result.filename } });
                    }
                    break;
                }
            }
        } catch (e) {
            console.error('File operation failed', e);
            alert('File operation failed: ' + e.message);
        }
    };

    const handleConfirmDiscard = () => {
        const actionToRun = pendingAction;
        setPendingAction(null);
        if (actionToRun) executeAction(actionToRun);
    };

    return (
        <div className="toolbar">
            <div className="toolbar-title">
                <span>⚔</span> CastleSec Map Editor
            </div>

            <div className="toolbar-filename">
                {state.filePath || 'Untitled Map'}
                {state.isDirty && <span className="toolbar-dirty-dot" title="Unsaved changes">●</span>}
            </div>

            <div className="toolbar-separator" />

            <div className="toolbar-group">
                <button className="toolbar-btn" onClick={() => runAction('NEW')} title="New map">
                    📄 New
                </button>
                <button className="toolbar-btn" onClick={() => runAction('OPEN')} title="Open map">
                    📂 Open
                </button>
                <button className="toolbar-btn" onClick={() => runAction('SAVE')} title="Save map">
                    💾 Save
                </button>
                <button className="toolbar-btn" onClick={() => runAction('SAVE_AS')} title="Save map as new file">
                    💾 Save As...
                </button>
            </div>

            <div className="toolbar-separator" />

            <div className="toolbar-group">
                <button className="toolbar-btn" onClick={handleAddNode} title="Add node at viewport center">
                    ＋ Add Node
                </button>
            </div>

            <div className="toolbar-spacer" />

            <div className="toolbar-status">
                <span className="toolbar-status-dot" />
                {nodeCount} node{nodeCount !== 1 ? 's' : ''} · {itemCount} item{itemCount !== 1 ? 's' : ''}
            </div>

            {pendingAction && (
                <ConfirmDialog
                    title="Unsaved Changes"
                    message="You have unsaved changes. Are you sure you want to discard them and proceed?"
                    confirmLabel="Discard & Proceed"
                    danger
                    onConfirm={handleConfirmDiscard}
                    onCancel={() => setPendingAction(null)}
                />
            )}
        </div>
    );
}
