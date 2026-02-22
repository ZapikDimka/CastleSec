import { MapProvider } from './state/MapContext';
import { useMapState } from './state/MapContext';
import Toolbar from './shared/Toolbar';
import Canvas from './canvas/Canvas';
import NodeEditor from './panels/NodeEditor';

function AppContent() {
  const state = useMapState();
  const showPanel = state.selectedNodeId !== null;

  return (
    <div className="app">
      <Toolbar />
      <div className="app-body">
        <Canvas />
        {showPanel && (
          <div className="side-panel-container">
            <NodeEditor />
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
