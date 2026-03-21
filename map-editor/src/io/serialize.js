/**
 * Converts the editor's in-memory state back into the main map JSON payload.
 * Node positions are persisted in the same file under `nodePositions`.
 */
export function serialize(state) {
    const {
        items,
        root,
        nodes,
        nodePositions,
        _extraTopLevel,
        mapsById,
        mapOrder,
        selectedMapId,
        topRootMapId,
    } = state;
    const engineSync = _extraTopLevel?._engineSync || {};

    // 1. Serialize Items to new engine array shape
    const serializedItems = Object.keys(items || {})
        .sort()
        .map((itemId) => {
            const item = items[itemId] || {};
            const itemCopy = { ...item, id: itemId };
            // Omit empty image
            if (!itemCopy.image) {
                delete itemCopy.image;
            }
            return itemCopy;
        });

    const stripUnknownFlagsDeep = (value) => {
        if (Array.isArray(value)) {
            return value.map(stripUnknownFlagsDeep);
        }
        if (!value || typeof value !== 'object') {
            return value;
        }
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            if (k === '_unknown') continue;
            out[k] = stripUnknownFlagsDeep(v);
        }
        return out;
    };

    // 2. Serialize Nodes to array shape
    const serializedNodes = Object.keys(nodes || {})
        .sort()
        .map((nodeId) => {
            const node = nodes[nodeId] || {};
            const nodeCopy = { ...node, id: nodeId };
        // Omit empty image
        if (!nodeCopy.image) {
            delete nodeCopy.image;
        }

        // Ensure actions is always an array and strip out any editor-only flags.
        if (!Array.isArray(nodeCopy.actions)) {
            nodeCopy.actions = [];
        } else {
            nodeCopy.actions = stripUnknownFlagsDeep(nodeCopy.actions);
        }

            return nodeCopy;
        });

    // 3. Assemble Game JSON
    const normalizedPositions = {};
    for (const nodeId of Object.keys(nodes || {})) {
        const pos = nodePositions?.[nodeId];
        if (!pos) continue;
        const x = Number(pos.x);
        const y = Number(pos.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        normalizedPositions[nodeId] = {
            x: Math.round(x),
            y: Math.round(y),
        };
    }

    // Preserve unknown top-level fields while removing editor-only metadata.
    const topLevelExtra = { ...(_extraTopLevel || {}) };
    delete topLevelExtra._engineSync;

    const fallbackActiveMapId = selectedMapId || engineSync.activeMapId || engineSync.topRootMapId || 'MAP_1';
    const effectiveTopRootMapId = topRootMapId || engineSync.topRootMapId || fallbackActiveMapId;
    const hasMapState = mapsById && typeof mapsById === 'object' && Array.isArray(mapOrder) && mapOrder.length > 0;

    let maps;
    if (hasMapState) {
        maps = mapOrder
            .map((mapId) => mapsById[mapId])
            .filter(Boolean)
            .map((map) => {
                const mapNodes = map.id === fallbackActiveMapId
                    ? serializedNodes
                    : Object.keys(map.nodes || {})
                        .sort()
                        .map((nodeId) => ({ ...(map.nodes[nodeId] || {}), id: nodeId }));
                return {
                    id: map.id,
                    root: map.id === fallbackActiveMapId ? root : map.root,
                    nodes: mapNodes,
                    ...(map._extra || {}),
                };
            });
    } else {
        const activeMapId = fallbackActiveMapId;
        const activeMapExtra = engineSync.activeMapExtra && typeof engineSync.activeMapExtra === 'object'
            ? engineSync.activeMapExtra
            : {};
        const otherMaps = Array.isArray(engineSync.otherMaps) ? engineSync.otherMaps : [];
        const activeMap = {
            id: activeMapId,
            root,
            nodes: serializedNodes,
            ...activeMapExtra,
        };
        const preservedOthers = otherMaps.filter((m) => m && typeof m === 'object' && m.id !== activeMapId);
        maps = [activeMap, ...preservedOthers];
    }

    const gameData = {
        root: effectiveTopRootMapId,
        items: serializedItems,
        maps,
        nodePositions: normalizedPositions,
        ...topLevelExtra
    };

    return {
        gameJson: JSON.stringify(gameData, null, 2)
    };
}
