export function validate(state) {
    const results = new Map();

    const addIssue = (entityId, ruleId, severity, message) => {
        if (!results.has(entityId)) {
            results.set(entityId, []);
        }
        results.get(entityId).push({ id: ruleId, severity, message });
    };

    const {
        nodes = {},
        items = {},
        root,
        mapsById = null,
        mapOrder = null,
        topRootMapId = null,
    } = state;
    const CONDITION_TYPES_WITH_ITEM = new Set(['has_item', 'item_used', 'item_not_collected']);
    const KNOWN_CONDITION_TYPES = new Set(['has_item', 'item_used', 'item_not_collected']);

    // V-17: Top root map must exist in mapsById when multi-map state is present.
    if (mapsById && typeof mapsById === 'object' && mapOrder && Array.isArray(mapOrder)) {
        const candidateTopRoot = topRootMapId || root;
        if (!candidateTopRoot || !mapsById[candidateTopRoot]) {
            addIssue(
                'map',
                'V-17',
                'error',
                candidateTopRoot
                    ? `Top root map "${candidateTopRoot}" does not exist.`
                    : 'Top root map is missing.',
            );
        }

        // V-18: Each map root must reference a node inside that map.
        for (const mapId of mapOrder) {
            const map = mapsById[mapId];
            if (!map) continue;
            const mapNodes = map.nodes || {};
            if (!map.root || !mapNodes[map.root]) {
                addIssue(
                    mapId,
                    'V-18',
                    'error',
                    map.root
                        ? `Map root "${map.root}" does not exist in map "${mapId}".`
                        : `Map "${mapId}" is missing root node.`,
                );
            }
        }
    }

    // V-01: Root references existing node
    if (root && !nodes[root]) {
        addIssue('map', 'V-01', 'error', `Root node "${root}" does not exist.`);
    }

    const checkAction = (action, nodeId) => {
        if (!action) return;

        // New action-choice model
        if (Array.isArray(action.functions)) {
            if (!action.label || !String(action.label).trim()) {
                addIssue(nodeId, 'V-10', 'error', 'Action choice is missing label.');
            }
            for (const fn of action.functions) {
                checkFunction(fn, nodeId);
            }
            return;
        }

        if (action.type === 'move') {
            // V-02: move.to references exist
            if (!action.to || !nodes[action.to]) {
                addIssue(nodeId, 'V-02', 'error', action.to ? `Move action targets non-existent node "${action.to}".` : `Move action is missing a target node.`);
            }
        }

        if (action.type === 'pickup') {
            // V-03: pickup.item references exist
            if (!action.item || !items[action.item]) {
                addIssue(nodeId, 'V-03', 'error', action.item ? `Pickup action references non-existent item "${action.item}".` : `Pickup action is missing an item.`);
            }
        }

        if (action.type === 'if') {
            if (CONDITION_TYPES_WITH_ITEM.has(action.condition?.type)) {
                // V-04: condition.item references exist
                if (!action.condition.item || !items[action.condition.item]) {
                    addIssue(nodeId, 'V-04', 'error', action.condition.item ? `Condition references non-existent item "${action.condition.item}".` : `Condition is missing an item.`);
                }
            }
            if (action.action) {
                const nested = Array.isArray(action.action) ? action.action : [action.action];
                for (const a of nested) {
                    checkAction(a, nodeId);
                }
            }
        }
    };

    const checkFunction = (fn, nodeId) => {
        if (!fn) return;
        if (fn.type === 'MoveFunction') {
            if (!fn.to || !nodes[fn.to]) {
                addIssue(nodeId, 'V-02', 'error', fn.to ? `Move function targets non-existent node "${fn.to}".` : 'Move function is missing a target node.');
            }
            return;
        }
        if (fn.type === 'PickUpItemFunction') {
            if (!fn.item || !items[fn.item]) {
                addIssue(nodeId, 'V-03', 'error', fn.item ? `Pickup function references non-existent item "${fn.item}".` : 'Pickup function is missing an item.');
            }
            return;
        }
        if (fn.type === 'IfFunction') {
            if (!fn.condition || typeof fn.condition !== 'object' || Array.isArray(fn.condition)) {
                addIssue(nodeId, 'V-19', 'error', 'IfFunction is missing condition object.');
            } else if (!KNOWN_CONDITION_TYPES.has(fn.condition.type)) {
                addIssue(nodeId, 'V-19', 'error', `IfFunction uses unsupported condition type "${fn.condition.type || ''}".`);
            }
            if (CONDITION_TYPES_WITH_ITEM.has(fn.condition?.type)) {
                if (!fn.condition.item || !items[fn.condition.item]) {
                    addIssue(nodeId, 'V-04', 'error', fn.condition.item ? `Condition references non-existent item "${fn.condition.item}".` : 'Condition is missing an item.');
                }
            }
            if (!Array.isArray(fn.then_functions)) {
                addIssue(nodeId, 'V-20', 'error', 'IfFunction.then_functions must be an array.');
            }
            if (!Array.isArray(fn.else_functions)) {
                addIssue(nodeId, 'V-21', 'error', 'IfFunction.else_functions must be an array.');
            }
            (fn.then_functions || []).forEach((nested) => checkFunction(nested, nodeId));
            (fn.else_functions || []).forEach((nested) => checkFunction(nested, nodeId));
            return;
        }
        if (fn.type === 'SolveTaskFunction') {
            if (!fn.task || !String(fn.task).trim()) {
                addIssue(nodeId, 'V-22', 'error', 'SolveTaskFunction is missing required task.');
            }
            if (!Array.isArray(fn.on_success)) {
                addIssue(nodeId, 'V-23', 'error', 'SolveTaskFunction.on_success must be an array.');
            }
            if (!Array.isArray(fn.on_failure)) {
                addIssue(nodeId, 'V-24', 'error', 'SolveTaskFunction.on_failure must be an array.');
            }
            (fn.on_success || []).forEach((nested) => checkFunction(nested, nodeId));
            (fn.on_failure || []).forEach((nested) => checkFunction(nested, nodeId));
            return;
        }
        if (fn.type === 'ShowHintTextFunction') {
            if (!fn.text || !String(fn.text).trim()) {
                addIssue(nodeId, 'V-11', 'error', 'Hint function is missing required text.');
            }
            return;
        }
        if (fn.type === 'InspectFunction') {
            if (!fn.title || !String(fn.title).trim()) {
                addIssue(nodeId, 'V-12', 'error', 'Inspect function is missing required title.');
            }
            if (!fn.content || !String(fn.content).trim()) {
                addIssue(nodeId, 'V-13', 'error', 'Inspect function is missing required content.');
            }
            return;
        }
        if (fn.type === 'SetVariableFunction') {
            if (fn.target_node && !nodes[fn.target_node]) {
                addIssue(nodeId, 'V-14', 'error', `SetVariableFunction references non-existent node "${fn.target_node}".`);
            }
            if (!fn.variable || !String(fn.variable).trim()) {
                addIssue(nodeId, 'V-15', 'error', 'SetVariableFunction is missing required variable.');
            }
            if (!fn.value || !String(fn.value).trim()) {
                addIssue(nodeId, 'V-16', 'error', 'SetVariableFunction is missing required value.');
            }
        }
    };

    // Check item IDs
    for (const itemId of Object.keys(items)) {
        // V-08: Item ID prefix
        if (!itemId.startsWith('ITEM_')) {
            addIssue(itemId, 'V-08', 'warning', `Item ID should start with "ITEM_".`);
        }
    }

    const moveEdges = new Map(); // from -> Set(to)

    for (const [nodeId, node] of Object.entries(nodes)) {
        // V-07: Node ID prefix
        if (!nodeId.startsWith('NODE_')) {
            addIssue(nodeId, 'V-07', 'warning', `Node ID should start with "NODE_".`);
        }

        moveEdges.set(nodeId, new Set());

        const actions = node.actions || [];
        const processActionForEdges = (action) => {
            if (Array.isArray(action?.functions)) {
                processFunctionsForEdges(action.functions);
            } else if (action.type === 'move' && action.to) {
                moveEdges.get(nodeId).add(action.to);
            } else if (action.type === 'if' && action.action) {
                const nested = Array.isArray(action.action) ? action.action : [action.action];
                nested.forEach(processActionForEdges);
            }
        };

        const processFunctionsForEdges = (functions) => {
            for (const fn of functions || []) {
                if (!fn) continue;
                if (fn.type === 'MoveFunction' && fn.to) {
                    moveEdges.get(nodeId).add(fn.to);
                    continue;
                }
                if (fn.type === 'IfFunction') {
                    processFunctionsForEdges(fn.then_functions || []);
                    processFunctionsForEdges(fn.else_functions || []);
                    continue;
                }
                if (fn.type === 'SolveTaskFunction') {
                    processFunctionsForEdges(fn.on_success || []);
                    processFunctionsForEdges(fn.on_failure || []);
                }
            }
        };

        for (const action of actions) {
            checkAction(action, nodeId);
            processActionForEdges(action);
        }
    }

    // V-09: Orphan nodes via BFS from root
    const reachable = new Set();
    if (root && nodes[root]) {
        const queue = [root];
        reachable.add(root);

        let head = 0;
        while (head < queue.length) {
            const current = queue[head++];
            const neighbors = moveEdges.get(current) || new Set();
            for (const neighbor of neighbors) {
                if (!reachable.has(neighbor) && nodes[neighbor]) { // ignore invalid edges here
                    reachable.add(neighbor);
                    queue.push(neighbor);
                }
            }
        }
    }

    for (const nodeId of Object.keys(nodes)) {
        if (!reachable.has(nodeId)) {
            // V-09: Orphan node
            addIssue(nodeId, 'V-09', 'warning', `Node is unreachable from root via move actions.`);
        }
    }

    return results;
}
