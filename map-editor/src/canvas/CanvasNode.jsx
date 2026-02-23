import { useCallback, useRef, useState } from 'react';
import { useMapState, useMapDispatch } from '../state/MapContext';
import { useValidation } from '../validation/ValidationContext';
import { getAssetUrl } from '../shared/assetHelper';
import { useOptimizedImage } from '../shared/useOptimizedImage';

const DRAG_THRESHOLD = 3;

export default function CanvasNode({ nodeId, zoom }) {
    const state = useMapState();
    const dispatch = useMapDispatch();

    const node = state.nodes[nodeId];
    const pos = state.nodePositions[nodeId];
    const isSelected = state.selectedNodeId === nodeId;
    const isRoot = state.root === nodeId;

    const validation = useValidation();
    const nodeIssues = validation.get(nodeId) || [];
    const hasErrors = nodeIssues.some(i => i.severity === 'error');
    const hasWarnings = nodeIssues.some(i => i.severity === 'warning');

    const [isDragging, setIsDragging] = useState(false);

    // Resolve absolute path and then crunch it down
    const absoluteImagePath = getAssetUrl(node?.image);
    const optimizedImageSrc = useOptimizedImage(absoluteImagePath, 128, 128);

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
        } else {
            // Finished dragging — commit position to history
            dispatch({ type: 'COMMIT_NODE_POSITION' });
        }

        dragRef.current.pointerId = null;
        setIsDragging(false);
    }, [nodeId, dispatch]);

    let className = 'canvas-node';
    if (isSelected) className += ' canvas-node--selected';
    if (isRoot) className += ' canvas-node--root';
    if (hasErrors) className += ' canvas-node--error';
    else if (hasWarnings) className += ' canvas-node--warning';
    if (isDragging) className += ' canvas-node--dragging';

    const validationTooltip = nodeIssues.map(i => `[${i.severity.toUpperCase()}] ${i.message}`).join('\n');

    const handleImageClick = (e) => {
        e.stopPropagation(); // prevent node selection/drag
        if (absoluteImagePath) {
            window.dispatchEvent(new CustomEvent('openFullscreenImage', { detail: absoluteImagePath }));
        }
    };

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
            <div className="canvas-node__badges">
                {isRoot && <span className="canvas-node__badge" title="Root node">★</span>}
                {hasErrors && <span className="canvas-node__badge canvas-node__badge--error" title={validationTooltip}>!</span>}
                {!hasErrors && hasWarnings && <span className="canvas-node__badge canvas-node__badge--warning" title={validationTooltip}>!</span>}
            </div>
            {optimizedImageSrc && (
                <div className="canvas-node__image-container" onClick={handleImageClick}>
                    <img src={optimizedImageSrc} className="canvas-node__image" alt="" draggable={false} />
                </div>
            )}
            <span className="canvas-node__name">{node.name || nodeId}</span>
            <span className="canvas-node__id">{nodeId}</span>
        </div>
    );
}
