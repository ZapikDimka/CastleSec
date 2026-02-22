import { useMemo } from 'react';
import { useMapState } from '../state/MapContext';
import { computeEdges } from '../state/selectors';
import Edge from './Edge';

export default function EdgeLayer({ pan, zoom }) {
    const { nodes, nodePositions } = useMapState();

    const edges = useMemo(() => {
        return computeEdges(nodes);
    }, [nodes]);

    // Mark bidirectional pairs for visual offset
    const markedEdges = useMemo(() => {
        const edgeKeys = new Set(edges.map(e => `${e.from}→${e.to}`));
        return edges.map(edge => ({
            ...edge,
            _bidir: edgeKeys.has(`${edge.to}→${edge.from}`),
        }));
    }, [edges]);

    if (markedEdges.length === 0) return null;

    return (
        <svg className="edge-layer">
            <defs>
                {/* Normal arrowhead */}
                <marker
                    id="arrow-normal"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="8"
                    markerHeight="8"
                    orient="auto-start-reverse"
                >
                    <path d="M 0 1 L 10 5 L 0 9 z" className="edge-arrowhead" />
                </marker>

                {/* Conditional arrowhead */}
                <marker
                    id="arrow-conditional"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="8"
                    markerHeight="8"
                    orient="auto-start-reverse"
                >
                    <path d="M 0 1 L 10 5 L 0 9 z" className="edge-arrowhead--conditional" />
                </marker>
            </defs>

            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {markedEdges.map((edge, i) => (
                    <Edge key={`${edge.from}-${edge.to}-${i}`} edge={edge} positions={nodePositions} />
                ))}
            </g>
        </svg>
    );
}
