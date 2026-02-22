import { useMapState } from '../state/MapContext';

export default function Toolbar() {
    const state = useMapState();
    const nodeCount = Object.keys(state.nodes).length;

    const handleAddNode = () => {
        window.__mapEditorAddNode?.();
    };

    return (
        <div className="toolbar">
            <div className="toolbar-title">
                <span>⚔</span> CastleSec Map Editor
            </div>

            <div className="toolbar-separator" />

            <div className="toolbar-group">
                <button className="toolbar-btn" disabled title="New map (Ctrl+N)">
                    📄 New
                </button>
                <button className="toolbar-btn" disabled title="Open map (Ctrl+O)">
                    📂 Open
                </button>
                <button className="toolbar-btn" disabled title="Save map (Ctrl+S)">
                    💾 Save
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
                {nodeCount} node{nodeCount !== 1 ? 's' : ''}
            </div>
        </div>
    );
}
