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
        const parsedNode = {
            ...node,
            id: nodeId,
            image: typeof node?.image === 'string' && node.image.trim() ? node.image : 'ic_cross.svg',
        };

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

    // Keep node.coords synchronized with resolved positions for engine-valid schema.
    for (const nodeId of Object.keys(parsedNodes)) {
        const node = parsedNodes[nodeId];
        const pos = nodePositions[nodeId] || { x: 0, y: 0 };
        node.coords = sanitizeCoords(node.coords, pos);
    }

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

function sanitizeCoords(rawCoords, fallback) {
    if (rawCoords && typeof rawCoords === 'object') {
        const x = Number(rawCoords.x);
        const y = Number(rawCoords.y);
        if (Number.isFinite(x) && Number.isFinite(y)) {
            return { x: Math.round(x), y: Math.round(y) };
        }
    }
    return { x: Math.round(fallback?.x || 0), y: Math.round(fallback?.y || 0) };
}

function parseItemsToDict(rawItems) {
    const parsedItems = {};

    // New shape: items[]
    if (Array.isArray(rawItems)) {
        for (const rawItem of rawItems) {
            if (!rawItem || typeof rawItem !== 'object' || !rawItem.id) continue;
            const { id, ...itemFields } = rawItem;
            parsedItems[id] = {
                id,
                ...itemFields,
                name: typeof itemFields.name === 'string' ? itemFields.name : id,
                image: typeof itemFields.image === 'string' && itemFields.image.trim() ? itemFields.image : 'ic_cross.svg',
                description: typeof itemFields.description === 'string' ? itemFields.description : '',
            };
        }
        return parsedItems;
    }

    // Legacy shape: items{}
    if (rawItems && typeof rawItems === 'object') {
        for (const [itemId, item] of Object.entries(rawItems)) {
            const source = item && typeof item === 'object' ? item : {};
            parsedItems[itemId] = {
                id: itemId,
                ...source,
                name: typeof source.name === 'string' ? source.name : itemId,
                image: typeof source.image === 'string' && source.image.trim() ? source.image : 'ic_cross.svg',
                description: typeof source.description === 'string' ? source.description : '',
            };
        }
    }

    return parsedItems;
}

function toActionChoice(rawAction) {
    if (!rawAction || typeof rawAction !== 'object') {
        return { label: 'Action', once: false, functions: [], conditions: [] };
    }

    // Already in action-choice shape.
    if (typeof rawAction.label === 'string' && Array.isArray(rawAction.functions)) {
        return {
            ...rawAction,
            once: Boolean(rawAction.once),
            functions: rawAction.functions.map((fn) => toKnownOrUnknownFunction(fn)),
            conditions: Array.isArray(rawAction.conditions)
                ? rawAction.conditions.map((c) => toKnownOrUnknownCondition(c))
                : [],
        };
    }

    return migrateLegacyActionToChoice(rawAction);
}

function toKnownOrUnknownFunction(rawFunction) {
    const fn = { ...(rawFunction || {}) };
    const known = [
        'MoveFunction',
        'PickUpItemFunction',
        'RemoveItemFunction',
        'SolveTaskFunction',
        'SetNodeStateFunction',
        'SetGameVariableFunction',
        'IncrementGameVariableFunction',
        'SetTextFunction',
        'SetImageFunction',
        'ChangeMapFunction',
        'EndGameFunction',
        'ShowMessageFunction',
        'ConditionalFunction',
        'RandomFunction',
    ];

    if (fn.type && !known.includes(fn.type)) {
        fn._unknown = true;
    }

    if (fn.type === 'ConditionalFunction' && fn.condition && typeof fn.condition === 'object') {
        fn.condition = toKnownOrUnknownCondition(fn.condition);
    }
    if (fn.type === 'ConditionalFunction') {
        fn.on_success = Array.isArray(fn.on_success) ? fn.on_success.map((nested) => toKnownOrUnknownFunction(nested)) : [];
        fn.on_failure = Array.isArray(fn.on_failure) ? fn.on_failure.map((nested) => toKnownOrUnknownFunction(nested)) : [];
    }
    if (fn.type === 'SolveTaskFunction') {
        fn.on_success = Array.isArray(fn.on_success) ? fn.on_success.map((nested) => toKnownOrUnknownFunction(nested)) : [];
        fn.on_failure = Array.isArray(fn.on_failure) ? fn.on_failure.map((nested) => toKnownOrUnknownFunction(nested)) : [];
    }
    if (fn.type === 'RandomFunction' && Array.isArray(fn.branches)) {
        fn.branches = fn.branches.map((branch) => ({
            ...(branch || {}),
            functions: Array.isArray(branch?.functions)
                ? branch.functions.map((nested) => toKnownOrUnknownFunction(nested))
                : [],
        }));
    }

    return fn;
}

function toKnownOrUnknownCondition(rawCondition) {
    const condition = { ...(rawCondition || {}) };
    const knownConditions = [
        'HasItemCondition',
        'NodeStateCondition',
        'GameVariableCondition',
        'AnyCondition',
        'AllCondition',
    ];

    if (condition.type && !knownConditions.includes(condition.type)) {
        condition._unknown = true;
    }

    if ((condition.type === 'AnyCondition' || condition.type === 'AllCondition') && Array.isArray(condition.conditions)) {
        condition.conditions = condition.conditions.map((nested) => toKnownOrUnknownCondition(nested));
    }

    return condition;
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
            return 'If condition';
        case 'return':
            return 'Return (set destination)';
        default:
            return action.type ? `Legacy: ${action.type}` : 'Action';
    }
}

