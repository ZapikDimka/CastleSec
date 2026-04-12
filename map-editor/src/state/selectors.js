// ============================================
// Derived state selectors
// ============================================

/**
 * Compute edges from nodes' actions.
 * Returns: [{ from, to, conditional, conditionSummary, branchContext, edgeType, crossMap?, targetMap? }]
 */
export function computeEdges(nodes, options = {}) {
    const edges = [];
    const edgeKeys = new Set();
    const selectedMapId = options?.selectedMapId || null;

    for (const [nodeId, node] of Object.entries(nodes || {})) {
        if (!Array.isArray(node?.actions)) continue;
        collectEdgesFromActions({
            fromId: nodeId,
            actions: node.actions,
            contextTrail: [],
            selectedMapId,
            out: edges,
            edgeKeys,
            visiting: new WeakSet(),
        });
    }

    return edges;
}

function collectEdgesFromActions({ fromId, actions, contextTrail, selectedMapId, out, edgeKeys, visiting }) {
    for (const action of actions || []) {
        const actionTrail = appendActionConditionContext(contextTrail, action?.conditions);

        if (Array.isArray(action?.functions)) {
            collectEdgesFromFunctions({
                fromId,
                functions: action.functions,
                contextTrail: actionTrail,
                selectedMapId,
                out,
                edgeKeys,
                visiting,
            });
            continue;
        }

        // Legacy fallback while migration is still supported.
        if (action?.type === 'move' && action.to) {
            emitEdge({ out, edgeKeys, from: fromId, to: action.to, contextTrail: actionTrail });
            continue;
        }

        if (action?.type === 'if') {
            const summary = buildLegacyConditionSummary(action.condition);
            if (action.action) {
                const nested = Array.isArray(action.action) ? action.action : [action.action];
                collectEdgesFromActions({
                    fromId,
                    actions: nested,
                    contextTrail: [...actionTrail, `if:${summary}:then`],
                    selectedMapId,
                    out,
                    edgeKeys,
                    visiting,
                });
            }
        }
    }
}

function collectEdgesFromFunctions({ fromId, functions, contextTrail, selectedMapId, out, edgeKeys, visiting }) {
    for (const fn of functions || []) {
        if (!fn || typeof fn !== 'object') continue;

        if (visiting.has(fn)) continue;
        visiting.add(fn);

        if (fn.type === 'MoveFunction' && fn.to) {
            emitEdge({
                out,
                edgeKeys,
                from: fromId,
                to: fn.to,
                contextTrail,
                meta: { edgeType: 'move' },
            });
            visiting.delete(fn);
            continue;
        }

        if (fn.type === 'ChangeMapFunction') {
            if (fn.node) {
                const targetMap = typeof fn.map === 'string' && fn.map.trim() ? fn.map : null;
                const crossMap = Boolean(targetMap && selectedMapId && targetMap !== selectedMapId);
                emitEdge({
                    out,
                    edgeKeys,
                    from: fromId,
                    to: fn.node,
                    contextTrail: [...contextTrail, `map:${targetMap || 'unknown'}`],
                    meta: {
                        edgeType: 'change_map',
                        targetMap,
                        crossMap,
                    },
                });
            }
            visiting.delete(fn);
            continue;
        }

        if (fn.type === 'ConditionalFunction') {
            const condSummary = buildEngineConditionSummary(fn.condition);
            collectEdgesFromFunctions({
                fromId,
                functions: fn.on_success || [],
                contextTrail: [...contextTrail, `if:${condSummary}:success`],
                selectedMapId,
                out,
                edgeKeys,
                visiting,
            });
            collectEdgesFromFunctions({
                fromId,
                functions: fn.on_failure || [],
                contextTrail: [...contextTrail, `if:${condSummary}:failure`],
                selectedMapId,
                out,
                edgeKeys,
                visiting,
            });
            visiting.delete(fn);
            continue;
        }

        if (fn.type === 'SolveTaskFunction') {
            collectEdgesFromFunctions({
                fromId,
                functions: fn.on_success || [],
                contextTrail: [...contextTrail, 'task:success'],
                selectedMapId,
                out,
                edgeKeys,
                visiting,
            });
            collectEdgesFromFunctions({
                fromId,
                functions: fn.on_failure || [],
                contextTrail: [...contextTrail, 'task:failure'],
                selectedMapId,
                out,
                edgeKeys,
                visiting,
            });
            visiting.delete(fn);
            continue;
        }

        if (fn.type === 'RandomFunction') {
            const branches = Array.isArray(fn.branches) ? fn.branches : [];
            branches.forEach((branch, index) => {
                collectEdgesFromFunctions({
                    fromId,
                    functions: branch?.functions || [],
                    contextTrail: [...contextTrail, `random:${index + 1}`],
                    selectedMapId,
                    out,
                    edgeKeys,
                    visiting,
                });
            });
        }

        visiting.delete(fn);
    }
}

function emitEdge({ out, edgeKeys, from, to, contextTrail, meta = {} }) {
    const trail = Array.isArray(contextTrail) ? contextTrail : [];
    const conditionSummary = trail.length > 0 ? trail[trail.length - 1] : null;
    const key = `${from}|${to}|${trail.join('>')}|${meta.edgeType || ''}|${meta.targetMap || ''}|${meta.crossMap ? '1' : '0'}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);

    out.push({
        from,
        to,
        conditional: trail.length > 0,
        conditionSummary,
        branchContext: trail,
        edgeType: meta.edgeType || 'move',
        targetMap: meta.targetMap || null,
        crossMap: Boolean(meta.crossMap),
    });
}

function appendActionConditionContext(contextTrail, conditions) {
    if (!Array.isArray(conditions) || conditions.length === 0) return contextTrail;
    const summary = conditions
        .map((condition) => buildEngineConditionSummary(condition))
        .filter(Boolean)
        .join(' & ');
    if (!summary) return contextTrail;
    return [...contextTrail, `when:${summary}`];
}

function buildEngineConditionSummary(condition) {
    if (!condition || typeof condition !== 'object') return 'condition';

    if (condition.type === 'HasItemCondition') {
        return condition.negate ? `not has ${condition.item || '?'}` : `has ${condition.item || '?'}`;
    }

    if (condition.type === 'NodeStateCondition') {
        const target = condition.target_node || 'current';
        const value = condition.value || '?';
        return condition.negate ? `${target} state != ${value}` : `${target} state = ${value}`;
    }

    if (condition.type === 'GameVariableCondition') {
        const key = condition.key || '?';
        const op = condition.operator || 'eq';
        const value = condition.value || '?';
        return condition.negate ? `${key} not ${op} ${value}` : `${key} ${op} ${value}`;
    }

    if (condition.type === 'AnyCondition' || condition.type === 'AllCondition') {
        const nested = Array.isArray(condition.conditions)
            ? condition.conditions.map((c) => buildEngineConditionSummary(c)).join(condition.type === 'AnyCondition' ? ' OR ' : ' AND ')
            : '';
        const prefix = condition.type === 'AnyCondition' ? 'any' : 'all';
        const core = nested || 'condition';
        return condition.negate ? `not (${prefix}: ${core})` : `${prefix}: ${core}`;
    }

    return condition.type || 'condition';
}

function buildLegacyConditionSummary(condition) {
    if (!condition || typeof condition !== 'object') return 'condition';
    if (condition.type === 'has_item' && condition.item) return `has ${condition.item}`;
    if (condition.type === 'item_used' && condition.item) return `used ${condition.item}`;
    if (condition.type === 'item_not_collected' && condition.item) return `not_collected ${condition.item}`;
    return condition.type || 'condition';
}
