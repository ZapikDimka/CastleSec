import { useState, useEffect } from 'react';
import { MapProvider } from './state/MapContext';
import { useMapState, useMapDispatch } from './state/MapContext';
import { openMapFile, saveMapFile, saveAsMapFile } from './io/fileIO';
import Toolbar from './shared/Toolbar';
import Canvas from './canvas/Canvas';
import NodeEditor from './panels/NodeEditor';
import ItemPanel from './panels/ItemPanel';
import FullscreenModal from './shared/FullscreenModal';

function AppContent() {
  const state = useMapState();
  const dispatch = useMapDispatch();
  const { selectedNodeId, selectedItemId, isDirty } = state;

  const [fullscreenImageUrl, setFullscreenImageUrl] = useState(null);

  // Global Fullscreen opener
  useEffect(() => {
    const handleOpenFullscreen = (e) => setFullscreenImageUrl(e.detail);
    window.addEventListener('openFullscreenImage', handleOpenFullscreen);
    return () => window.removeEventListener('openFullscreenImage', handleOpenFullscreen);
  }, []);

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

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in a text field (unless it's Ctrl+S or Ctrl+Z)
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && e.key === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          saveAsMapFile(state).catch(err => console.error(err));
        } else {
          saveMapFile(state, state.filePath).catch(err => console.error(err));
        }
        return;
      }

      if (cmdOrCtrl && e.key === 'o') {
        e.preventDefault();
        openMapFile().then(res => {
          if (res) dispatch({ type: 'LOAD_MAP', payload: res });
        }).catch(err => console.error(err));
        return;
      }

      if (cmdOrCtrl && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          dispatch({ type: 'REDO' });
        } else {
          dispatch({ type: 'UNDO' });
        }
        return;
      }

      // Ignore other shortcuts when focused on input
      if (isInput) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        dispatch({ type: 'SELECT_NODE', payload: { id: null } });
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Fire custom event that panels can listen to, to trigger their delete confirmations
        const event = new CustomEvent('requestDelete');
        window.dispatchEvent(event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, dispatch]);

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

      {fullscreenImageUrl && (
        <FullscreenModal
          imageUrl={fullscreenImageUrl}
          onClose={() => setFullscreenImageUrl(null)}
        />
      )}
    </div>
  );
}

import { ValidationProvider } from './validation/ValidationContext';

export default function App() {
  return (
    <MapProvider>
      <ValidationProvider>
        <AppContent />
      </ValidationProvider>
    </MapProvider>
  );
}
