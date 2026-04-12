const NODE_WIDTH = 120;
const NODE_HEIGHT = 48;
const SELF_LOOP_RADIUS = 35;

export default function Edge({ edge, positions }) {
    const fromPos = positions[edge.from];
    const toPos = positions[edge.to];
    if (!fromPos || !toPos) return null;

    // Node centers
    const x1 = fromPos.x + NODE_WIDTH / 2;
    const y1 = fromPos.y + NODE_HEIGHT / 2;
    const x2 = toPos.x + NODE_WIDTH / 2;
    const y2 = toPos.y + NODE_HEIGHT / 2;

    const markerId = edge.conditional ? 'arrow-conditional' : 'arrow-normal';
    const strokeClass = edge.conditional ? 'edge-path edge-path--conditional' : 'edge-path';

    // Self-referencing edge → loop
    if (edge.from === edge.to) {
        const startY = y1 - NODE_HEIGHT / 2;
        const finalY = startY - 4; // Offset so arrowhead doesn't clip
        const loopPath = `M ${x1 - 15} ${startY}
      C ${x1 - SELF_LOOP_RADIUS} ${startY - SELF_LOOP_RADIUS * 2},
        ${x1 + SELF_LOOP_RADIUS} ${startY - SELF_LOOP_RADIUS * 2},
        ${x1 + 15} ${finalY}`;

        return (
            <g>
                <path
                    d={loopPath}
                    className={strokeClass}
                    markerEnd={`url(#${markerId})`}
                />
            </g>
        );
    }

    // Check for bidirectional offset: apply slight perpendicular offset
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    // Perpendicular unit vector
    const px = -dy / len;
    const py = dx / len;

    // Offset for bidirectional visual separation
    const offset = edge._bidir ? 6 : 0;
    const ox = px * offset;
    const oy = py * offset;

    // Control point offset for a gentle curve
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const curveStrength = edge._bidir ? 30 : 12;
    const cpX = midX + px * curveStrength + ox;
    const cpY = midY + py * curveStrength + oy;

    // We want the arrow to stop at the node boundary, not the center
    const endX = x2 + ox;
    const endY = y2 + oy;
    let vx = endX - cpX;
    let vy = endY - cpY;
    const vLen = Math.hypot(vx, vy) || 1;
    vx /= vLen;
    vy /= vLen;

    // Node bounds + padding for arrowhead
    const rx = NODE_WIDTH / 2 + 6;
    const ry = NODE_HEIGHT / 2 + 6;

    // Distance to edge of bounding box
    const tX = Math.abs(rx / vx);
    const tY = Math.abs(ry / vy);
    const dist = Math.min(tX, tY);

    const finalX = endX - vx * dist;
    const finalY = endY - vy * dist;

    const path = `M ${x1 + ox} ${y1 + oy} Q ${cpX} ${cpY} ${finalX} ${finalY}`;

    // Label position at curve midpoint
    const labelX = 0.25 * (x1 + ox) + 0.5 * cpX + 0.25 * finalX;
    const labelY = 0.25 * (y1 + oy) + 0.5 * cpY + 0.25 * finalY;

    return (
        <g>
            <path
                d={path}
                className={strokeClass}
                markerEnd={`url(#${markerId})`}
            />
            {edge.conditional && edge.conditionSummary && (
                <text
                    x={labelX}
                    y={labelY - 6}
                    className="edge-label"
                >
                    {edge.conditionSummary}
                </text>
            )}
        </g>
    );
}
