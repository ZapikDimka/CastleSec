import { useState } from 'react';
import { useMapState, useMapDispatch } from '../state/MapContext';
import { useValidation } from '../validation/ValidationContext';
import { openMapFile, saveMapFile, saveAsMapFile, clearCurrentFileHandle } from '../io/fileIO';
import ConfirmDialog from '../shared/ConfirmDialog';

export default function Toolbar() {
    const state = useMapState();
    const dispatch = useMapDispatch();
    const validation = useValidation();

    const nodeCount = Object.keys(state.nodes).length;
    const itemCount = Object.keys(state.items).length;
    const mapOrder = state.mapOrder || [];
    const mapsById = state.mapsById || {};
    const selectedMapId = state.selectedMapId;
    const topRootMapId = state.topRootMapId;
    const canUndo = state.history?.past?.length > 0;
    const canRedo = state.history?.future?.length > 0;

    const [pendingAction, setPendingAction] = useState(null);
    const [pendingValidationSave, setPendingValidationSave] = useState(null);

    // Calculate validation counts
    let errorCount = 0;
    let warningCount = 0;
    for (const issues of validation.values()) {
        for (const issue of issues) {
            if (issue.severity === 'error') errorCount++;
            if (issue.severity === 'warning') warningCount++;
        }
    }

    const hasErrors = errorCount > 0;
    const hasWarnings = warningCount > 0;

    let validationStatusStr = '✓ No issues';
    let dotColor = 'var(--success)';
    if (hasErrors) {
        dotColor = 'var(--danger)';
        validationStatusStr = `${errorCount} error${errorCount !== 1 ? 's' : ''}`;
        if (warningCount > 0) validationStatusStr += `, ${warningCount} warning${warningCount !== 1 ? 's' : ''}`;
    } else if (hasWarnings) {
        dotColor = 'var(--warning)';
        validationStatusStr = `${warningCount} warning${warningCount !== 1 ? 's' : ''}`;
    }

    const handleAddNode = () => {
        window.__mapEditorAddNode?.();
    };

    const handleMapChange = (e) => {
        const id = e.target.value;
        dispatch({ type: 'SELECT_MAP', payload: { id } });
    };

    const handleAddMap = () => {
        dispatch({ type: 'ADD_MAP', payload: {} });
    };

    const handleTopRootMapChange = (e) => {
        const id = e.target.value;
        dispatch({ type: 'SET_TOP_ROOT_MAP', payload: { id } });
    };

    const runAction = (actionStr) => {
        if (state.isDirty && (actionStr === 'NEW' || actionStr === 'OPEN')) {
            setPendingAction(actionStr);
        } else if (actionStr === 'SAVE' || actionStr === 'SAVE_AS') {
            if (hasErrors) return; // handled by disabled button
            if (hasWarnings) {
                setPendingValidationSave(actionStr);
                return;
            }
            executeAction(actionStr);
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

    const handleConfirmValidationSave = () => {
        const actionToRun = pendingValidationSave;
        setPendingValidationSave(null);
        if (actionToRun) executeAction(actionToRun);
    };

    const saveTooltip = hasErrors ? "Cannot save: validation errors present" : "Save map";
    const saveAsTooltip = hasErrors ? "Cannot save: validation errors present" : "Save map as new file";

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
                <button
                    className="toolbar-btn"
                    onClick={() => dispatch({ type: 'UNDO' })}
                    title="Undo (Cmd/Ctrl+Z)"
                    disabled={!canUndo}
                >
                    ↶ Undo
                </button>
                <button
                    className="toolbar-btn"
                    onClick={() => dispatch({ type: 'REDO' })}
                    title="Redo (Cmd/Ctrl+Shift+Z)"
                    disabled={!canRedo}
                >
                    ↷ Redo
                </button>
            </div>

            <div className="toolbar-separator" />

            <div className="toolbar-group">
                <button className="toolbar-btn" onClick={() => runAction('NEW')} title="New map">
                    📄 New
                </button>
                <button className="toolbar-btn" onClick={() => runAction('OPEN')} title="Open map">
                    📂 Open
                </button>
                <button
                    className="toolbar-btn"
                    onClick={() => runAction('SAVE')}
                    title={saveTooltip}
                    disabled={hasErrors}
                >
                    💾 Save
                </button>
                <button
                    className="toolbar-btn"
                    onClick={() => runAction('SAVE_AS')}
                    title={saveAsTooltip}
                    disabled={hasErrors}
                >
                    💾 Save As...
                </button>
            </div>

            <div className="toolbar-separator" />

            <div className="toolbar-group">
                <label className="toolbar-inline-label" htmlFor="map-select">Map</label>
                <select
                    id="map-select"
                    className="toolbar-select"
                    value={selectedMapId || ''}
                    onChange={handleMapChange}
                    aria-label="Active map"
                >
                    {mapOrder.map((id) => (
                        <option key={id} value={id}>
                            {id}
                        </option>
                    ))}
                </select>
                <button className="toolbar-btn" onClick={handleAddMap} title="Add map">
                    ＋ Map
                </button>
            </div>

            <div className="toolbar-group">
                <label className="toolbar-inline-label" htmlFor="map-root-select">Entry</label>
                <select
                    id="map-root-select"
                    className="toolbar-select"
                    value={topRootMapId || selectedMapId || ''}
                    onChange={handleTopRootMapChange}
                    aria-label="Top-level root map"
                >
                    {mapOrder.map((id) => (
                        <option key={id} value={id}>
                            {id}
                        </option>
                    ))}
                </select>
            </div>

            <div className="toolbar-separator" />

            <div className="toolbar-group">
                <button className="toolbar-btn" onClick={handleAddNode} title="Add node at viewport center">
                    ＋ Add Node
                </button>
            </div>

            <div className="toolbar-spacer" />

            <div className="toolbar-status" style={{ marginRight: '16px' }} title="Validation status">
                <span className="toolbar-status-dot" style={{ backgroundColor: dotColor }} />
                <span>{validationStatusStr}</span>
            </div>

            <div className="toolbar-separator" />

            <div className="toolbar-status" style={{ marginLeft: '16px' }}>
                {mapOrder.length} map{mapOrder.length !== 1 ? 's' : ''} · {nodeCount} node{nodeCount !== 1 ? 's' : ''} · {itemCount} item{itemCount !== 1 ? 's' : ''}
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

            {pendingValidationSave && (
                <ConfirmDialog
                    title="Validation Warnings"
                    message={`There ${warningCount === 1 ? 'is 1 warning' : `are ${warningCount} warnings`} in your map. Are you sure you want to save?`}
                    confirmLabel="Save Anyway"
                    onConfirm={handleConfirmValidationSave}
                    onCancel={() => setPendingValidationSave(null)}
                />
            )}
        </div>
    );
}
