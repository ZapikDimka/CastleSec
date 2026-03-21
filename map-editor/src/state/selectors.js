// ============================================
// Derived state selectors
// ============================================

/**
 * Compute edges from nodes' actions.
 * Returns: [{ from, to, conditional, conditionSummary }]
 */
export function computeEdges(nodes) {
    const edges = [];
    const edgeKeys = new Set();

    for (const [nodeId, node] of Object.entries(nodes)) {
        if (!node.actions) continue;
        collectEdgesFromActions({
            fromId: nodeId,
            actions: node.actions,
            contextTrail: [],
            out: edges,
            edgeKeys,
            visiting: new WeakSet(),
        });
    }

    return edges;
}

/**
 * Recursively walk actions to find move targets.
 */
function collectEdgesFromActions({ fromId, actions, contextTrail, out, edgeKeys, visiting }) {
    for (const action of actions) {
        if (Array.isArray(action?.functions)) {
            collectEdgesFromFunctions({
                fromId,
                functions: action.functions,
                contextTrail,
                out,
                edgeKeys,
                visiting,
            });
            continue;
        }

        if (action.type === 'move' && action.to) {
            emitEdge({
                out,
                edgeKeys,
                from: fromId,
                to: action.to,
                contextTrail,
            });
        } else if (action.type === 'if') {
            const summary = buildConditionSummary(action);
            if (action.action) {
                const nested = Array.isArray(action.action) ? action.action : [action.action];
                collectEdgesFromActions({
                    fromId,
                    actions: nested,
                    contextTrail: [...contextTrail, `if:${summary}:then`],
                    out,
                    edgeKeys,
                    visiting,
                });
            }
        }
    }
}

function collectEdgesFromFunctions({ fromId, functions, contextTrail, out, edgeKeys, visiting }) {
    for (const fn of functions || []) {
        if (!fn) continue;
        if (typeof fn === 'object') {
            if (visiting.has(fn)) continue; // cycle-safe traversal guard
            visiting.add(fn);
        }

        if (fn.type === 'MoveFunction' && fn.to) {
            emitEdge({
                out,
                edgeKeys,
                from: fromId,
                to: fn.to,
                contextTrail,
            });
            if (typeof fn === 'object') visiting.delete(fn);
            continue;
        }

        if (fn.type === 'IfFunction') {
            const condSummary = buildConditionSummary({ condition: fn.condition });
            collectEdgesFromFunctions({
                fromId,
                functions: fn.then_functions || [],
                contextTrail: [...contextTrail, `if:${condSummary}:then`],
                out,
                edgeKeys,
                visiting,
            });
            collectEdgesFromFunctions({
                fromId,
                functions: fn.else_functions || [],
                contextTrail: [...contextTrail, `if:${condSummary}:else`],
                out,
                edgeKeys,
                visiting,
            });
            if (typeof fn === 'object') visiting.delete(fn);
            continue;
        }

        if (fn.type === 'SolveTaskFunction') {
            collectEdgesFromFunctions({
                fromId,
                functions: fn.on_success || [],
                contextTrail: [...contextTrail, 'task:success'],
                out,
                edgeKeys,
                visiting,
            });
            collectEdgesFromFunctions({
                fromId,
                functions: fn.on_failure || [],
                contextTrail: [...contextTrail, 'task:failure'],
                out,
                edgeKeys,
                visiting,
            });
        }

        if (typeof fn === 'object') visiting.delete(fn);
    }
}

function emitEdge({ out, edgeKeys, from, to, contextTrail }) {
    const trail = Array.isArray(contextTrail) ? contextTrail : [];
    const conditionSummary = trail.length > 0 ? trail[trail.length - 1] : null;
    const key = `${from}|${to}|${trail.join('>')}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);

    out.push({
        from,
        to,
        conditional: trail.length > 0,
        conditionSummary,
        branchContext: trail,
    });
}

function buildConditionSummary(ifAction) {
    if (!ifAction.condition) return 'condition';
    const c = ifAction.condition;

    if (c.type === 'has_item' && c.item) return `has ${c.item}`;
    if (c.type === 'item_used' && c.item) return `used ${c.item}`;
    if (c.type === 'item_not_collected' && c.item) return `not_collected ${c.item}`;
    if (c.type) return c.type;

    return 'condition';
}
