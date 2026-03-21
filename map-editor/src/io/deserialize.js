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

    // 1. Extract known keys vs unknown top-level (supports both legacy and engine-sync shape)
    const {
        items,
        root,
        nodes,
        maps,
        nodePositions: embeddedNodePositions,
        ...rawExtraTopLevel
    } = gameData;

    const engineSyncMeta = resolveEngineSyncMeta({ root, maps });
    const sourceNodes = resolveNodeSource({ nodes, maps, engineSyncMeta });
    const sourceRootNodeId = resolveRootNodeId({ root, engineSyncMeta });

    if (!sourceNodes || typeof sourceNodes !== 'object' || !sourceRootNodeId) {
        throw new Error('Invalid map JSON: expected either legacy {root,nodes} or engine-sync {root,maps[].nodes[]} structure.');
    }

    // 2. Parse Items (normalized by id)
    const parsedItems = parseItemsToDict(items);

    // 3. Parse Nodes & Actions (normalized by id)
    const parsedNodes = {};

    for (const [nodeId, node] of Object.entries(sourceNodes)) {
        const parsedNode = { ...node, id: nodeId };

        // Ensure actions exist and migrate legacy action rows to action-choice model.
        if (Array.isArray(parsedNode.actions)) {
            parsedNode.actions = parsedNode.actions.map((rawAction) => toActionChoice(rawAction));
        } else {
            parsedNode.actions = [];
        }

        parsedNodes[nodeId] = parsedNode;
    }

    // 4. Resolve Positions
    const fallbackPositions = autoLayout(sourceRootNodeId, parsedNodes);
    const embeddedResolved = sanitizeNodePositions(embeddedNodePositions, parsedNodes);
    const sidecarResolved = sanitizeNodePositions(editorData?.nodePositions, parsedNodes);
    const basePositions = Object.keys(embeddedResolved).length > 0 ? embeddedResolved : sidecarResolved;
    const nodePositions = mergeMissingPositions(basePositions, fallbackPositions, parsedNodes);

    const _extraTopLevel = {
        ...rawExtraTopLevel,
        ...(engineSyncMeta ? { _engineSync: engineSyncMeta } : {}),
    };

    return {
        items: parsedItems,
        root: sourceRootNodeId,
        nodes: parsedNodes,
        nodePositions,
        _extraTopLevel
    };
}

function parseItemsToDict(rawItems) {
    const parsedItems = {};

    // New shape: items[]
    if (Array.isArray(rawItems)) {
        for (const rawItem of rawItems) {
            if (!rawItem || typeof rawItem !== 'object' || !rawItem.id) continue;
            const { id, ...itemFields } = rawItem;
            parsedItems[id] = { id, ...itemFields };
        }
        return parsedItems;
    }

    // Legacy shape: items{}
    if (rawItems && typeof rawItems === 'object') {
        for (const [itemId, item] of Object.entries(rawItems)) {
            parsedItems[itemId] = { id: itemId, ...item };
        }
    }

    return parsedItems;
}

function toActionChoice(rawAction) {
    if (!rawAction || typeof rawAction !== 'object') {
        return { label: 'Action', once: false, functions: [] };
    }

    // Already in action-choice shape.
    if (typeof rawAction.label === 'string' && Array.isArray(rawAction.functions)) {
        return {
            ...rawAction,
            once: Boolean(rawAction.once),
            functions: rawAction.functions.map((fn) => toKnownOrUnknownFunction(fn)),
        };
    }

    const fn = legacyActionToFunction(rawAction);
    return {
        label: legacyActionToLabel(rawAction),
        once: false,
        functions: fn ? [toKnownOrUnknownFunction(fn)] : [],
    };
}

