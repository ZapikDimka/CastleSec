import { MapProvider } from './state/MapContext';
import Toolbar from './shared/Toolbar';
import Canvas from './canvas/Canvas';

export default function App() {
  return (
    <MapProvider>
      <div className="app">
        <Toolbar />
        <div className="app-body">
          <Canvas />
        </div>
      </div>
    </MapProvider>
  );
}
