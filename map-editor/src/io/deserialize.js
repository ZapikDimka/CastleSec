/**
 * Converts loaded JSON strings back into the editor's state shape.
 * Loads coordinates from game JSON `nodePositions` when present.
 * Falls back to legacy sidecar positions or auto-layout for missing positions.
 */
export function deserialize(gameJsonString, editorJsonString) {
    let gameData;
    try {
        gameData = JSON.parse(gameJsonString);
    } catch (e) {
        throw new Error('Failed to parse map JSON: ' + e.message);
    }

    let editorData = null;
    if (editorJsonString) {
        try {
            editorData = JSON.parse(editorJsonString);
        } catch (e) {
            console.warn('Failed to parse editor sidecar JSON, falling back to auto-layout.', e);
        }
    }

    // 1. Extract known keys vs unknown top-level
    const { items, root, nodes, nodePositions: embeddedNodePositions, ..._extraTopLevel } = gameData;

    // Validate minimal structure
    if (!nodes || typeof nodes !== 'object' || !root) {
        throw new Error('Invalid map JSON: missing "nodes" object or "root" string.');
    }

    // 2. Parse Items
    const parsedItems = {};
    for (const [itemId, item] of Object.entries(items || {})) {
        parsedItems[itemId] = { ...item };
    }

    // 3. Parse Nodes & Actions
    const parsedNodes = {};
    const KNOWN_ACTION_TYPES = ['return', 'move', 'pickup', 'solve_task', 'if'];
    const KNOWN_CONDITION_TYPES = ['has_item'];

    for (const [nodeId, node] of Object.entries(nodes)) {
        const parsedNode = { ...node };

        // Ensure actions exist and map them to flag unknown types
        if (Array.isArray(parsedNode.actions)) {
            parsedNode.actions = parsedNode.actions.map(action => {
                const a = { ...action };

                if (!KNOWN_ACTION_TYPES.includes(a.type)) {
                    a._unknown = true;
                }

                if (a.type === 'if' && a.condition) {
                    a.condition = { ...a.condition };
                    if (!KNOWN_CONDITION_TYPES.includes(a.condition.type)) {
                        a.condition._unknown = true;
                    }
                }
                return a;
            });
        } else {
            parsedNode.actions = [];
        }

        parsedNodes[nodeId] = parsedNode;
    }

    // 4. Resolve Positions
    const fallbackPositions = autoLayout(root, parsedNodes);
    const embeddedResolved = sanitizeNodePositions(embeddedNodePositions, parsedNodes);
    const sidecarResolved = sanitizeNodePositions(editorData?.nodePositions, parsedNodes);
    const basePositions = Object.keys(embeddedResolved).length > 0 ? embeddedResolved : sidecarResolved;
    const nodePositions = mergeMissingPositions(basePositions, fallbackPositions, parsedNodes);

    return {
        items: parsedItems,
        root,
        nodes: parsedNodes,
        nodePositions,
        _extraTopLevel
    };
}

function sanitizeNodePositions(rawPositions, nodes) {
    if (!rawPositions || typeof rawPositions !== 'object') {
        return {};
    }

    const cleaned = {};
    for (const nodeId of Object.keys(nodes)) {
        const pos = rawPositions[nodeId];
        if (!pos || typeof pos !== 'object') continue;
        const x = Number(pos.x);
        const y = Number(pos.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        cleaned[nodeId] = { x: Math.round(x), y: Math.round(y) };
    }

    return cleaned;
}

function mergeMissingPositions(basePositions, fallbackPositions, nodes) {
    const merged = {};
    for (const nodeId of Object.keys(nodes)) {
        merged[nodeId] = basePositions[nodeId] || fallbackPositions[nodeId] || { x: 0, y: 0 };
    }
    return merged;
}

/**
 * 7.3 Auto-Layout algorithm
 * BFS tree layout following 'move' edges, placing nodes left-to-right, top-to-bottom.
 */
function autoLayout(rootId, nodes) {
    const positions = {};
    const visited = new Set();
    const HORIZONTAL_SPACING = 250;
    const VERTICAL_SPACING = 150;

    // Queue format: { id, depth }
    let queue = [{ id: rootId, depth: 0 }];
    visited.add(rootId);

    // Track how many nodes placed at each depth level to stagger them horizontally
    const depthCounts = {};

    while (queue.length > 0) {
        const { id, depth } = queue.shift();

        depthCounts[depth] = (depthCounts[depth] || 0);

        // Calculate position
        const x = depthCounts[depth] * HORIZONTAL_SPACING;
        const y = depth * VERTICAL_SPACING;
        positions[id] = { x, y };

        depthCounts[depth]++;

        const node = nodes[id];
        if (!node || !node.actions) continue;

        // Find outgoing move edges
        for (const action of node.actions) {
            let targetId = null;
            if (action.type === 'move') {
                targetId = action.to;
            } else if (action.type === 'if' && action.action?.type === 'move') {
                targetId = action.action.to;
            }

            if (targetId && nodes[targetId] && !visited.has(targetId)) {
                visited.add(targetId);
                queue.push({ id: targetId, depth: depth + 1 });
            }
        }
    }

    // Handle disconnected / orphan nodes
    let orphanX = 0;
    const orphanY = (Object.keys(depthCounts).length + 1) * VERTICAL_SPACING;

    for (const nodeId of Object.keys(nodes)) {
        if (!visited.has(nodeId)) {
            positions[nodeId] = { x: orphanX * HORIZONTAL_SPACING, y: orphanY };
            orphanX++;
        }
    }

    return positions;
}