function toKnownOrUnknownFunction(rawFunction) {
    const fn = { ...(rawFunction || {}) };
    const known = [
        'MoveFunction',
        'PickUpItemFunction',
        'SolveTaskFunction',
        'SetVariableFunction',
        'IfFunction',
        'ShowHintTextFunction',
        'InspectFunction',
    ];

    if (fn.type && !known.includes(fn.type)) {
        fn._unknown = true;
    }

    if (fn.type === 'IfFunction' && fn.condition && typeof fn.condition === 'object') {
        const knownConditions = ['has_item', 'item_used', 'item_not_collected'];
        if (fn.condition.type && !knownConditions.includes(fn.condition.type)) {
            fn.condition = { ...fn.condition, _unknown: true };
        }
    }

    return fn;
}

function legacyActionToLabel(action) {
    switch (action.type) {
        case 'move':
            return action.to ? `Move to ${action.to}` : 'Move';
        case 'pickup':
            return action.item ? `Pick up ${action.item}` : 'Pick up item';
        case 'solve_task':
            return action.name ? `Solve: ${action.name}` : 'Solve task';
        case 'if':
            return 'Conditional action';
        case 'return':
            return 'Return (set destination)';
        default:
            return action.type ? `Legacy: ${action.type}` : 'Action';
    }
}

function legacyActionToFunction(action) {
    switch (action.type) {
        case 'move':
            return { type: 'MoveFunction', to: action.to || '' };
        case 'pickup':
            return { type: 'PickUpItemFunction', item: action.item || '' };
        case 'solve_task':
            return {
                type: 'SolveTaskFunction',
                task: action.name || '',
                on_success: [],
                on_failure: [],
            };
        case 'if': {
            const nested = action.action ? legacyActionToFunction(action.action) : null;
            return {
                type: 'IfFunction',
                condition: { ...(action.condition || { type: 'has_item', item: '' }) },
                then_functions: nested ? [nested] : [],
                else_functions: [],
            };
        }
        case 'return':
            return { type: 'MoveFunction', to: '' };
        default:
            return { type: 'LegacyFunction', raw: { ...action } };
    }
}

function resolveEngineSyncMeta({ root, maps }) {
    if (!Array.isArray(maps) || maps.length === 0) return null;

    const activeMapId = typeof root === 'string' && maps.some((m) => m?.id === root)
        ? root
        : maps[0]?.id;
    const activeMap = maps.find((m) => m?.id === activeMapId) || maps[0];
    if (!activeMap || !activeMap.id) return null;

    const { id: _ignoreId, root: _ignoreRoot, nodes: _ignoreNodes, ...activeMapExtra } = activeMap;
    const otherMaps = maps.filter((m) => m?.id && m.id !== activeMap.id);

    return {
        activeMapId: activeMap.id,
        topRootMapId: typeof root === 'string' ? root : activeMap.id,
        activeMapRootNodeId: typeof activeMap.root === 'string' ? activeMap.root : null,
        activeMapExtra,
        otherMaps,
    };
}

function resolveNodeSource({ nodes, maps, engineSyncMeta }) {
    // Legacy shape
    if (nodes && typeof nodes === 'object' && !Array.isArray(nodes)) {
        return nodes;
    }

    // New shape
    if (!engineSyncMeta || !Array.isArray(maps)) {
        return null;
    }

    const activeMap = maps.find((m) => m?.id === engineSyncMeta.activeMapId);
    if (!activeMap || !Array.isArray(activeMap.nodes)) {
        return null;
    }

    const normalized = {};
    for (const rawNode of activeMap.nodes) {
        if (!rawNode || typeof rawNode !== 'object' || !rawNode.id) continue;
        const { id, ...nodeFields } = rawNode;
        normalized[id] = { ...nodeFields };
    }
    return normalized;
}

function resolveRootNodeId({ root, engineSyncMeta }) {
    // Legacy shape root points to node id.
    if (!engineSyncMeta) {
        return typeof root === 'string' ? root : null;
    }

    // New shape root points to map id, map.root points to node id.
    const mapRootNodeId = engineSyncMeta?.activeMapRootNodeId;
    return typeof mapRootNodeId === 'string' ? mapRootNodeId : null;
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
