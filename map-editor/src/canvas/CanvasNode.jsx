import { useCallback, useRef, useState } from 'react';
import { useMapState, useMapDispatch } from '../state/MapContext';

const DRAG_THRESHOLD = 3;

export default function CanvasNode({ nodeId, zoom }) {
    const state = useMapState();
    const dispatch = useMapDispatch();

    const node = state.nodes[nodeId];
    const pos = state.nodePositions[nodeId];
    const isSelected = state.selectedNodeId === nodeId;
    const isRoot = state.root === nodeId;

    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef({
        startX: 0, startY: 0,
        startPosX: 0, startPosY: 0,
        moved: false,
        pointerId: null,
    });
    const nodeRef = useRef(null);

    if (!node || !pos) return null;

    const handlePointerDown = useCallback((e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();

        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startPosX: pos.x,
            startPosY: pos.y,
            moved: false,
            pointerId: e.pointerId,
        };

        nodeRef.current?.setPointerCapture(e.pointerId);
    }, [pos]);

    const handlePointerMove = useCallback((e) => {
        if (dragRef.current.pointerId === null) return;

        const dx = (e.clientX - dragRef.current.startX) / zoom;
        const dy = (e.clientY - dragRef.current.startY) / zoom;

        if (!dragRef.current.moved) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < DRAG_THRESHOLD / zoom) return;
            dragRef.current.moved = true;
            setIsDragging(true);
        }

        dispatch({
            type: 'MOVE_NODE_POSITION',
            payload: {
                id: nodeId,
                x: dragRef.current.startPosX + dx,
                y: dragRef.current.startPosY + dy,
            },
        });
    }, [nodeId, zoom, dispatch]);

    const handlePointerUp = useCallback((e) => {
        if (dragRef.current.pointerId === null) return;

        nodeRef.current?.releasePointerCapture(dragRef.current.pointerId);

        if (!dragRef.current.moved) {
            // Click — select node
            dispatch({ type: 'SELECT_NODE', payload: { id: nodeId } });
        }

        dragRef.current.pointerId = null;
        setIsDragging(false);
    }, [nodeId, dispatch]);

    let className = 'canvas-node';
    if (isSelected) className += ' canvas-node--selected';
    if (isRoot) className += ' canvas-node--root';
    if (isDragging) className += ' canvas-node--dragging';

    return (
        <div
            ref={nodeRef}
            className={className}
            style={{
                transform: `translate(${pos.x}px, ${pos.y}px)`,
                zIndex: isDragging ? 1000 : isSelected ? 500 : 1,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {isRoot && <span className="canvas-node__badge" title="Root node">★</span>}
            <span className="canvas-node__name">{node.name || nodeId}</span>
            <span className="canvas-node__id">{nodeId}</span>
        </div>
    );
}
