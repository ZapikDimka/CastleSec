const CONDITION_OPS = new Set(['eq', 'gt', 'gte', 'lt', 'lte']);
const KNOWN_FUNCTION_TYPES = new Set([
    'MoveFunction',
    'PickUpItemFunction',
    'RemoveItemFunction',
    'SolveTaskFunction',
    'ConditionalFunction',
    'SetNodeStateFunction',
    'SetGameVariableFunction',
    'IncrementGameVariableFunction',
    'SetTextFunction',
    'SetImageFunction',
    'ChangeMapFunction',
    'ShowMessageFunction',
    'EndGameFunction',
    'RandomFunction',
]);
const KNOWN_CONDITION_TYPES = new Set([
    'HasItemCondition',
    'NodeStateCondition',
    'GameVariableCondition',
    'AnyCondition',
    'AllCondition',
]);

export function validate(state) {
    const results = new Map();

    const addIssue = (entityId, ruleId, severity, message) => {
        if (!results.has(entityId)) results.set(entityId, []);
        results.get(entityId).push({ id: ruleId, severity, message });
    };

    const {
        nodes = {},
        items = {},
        root,
        mapsById = null,
        mapOrder = null,
        topRootMapId = null,
        _extraTopLevel = null,
    } = state;
    const allNodes = { ...nodes };
    const knownTasks = new Set(
        Array.isArray(_extraTopLevel?.tasks)
            ? _extraTopLevel.tasks.map((task) => String(task))
            : [],
    );

    if (mapsById && typeof mapsById === 'object' && Array.isArray(mapOrder)) {
        const candidateTopRoot = topRootMapId || root;
        if (!candidateTopRoot || !mapsById[candidateTopRoot]) {
            addIssue('map', 'V-17', 'error', candidateTopRoot
                ? `Top root map "${candidateTopRoot}" does not exist.`
                : 'Top root map is missing.');
        }

        for (const mapId of mapOrder) {
            const map = mapsById[mapId];
            if (!map) continue;
            const mapNodes = map.nodes || {};
            for (const [id, mapNode] of Object.entries(mapNodes)) {
                if (mapNode && typeof mapNode === 'object') {
                    allNodes[id] = mapNode;
                }
            }
            if (!map.name || !String(map.name).trim()) {
                addIssue(mapId, 'V-25', 'error', `Map "${mapId}" is missing required name.`);
            }
            if (!map.root || !mapNodes[map.root]) {
                addIssue(mapId, 'V-18', 'error', map.root
                    ? `Map root "${map.root}" does not exist in map "${mapId}".`
                    : `Map "${mapId}" is missing root node.`);
            }
        }
    }

    if (root && !nodes[root]) {
        addIssue('map', 'V-01', 'error', `Root node "${root}" does not exist.`);
    }

    for (const itemId of Object.keys(items)) {
        const item = items[itemId] || {};
        if (!itemId.startsWith('ITEM_')) {
            addIssue(itemId, 'V-08', 'warning', 'Item ID should start with "ITEM_".');
        }
        if (!item.image || !String(item.image).trim()) {
            addIssue(itemId, 'V-26', 'error', 'Item image is required by engine schema.');
        }
    }

    const moveEdges = new Map();

    const validateCondition = (condition, nodeId, path = 'condition') => {
        if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
            addIssue(nodeId, 'V-27', 'error', `${path} must be an object.`);
            return;
        }
        if (!KNOWN_CONDITION_TYPES.has(condition.type)) {
            addIssue(nodeId, 'V-39', 'warning', `${path} uses unknown condition type "${condition.type || ''}".`);
            return;
        }

        if (condition.type === 'HasItemCondition') {
            if (!condition.item || !items[condition.item]) {
                addIssue(nodeId, 'V-04', 'error', condition.item
                    ? `${path} references non-existent item "${condition.item}".`
                    : `${path} is missing required item.`);
            }
            return;
        }

        if (condition.type === 'NodeStateCondition') {
            if (condition.target_node && !allNodes[condition.target_node]) {
                addIssue(nodeId, 'V-28', 'error', `${path} target node "${condition.target_node}" does not exist.`);
            }
            return;
        }

        if (condition.type === 'GameVariableCondition') {
            if (!condition.key || !String(condition.key).trim()) {
                addIssue(nodeId, 'V-29', 'error', `${path} is missing variable key.`);
            }
            if (!CONDITION_OPS.has(condition.operator)) {
                addIssue(nodeId, 'V-29', 'error', `${path} has invalid operator "${condition.operator || ''}".`);
            }
            return;
        }

        if (condition.type === 'AnyCondition' || condition.type === 'AllCondition') {
            if (!Array.isArray(condition.conditions)) {
                addIssue(nodeId, 'V-30', 'error', `${path}.conditions must be an array.`);
                return;
            }
            condition.conditions.forEach((nested, idx) => validateCondition(nested, nodeId, `${path}.conditions[${idx}]`));
        }
    };

    const validateFunction = (fn, nodeId, path = 'function') => {
        if (!fn || typeof fn !== 'object' || Array.isArray(fn)) {
            addIssue(nodeId, 'V-31', 'error', `${path} must be an object.`);
            return;
        }

        if (!KNOWN_FUNCTION_TYPES.has(fn.type)) {
            addIssue(nodeId, 'V-32', 'warning', `${path} has unknown function type "${fn.type || ''}".`);
            return;
        }

        if (fn.type === 'MoveFunction') {
            if (!fn.to || !allNodes[fn.to]) {
                addIssue(nodeId, 'V-02', 'error', fn.to
                    ? `${path} targets non-existent node "${fn.to}".`
                    : `${path} is missing target node.`);
            } else {
                moveEdges.get(nodeId).add(fn.to);
            }
            return;
        }

        if (fn.type === 'PickUpItemFunction' || fn.type === 'RemoveItemFunction') {
            if (!fn.item || !items[fn.item]) {
                addIssue(nodeId, 'V-03', 'error', fn.item
                    ? `${path} references non-existent item "${fn.item}".`
                    : `${path} is missing item.`);
            }
            return;
        }

        if (fn.type === 'SetNodeStateFunction' || fn.type === 'SetTextFunction' || fn.type === 'SetImageFunction') {
            if (fn.target_node && !allNodes[fn.target_node]) {
                addIssue(nodeId, 'V-28', 'error', `${path} target node "${fn.target_node}" does not exist.`);
            }
            if (fn.type === 'SetTextFunction') {
                if (!fn.variable || !String(fn.variable).trim()) addIssue(nodeId, 'V-15', 'error', `${path} variable is required.`);
                if (!fn.value || !String(fn.value).trim()) addIssue(nodeId, 'V-16', 'error', `${path} value is required.`);
            }
            if (fn.type === 'SetImageFunction' && (!fn.value || !String(fn.value).trim())) {
                addIssue(nodeId, 'V-16', 'error', `${path} image value is required.`);
            }
            return;
        }

        if (fn.type === 'SetGameVariableFunction') {
            if (!fn.key || !String(fn.key).trim()) addIssue(nodeId, 'V-15', 'error', `${path} key is required.`);
            return;
        }

        if (fn.type === 'IncrementGameVariableFunction') {
            if (!fn.key || !String(fn.key).trim()) addIssue(nodeId, 'V-15', 'error', `${path} key is required.`);
            if (!Number.isFinite(Number(fn.amount))) addIssue(nodeId, 'V-16', 'error', `${path} amount must be numeric.`);
            return;
        }

        if (fn.type === 'ShowMessageFunction') {
            if (!fn.message || !String(fn.message).trim()) addIssue(nodeId, 'V-11', 'error', `${path} message is required.`);
            return;
        }

        if (fn.type === 'EndGameFunction') {
            return;
        }

        if (fn.type === 'ChangeMapFunction') {
            if (!fn.map || !mapsById?.[fn.map]) {
                addIssue(nodeId, 'V-33', 'error', `${path} map "${fn.map || ''}" does not exist.`);
            }
            if (!fn.node || !String(fn.node).trim()) {
                addIssue(nodeId, 'V-33', 'error', `${path} node is required.`);
            } else {
                const targetMapNodes = mapsById?.[fn.map]?.nodes || {};
                if (fn.map && mapsById?.[fn.map] && !targetMapNodes[fn.node]) {
                    addIssue(nodeId, 'V-33', 'error', `${path} node "${fn.node}" does not exist in map "${fn.map}".`);
                }
            }
            return;
        }

        if (fn.type === 'ConditionalFunction') {
            validateCondition(fn.condition, nodeId, `${path}.condition`);
            if (!Array.isArray(fn.on_success)) {
                addIssue(nodeId, 'V-23', 'error', `${path}.on_success must be an array.`);
            } else {
                fn.on_success.forEach((nested, idx) => validateFunction(nested, nodeId, `${path}.on_success[${idx}]`));
            }
            if (!Array.isArray(fn.on_failure)) {
                addIssue(nodeId, 'V-24', 'error', `${path}.on_failure must be an array.`);
            } else {
                fn.on_failure.forEach((nested, idx) => validateFunction(nested, nodeId, `${path}.on_failure[${idx}]`));
            }
            return;
        }

        if (fn.type === 'SolveTaskFunction') {
            if (!fn.task || !String(fn.task).trim()) addIssue(nodeId, 'V-22', 'error', `${path}.task is required.`);
            if (knownTasks.size > 0 && fn.task && !knownTasks.has(String(fn.task))) {
                addIssue(nodeId, 'V-22', 'error', `${path}.task "${fn.task}" is not found in loaded tasks list.`);
            }
            if (!Array.isArray(fn.on_success)) {
                addIssue(nodeId, 'V-23', 'error', `${path}.on_success must be an array.`);
            } else {
                fn.on_success.forEach((nested, idx) => validateFunction(nested, nodeId, `${path}.on_success[${idx}]`));
            }
            if (!Array.isArray(fn.on_failure)) {
                addIssue(nodeId, 'V-24', 'error', `${path}.on_failure must be an array.`);
            } else {
                fn.on_failure.forEach((nested, idx) => validateFunction(nested, nodeId, `${path}.on_failure[${idx}]`));
            }
            return;
        }

        if (fn.type === 'RandomFunction') {
            if (!Array.isArray(fn.branches) || fn.branches.length === 0) {
                addIssue(nodeId, 'V-34', 'error', `${path}.branches must contain at least one branch.`);
                return;
            }
            fn.branches.forEach((branch, idx) => {
                if (!Number.isFinite(Number(branch?.weight)) || Number(branch.weight) <= 0) {
                    addIssue(nodeId, 'V-34', 'error', `${path}.branches[${idx}].weight must be > 0.`);
                }
                if (!Array.isArray(branch?.functions)) {
                    addIssue(nodeId, 'V-34', 'error', `${path}.branches[${idx}].functions must be an array.`);
                    return;
                }
                branch.functions.forEach((nested, nestedIdx) => validateFunction(nested, nodeId, `${path}.branches[${idx}].functions[${nestedIdx}]`));
            });
        }
    };

    for (const [nodeId, node] of Object.entries(nodes)) {
        if (!nodeId.startsWith('NODE_')) {
            addIssue(nodeId, 'V-07', 'warning', 'Node ID should start with "NODE_".');
        }

        if (!node.image || !String(node.image).trim()) {
            addIssue(nodeId, 'V-35', 'error', 'Node image is required by engine schema.');
        }

        if (!node.coords || typeof node.coords !== 'object' || !Number.isFinite(Number(node.coords.x)) || !Number.isFinite(Number(node.coords.y))) {
            addIssue(nodeId, 'V-36', 'error', 'Node coords are required and must be numeric.');
        }

        moveEdges.set(nodeId, new Set());

        const actions = node.actions || [];
        actions.forEach((action, actionIndex) => {
            if (!action || typeof action !== 'object' || Array.isArray(action)) {
                addIssue(nodeId, 'V-38', 'error', `Action ${actionIndex + 1} must be an object.`);
                return;
            }
            if (!Array.isArray(action?.functions)) {
                addIssue(nodeId, 'V-38', 'error', `Action ${actionIndex + 1} functions must be an array.`);
                return;
            }
            if (!action.label || !String(action.label).trim()) {
                addIssue(nodeId, 'V-10', 'error', `Action ${actionIndex + 1} is missing label.`);
            }
            if (!Array.isArray(action.conditions)) {
                addIssue(nodeId, 'V-37', 'error', `Action ${actionIndex + 1} conditions must be an array.`);
            } else {
                action.conditions.forEach((condition, idx) => validateCondition(condition, nodeId, `actions[${actionIndex}].conditions[${idx}]`));
            }
            action.functions.forEach((fn, fnIndex) => validateFunction(fn, nodeId, `actions[${actionIndex}].functions[${fnIndex}]`));
        });
    }

    const reachable = new Set();
    if (root && nodes[root]) {
        const queue = [root];
        reachable.add(root);

        let head = 0;
        while (head < queue.length) {
            const current = queue[head++];
            const neighbors = moveEdges.get(current) || new Set();
            for (const neighbor of neighbors) {
                if (!reachable.has(neighbor) && nodes[neighbor]) {
                    reachable.add(neighbor);
                    queue.push(neighbor);
                }
            }
        }
    }

    for (const nodeId of Object.keys(nodes)) {
        if (!reachable.has(nodeId)) {
            addIssue(nodeId, 'V-09', 'warning', 'Node is unreachable from root via move actions.');
        }
    }

    return results;
}
