import { useState, useEffect, useRef, useCallback } from 'react';
import { MapProvider } from './state/MapContext';
import { useMapState, useMapDispatch } from './state/MapContext';
import { openMapFile, saveMapFile, saveAsMapFile } from './io/fileIO';
import Toolbar from './shared/Toolbar';
import Canvas from './canvas/Canvas';
import NodeEditor from './panels/NodeEditor';
import ItemPanel from './panels/ItemPanel';
import SettingsPanel from './panels/SettingsPanel';
import FullscreenModal from './shared/FullscreenModal';
import {
  clearFolderFileCache,
  getDefaultAssetBaseDir,
  hydrateAssetFolderFromDirectoryHandle,
  setConfiguredAssetBaseDir,
} from './shared/assetHelper';
import {
  clearMapAssetFolderConfig,
  loadMapAssetFolderConfig,
  saveMapAssetFolderHandle,
  saveMapAssetFolderPath,
} from './io/assetFolderConfig';

function AppContent() {
  const state = useMapState();
  const dispatch = useMapDispatch();
  const { selectedNodeId, selectedItemId, isDirty } = state;
  const appBodyRef = useRef(null);

  const [fullscreenImageUrl, setFullscreenImageUrl] = useState(null);
  const [assetFolderSummary, setAssetFolderSummary] = useState(`Using default assets folder: ${getDefaultAssetBaseDir()}`);
  const [isApplyingAssetFolder, setIsApplyingAssetFolder] = useState(false);

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
  const PANEL_DEFAULT_WIDTH = 320;
  const PANEL_MIN_WIDTH = 240;
  const PANEL_MAX_WIDTH = 720;

  const clampPanelWidth = useCallback((value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return PANEL_DEFAULT_WIDTH;

    const bodyRect = appBodyRef.current?.getBoundingClientRect();
    const dynamicMax = bodyRect
      ? Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, Math.round(bodyRect.width * 0.7)))
      : PANEL_MAX_WIDTH;

    return Math.max(PANEL_MIN_WIDTH, Math.min(dynamicMax, Math.round(numeric)));
  }, []);

  const persistedPanelWidth = clampPanelWidth(state?._extraTopLevel?._editor?.sidePanelWidth);
  const [panelWidth, setPanelWidth] = useState(persistedPanelWidth);
  const panelWidthRef = useRef(persistedPanelWidth);

  useEffect(() => {
    setPanelWidth(persistedPanelWidth);
    panelWidthRef.current = persistedPanelWidth;
  }, [persistedPanelWidth]);

  useEffect(() => {
    panelWidthRef.current = panelWidth;
  }, [panelWidth]);

  useEffect(() => {
    const handleResize = () => {
      setPanelWidth((prev) => clampPanelWidth(prev));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPanelWidth]);

  // Auto-switch tab when user selects a node/item from canvas/panel actions.
  useEffect(() => {
    if (selectedNodeId) {
      setActiveTab('nodes');
    }
  }, [selectedNodeId]);

  useEffect(() => {
    if (selectedItemId) {
      setActiveTab('items');
    }
  }, [selectedItemId]);

  const effectiveTab = activeTab;

  const showPanel = selectedNodeId !== null || selectedItemId !== null || activeTab === 'items' || activeTab === 'settings';

  const applyMapAssetFolderConfig = useCallback(async (mapFileKey) => {
    setIsApplyingAssetFolder(true);
    try {
      clearFolderFileCache();

      if (!mapFileKey) {
        setConfiguredAssetBaseDir(null);
        setAssetFolderSummary(`Using default assets folder: ${getDefaultAssetBaseDir()}`);
        return;
      }

      const config = await loadMapAssetFolderConfig(mapFileKey);

      if (config?.mode === 'handle' && config.handle) {
        if (typeof config.handle.requestPermission === 'function') {
          const readPermission = await config.handle.requestPermission({ mode: 'read' });
          if (readPermission !== 'granted') {
            setConfiguredAssetBaseDir(null);
            setAssetFolderSummary(`Folder permission denied for "${mapFileKey}". Using default assets folder: ${getDefaultAssetBaseDir()}`);
            return;
          }
        }

        await hydrateAssetFolderFromDirectoryHandle(config.handle);
        setConfiguredAssetBaseDir(null);
        setAssetFolderSummary(`Using selected folder for "${mapFileKey}": ${config.label || config.handle.name}`);
        return;
      }

      if (config?.mode === 'path' && config.path) {
        setConfiguredAssetBaseDir(config.path);
        setAssetFolderSummary(`Using custom assets folder for "${mapFileKey}": ${config.path}`);
        return;
      }

      setConfiguredAssetBaseDir(null);
      setAssetFolderSummary(`Using default assets folder: ${getDefaultAssetBaseDir()}`);
    } catch (error) {
      console.error('Failed to apply asset-folder config:', error);
      clearFolderFileCache();
      setConfiguredAssetBaseDir(null);
      setAssetFolderSummary(`Using default assets folder: ${getDefaultAssetBaseDir()}`);
    } finally {
      setIsApplyingAssetFolder(false);
    }
  }, []);

  useEffect(() => {
    applyMapAssetFolderConfig(state.filePath);
  }, [state.filePath, applyMapAssetFolderConfig]);

  const handlePickAssetFolderHandle = useCallback(async (handle) => {
    if (!state.filePath || !handle) return;
    setIsApplyingAssetFolder(true);
    try {
      if (typeof handle.requestPermission === 'function') {
        const readPermission = await handle.requestPermission({ mode: 'read' });
        if (readPermission !== 'granted') {
          setAssetFolderSummary(`Folder permission denied for "${state.filePath}".`);
          return;
        }
      }
      await saveMapAssetFolderHandle(state.filePath, handle);
      clearFolderFileCache();
      await hydrateAssetFolderFromDirectoryHandle(handle);
      setConfiguredAssetBaseDir(null);
      setAssetFolderSummary(`Using selected folder for "${state.filePath}": ${handle.name || 'Selected folder'}`);
    } catch (error) {
      console.error('Failed to persist folder handle:', error);
      setAssetFolderSummary(`Failed to set folder for "${state.filePath}". Using default assets folder.`);
      setConfiguredAssetBaseDir(null);
    } finally {
      setIsApplyingAssetFolder(false);
    }
  }, [state.filePath]);

  const handlePickAssetFolderPath = useCallback(async (path) => {
    if (!state.filePath || !path) return;
    setIsApplyingAssetFolder(true);
    try {
      await saveMapAssetFolderPath(state.filePath, path);
      clearFolderFileCache();
      setConfiguredAssetBaseDir(path);
      setAssetFolderSummary(`Using custom assets folder for "${state.filePath}": ${path}`);
    } catch (error) {
      console.error('Failed to persist folder path:', error);
      setAssetFolderSummary(`Failed to set folder for "${state.filePath}". Using default assets folder.`);
      setConfiguredAssetBaseDir(null);
    } finally {
      setIsApplyingAssetFolder(false);
    }
  }, [state.filePath]);

  const handleClearAssetFolder = useCallback(async () => {
    if (!state.filePath) return;
    setIsApplyingAssetFolder(true);
    try {
      await clearMapAssetFolderConfig(state.filePath);
      clearFolderFileCache();
      setConfiguredAssetBaseDir(null);
      setAssetFolderSummary(`Using default assets folder: ${getDefaultAssetBaseDir()}`);
    } catch (error) {
      console.error('Failed to clear asset-folder config:', error);
      setAssetFolderSummary(`Using default assets folder: ${getDefaultAssetBaseDir()}`);
    } finally {
      setIsApplyingAssetFolder(false);
    }
  }, [state.filePath]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleResizeStart = useCallback((event) => {
    event.preventDefault();

    const getClientX = (e) => (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX);

    const handleMove = (e) => {
      const bodyRect = appBodyRef.current?.getBoundingClientRect();
      if (!bodyRect) return;
      const clientX = getClientX(e);
      const nextWidth = clampPanelWidth(bodyRect.right - clientX);
      setPanelWidth(nextWidth);
    };

    const handleEnd = () => {
      document.body.classList.remove('is-resizing-panel');
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);

      const nextWidth = clampPanelWidth(panelWidthRef.current);
      if (nextWidth !== persistedPanelWidth) {
        dispatch({
          type: 'SET_EDITOR_CONFIG',
          payload: { sidePanelWidth: nextWidth },
        });
      }
    };

    document.body.classList.add('is-resizing-panel');
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleEnd);
  }, [clampPanelWidth, dispatch, persistedPanelWidth]);

  return (
    <div className="app">
      <Toolbar />
      <div className="app-body" ref={appBodyRef}>
        <Canvas />
        {showPanel && (
          <div className="side-panel-shell" style={{ width: `${panelWidth}px` }}>
            <div
              className="side-panel-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize side panel"
              onMouseDown={handleResizeStart}
              onTouchStart={handleResizeStart}
            />
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
                <button
                  className={`panel-tab ${effectiveTab === 'settings' ? 'panel-tab--active' : ''}`}
                  onClick={() => handleTabChange('settings')}
                >
                  Settings
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
              {effectiveTab === 'settings' && (
                <SettingsPanel
                  filePath={state.filePath}
                  assetFolderSummary={assetFolderSummary}
                  isApplyingAssetFolder={isApplyingAssetFolder}
                  onPickAssetFolderHandle={handlePickAssetFolderHandle}
                  onPickAssetFolderPath={handlePickAssetFolderPath}
                  onClearAssetFolder={handleClearAssetFolder}
                />
              )}
            </div>
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
