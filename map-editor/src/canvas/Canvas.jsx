import { useState, useCallback, useRef } from 'react';
import { useMapState, useMapDispatch } from '../state/MapContext';
import CanvasNode from './CanvasNode';
import EdgeLayer from './EdgeLayer';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3.0;
const ZOOM_SENSITIVITY = 0.001;

export default function Canvas() {
    const state = useMapState();
    const dispatch = useMapDispatch();

    const containerRef = useRef(null);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

    // ---- Context Menu ----
    const [contextMenu, setContextMenu] = useState(null);

    // ---- Pan ----
    const handlePointerDown = useCallback((e) => {
        if (e.button === 1 || (e.button === 0 && e.target === containerRef.current)) {
            e.preventDefault();
            setIsPanning(true);
            setContextMenu(null);
            panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
            containerRef.current?.setPointerCapture(e.pointerId);
        }
    }, [pan]);

    const handlePointerMove = useCallback((e) => {
        if (!isPanning) return;
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
    }, [isPanning]);

    const handlePointerUp = useCallback((e) => {
        if (isPanning) {
            setIsPanning(false);
            containerRef.current?.releasePointerCapture(e.pointerId);
        }
    }, [isPanning]);

    // ---- Click on empty canvas = deselect ----
    const handleClick = useCallback((e) => {
        if (e.target === containerRef.current) {
            dispatch({ type: 'SELECT_NODE', payload: { id: null } });
            setContextMenu(null);
        }
    }, [dispatch]);

    // ---- Zoom ----
    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        const canvasX = (cursorX - pan.x) / zoom;
        const canvasY = (cursorY - pan.y) / zoom;

        const delta = -e.deltaY * ZOOM_SENSITIVITY;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * (1 + delta)));

        const newPanX = cursorX - canvasX * newZoom;
        const newPanY = cursorY - canvasY * newZoom;

        setZoom(newZoom);
        setPan({ x: newPanX, y: newPanY });
    }, [pan, zoom]);

    // ---- Context Menu ----
    const handleContextMenu = useCallback((e) => {
        e.preventDefault();
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();

        // Screen position for the menu
        const menuX = e.clientX - rect.left;
        const menuY = e.clientY - rect.top;

        // Canvas-space position for the new node
        const canvasX = (e.clientX - rect.left - pan.x) / zoom;
        const canvasY = (e.clientY - rect.top - pan.y) / zoom;

        setContextMenu({ menuX, menuY, canvasX, canvasY });
    }, [pan, zoom]);

    const handleAddNodeHere = useCallback(() => {
        if (!contextMenu) return;
        dispatch({
            type: 'ADD_NODE',
            payload: { x: contextMenu.canvasX, y: contextMenu.canvasY },
        });
        setContextMenu(null);
    }, [contextMenu, dispatch]);

    // ---- Public method for toolbar to add node at viewport center ----
    const addNodeAtCenter = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const canvasX = (rect.width / 2 - pan.x) / zoom;
        const canvasY = (rect.height / 2 - pan.y) / zoom;
        dispatch({ type: 'ADD_NODE', payload: { x: canvasX, y: canvasY } });
    }, [pan, zoom, dispatch]);

    // Expose addNodeAtCenter via a data attribute + custom event (simple approach)
    // We'll use a ref-forwarding pattern instead — store it globally for Toolbar
    if (typeof window !== 'undefined') {
        window.__mapEditorAddNode = addNodeAtCenter;
    }

    const transformStyle = {
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    };

    const gridStyle = {
        backgroundSize: `${40 * zoom}px ${40 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        backgroundImage: `radial-gradient(circle, rgba(255, 255, 255, 0.06) ${Math.max(0.8, zoom * 0.8)}px, transparent ${Math.max(0.8, zoom * 0.8)}px)`,
    };

    const nodeIds = Object.keys(state.nodes);

    return (
        <div
            className="canvas-container"
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClick={handleClick}
            onWheel={handleWheel}
            onContextMenu={handleContextMenu}
            style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
        >
            <div className="canvas-grid" style={gridStyle} />

            {/* Edge SVG overlay — rendered at container level with its own transform */}
            <EdgeLayer pan={pan} zoom={zoom} />

            <div className="canvas-inner" style={transformStyle}>
                <div className="canvas-origin" />
                {nodeIds.map(id => (
                    <CanvasNode key={id} nodeId={id} zoom={zoom} />
                ))}
            </div>

            <div className="zoom-indicator">
                {Math.round(zoom * 100)}%
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="context-menu"
                    style={{ left: contextMenu.menuX, top: contextMenu.menuY }}
                >
                    <button className="context-menu__item" onClick={handleAddNodeHere}>
                        ＋ Add Node Here
                    </button>
                </div>
            )}
        </div>
    );
}