function migrateLegacyActionToChoice(action) {
    if (!action || typeof action !== 'object') {
        return { label: 'Action', once: false, functions: [], conditions: [] };
    }

    if (action.type === 'if') {
        return migrateLegacyIfActionToChoice(action);
    }

    const migratedFn = legacyActionToFunction(action);
    return {
        label: legacyActionToLabel(action),
        once: Boolean(action.once),
        functions: migratedFn ? [toKnownOrUnknownFunction(migratedFn)] : [],
        conditions: [],
    };
}

function migrateLegacyIfActionToChoice(action) {
    const condition = toKnownOrUnknownCondition(legacyConditionToCondition(action.condition));
    const thenActions = normalizeLegacyActionList(action.action ?? action.then ?? action.then_action);
    const elseActions = normalizeLegacyActionList(action.else ?? action.else_action ?? action.on_false);

    const thenFunctions = thenActions
        .map((a) => legacyActionToFunction(a))
        .filter(Boolean)
        .map((fn) => toKnownOrUnknownFunction(fn));
    const elseFunctions = elseActions
        .map((a) => legacyActionToFunction(a))
        .filter(Boolean)
        .map((fn) => toKnownOrUnknownFunction(fn));

    const hasElseBranch = elseFunctions.length > 0;
    const requiresBranchSemantics = hasElseBranch || thenFunctions.some((fn) => fn?.type === 'ConditionalFunction');

    if (!requiresBranchSemantics) {
        return {
            label: legacyActionToLabel(action),
            once: Boolean(action.once),
            conditions: [condition],
            functions: thenFunctions,
        };
    }

    return {
        label: legacyActionToLabel(action),
        once: Boolean(action.once),
        conditions: [],
        functions: [
            toKnownOrUnknownFunction({
                type: 'ConditionalFunction',
                condition,
                on_success: thenFunctions,
                on_failure: elseFunctions,
            }),
        ],
    };
}

function normalizeLegacyActionList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter((entry) => entry && typeof entry === 'object');
    if (typeof value === 'object') return [value];
    return [];
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
                type: 'ConditionalFunction',
                condition: legacyConditionToCondition(action.condition),
                on_success: nested ? [nested] : [],
                on_failure: [],
            };
        }
        case 'return':
            if (typeof action.to === 'string' && action.to.trim()) {
                return { type: 'MoveFunction', to: action.to.trim() };
            }
            return {
                type: 'LegacyFunction',
                legacy_type: 'return',
                raw: { ...action },
            };
        default:
            return {
                type: 'LegacyFunction',
                legacy_type: typeof action.type === 'string' ? action.type : 'unknown',
                raw: { ...action },
            };
    }
}

function legacyConditionToCondition(condition) {
    if (!condition || typeof condition !== 'object') {
        return {
            type: 'LegacyCondition',
            legacy_type: 'missing',
            raw: condition ?? null,
        };
    }
    if (condition.type === 'has_item') {
        return { type: 'HasItemCondition', item: condition.item || '' };
    }
    if (condition.type === 'item_not_collected') {
        return { type: 'HasItemCondition', item: condition.item || '', negate: true };
    }
    if (condition.type === 'item_used') {
        return { type: 'GameVariableCondition', key: `item_used:${condition.item || ''}`, value: '1', operator: 'eq' };
    }
    return {
        ...condition,
        type: condition.type || 'LegacyCondition',
        legacy_type: condition.type || 'unknown',
        raw: { ...condition },
    };
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

        // Find outgoing move edges from both legacy and function-based actions.
        for (const action of node.actions) {
            const targets = collectMoveTargetsFromAction(action);
            for (const targetId of targets) {
                if (targetId && nodes[targetId] && !visited.has(targetId)) {
                    visited.add(targetId);
                    queue.push({ id: targetId, depth: depth + 1 });
                }
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

function collectMoveTargetsFromAction(action) {
    const out = [];
    if (!action || typeof action !== 'object') return out;
    if (Array.isArray(action.functions)) {
        collectMoveTargetsFromFunctions(action.functions, out);
        return out;
    }
    if (action.type === 'move' && action.to) {
        out.push(action.to);
    }
    if (action.type === 'if' && action.action) {
        const nested = Array.isArray(action.action) ? action.action : [action.action];
        for (const a of nested) {
            out.push(...collectMoveTargetsFromAction(a));
        }
    }
    return out;
}

function collectMoveTargetsFromFunctions(functions, out) {
    for (const fn of functions || []) {
        if (!fn || typeof fn !== 'object') continue;
        if (fn.type === 'MoveFunction' && fn.to) out.push(fn.to);
        if (fn.type === 'SolveTaskFunction') {
            collectMoveTargetsFromFunctions(fn.on_success || [], out);
            collectMoveTargetsFromFunctions(fn.on_failure || [], out);
        }
        if (fn.type === 'ConditionalFunction') {
            collectMoveTargetsFromFunctions(fn.on_success || [], out);
            collectMoveTargetsFromFunctions(fn.on_failure || [], out);
        }
        if (fn.type === 'RandomFunction') {
            for (const branch of fn.branches || []) {
                collectMoveTargetsFromFunctions(branch.functions || [], out);
            }
        }
    }
}
