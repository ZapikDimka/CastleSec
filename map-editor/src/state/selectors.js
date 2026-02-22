// ============================================
// Derived state selectors
// ============================================

/**
 * Compute edges from nodes' actions.
 * Returns: [{ from, to, conditional, conditionSummary }]
 */
export function computeEdges(nodes) {
    const edges = [];

    for (const [nodeId, node] of Object.entries(nodes)) {
        if (!node.actions) continue;
        collectEdgesFromActions(nodeId, node.actions, false, null, edges);
    }

    return edges;
}

/**
 * Recursively walk actions to find move targets.
 */
function collectEdgesFromActions(fromId, actions, conditional, conditionSummary, out) {
    for (const action of actions) {
        if (action.type === 'move' && action.to) {
            out.push({
                from: fromId,
                to: action.to,
                conditional,
                conditionSummary: conditionSummary || null,
            });
        } else if (action.type === 'if') {
            // Build a human-readable condition summary
            const summary = buildConditionSummary(action);

            // The nested action can be a single object or (rarely) an array
            if (action.action) {
                const nested = Array.isArray(action.action) ? action.action : [action.action];
                collectEdgesFromActions(fromId, nested, true, summary, out);
            }
        }
    }
}

function buildConditionSummary(ifAction) {
    if (!ifAction.condition) return 'condition';
    const c = ifAction.condition;

    if (c.type === 'has_item' && c.item) return `has ${c.item}`;
    if (c.type === 'no_item' && c.item) return `no ${c.item}`;
    if (c.type) return c.type;

    return 'condition';
}
