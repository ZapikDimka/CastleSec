export function validate(state) {
    const results = new Map();

    const addIssue = (entityId, ruleId, severity, message) => {
        if (!results.has(entityId)) {
            results.set(entityId, []);
        }
        results.get(entityId).push({ id: ruleId, severity, message });
    };

    const { nodes = {}, items = {}, root } = state;

    // V-01: Root references existing node
    if (root && !nodes[root]) {
        addIssue('map', 'V-01', 'error', `Root node "${root}" does not exist.`);
    }

    const checkAction = (action, nodeId) => {
        if (!action) return;

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
            if (action.condition?.type === 'has_item') {
                // V-04: has_item.item references exist
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
            if (action.type === 'move' && action.to) {
                moveEdges.get(nodeId).add(action.to);
            } else if (action.type === 'if' && action.action) {
                const nested = Array.isArray(action.action) ? action.action : [action.action];
                nested.forEach(processActionForEdges);
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
