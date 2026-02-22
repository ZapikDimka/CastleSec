import { useState, useEffect } from 'react';
import { MapProvider } from './state/MapContext';
import { useMapState, useMapDispatch } from './state/MapContext';
import Toolbar from './shared/Toolbar';
import Canvas from './canvas/Canvas';
import NodeEditor from './panels/NodeEditor';
import ItemPanel from './panels/ItemPanel';

function AppContent() {
  const state = useMapState();
  const dispatch = useMapDispatch();
  const { selectedNodeId, selectedItemId, isDirty } = state;

  // Unsaved changes beforeunload safeguard
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome/Edge
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Track which tab the user explicitly picked
  const [activeTab, setActiveTab] = useState('nodes');

  // Auto-switch tab based on selection
  const effectiveTab =
    selectedNodeId ? 'nodes' :
      selectedItemId ? 'items' :
        activeTab;

  const showPanel = selectedNodeId !== null || selectedItemId !== null || activeTab === 'items';

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'nodes' && selectedItemId) {
      dispatch({ type: 'SELECT_ITEM', payload: { id: null } });
    }
    if (tab === 'items' && selectedNodeId) {
      dispatch({ type: 'SELECT_NODE', payload: { id: null } });
    }
  };

  return (
    <div className="app">
      <Toolbar />
      <div className="app-body">
        <Canvas />
        {showPanel && (
          <div className="side-panel-container">
            {/* Tab Bar */}
            <div className="panel-tabs">
              <button
                className={`panel-tab ${effectiveTab === 'nodes' ? 'panel-tab--active' : ''}`}
                onClick={() => handleTabChange('nodes')}
              >
                Nodes
              </button>
              <button
                className={`panel-tab ${effectiveTab === 'items' ? 'panel-tab--active' : ''}`}
                onClick={() => handleTabChange('items')}
              >
                Items
              </button>
            </div>

            {/* Panel Content */}
            {effectiveTab === 'nodes' && selectedNodeId && <NodeEditor />}
            {effectiveTab === 'nodes' && !selectedNodeId && (
              <div className="panel">
                <div className="panel__body">
                  <div className="panel__placeholder">Select a node on the canvas to edit it</div>
                </div>
              </div>
            )}
            {effectiveTab === 'items' && <ItemPanel />}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <MapProvider>
      <AppContent />
    </MapProvider>
  );
}
