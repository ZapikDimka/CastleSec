import { pushHistory, undo, redo } from './history.js';

// ============================================
// Map Reducer — all map state mutations
// ============================================

export function createInitialState() {
    const defaultMap = createDefaultMap('MAP_1');

    return {
        // ----- Map Data (serialized to JSON) -----
        items: {},
        topRootMapId: defaultMap.id,
        selectedMapId: defaultMap.id,
        mapsById: {
            [defaultMap.id]: defaultMap,
        },
        mapOrder: [defaultMap.id],
        root: defaultMap.root,
        nodes: defaultMap.nodes,
        nodePositions: defaultMap.nodePositions,

        // ----- Editor-Only State -----
        selectedNodeId: null,
        selectedItemId: null,
        filePath: null,
        isDirty: false,
        _extraTopLevel: {
            _editor: {
                sidePanelWidth: 320,
            },
            _engineSync: buildEngineSyncMeta({
                selectedMapId: defaultMap.id,
                topRootMapId: defaultMap.id,
                mapsById: { [defaultMap.id]: defaultMap },
                mapOrder: [defaultMap.id],
            }),
        },
        nodeCounter: 3,
        itemCounter: 0,
        history: {
            past: [],
            future: [],
        }
    };
}

function createDefaultMap(id) {
    const rootId = 'NODE_root';
    return {
        id,
        name: id,
        root: rootId,
        nodes: {
            [rootId]: {
                id: rootId,
                name: 'Entrance Hall',
                text: 'Starting point of the map.',
                image: null,
                actions: [
                    {
                        label: 'Go to Armory',
                        once: false,
                        functions: [
                            { type: 'MoveFunction', to: 'NODE_armory' },
                        ],
                    },
                    {
                        label: 'Use key for Throne Room',
                        once: false,
                        functions: [
                            {
                                type: 'IfFunction',
                                condition: { type: 'has_item', item: 'ITEM_key' },
                                then_functions: [{ type: 'MoveFunction', to: 'NODE_throne' }],
                                else_functions: [],
                            },
                        ],
                    },
                ],
            },
            NODE_armory: {
                id: 'NODE_armory',
                name: 'Armory',
                text: 'Weapons line the walls.',
                image: null,
                actions: [
                    {
                        label: 'Return to Entrance',
                        once: false,
                        functions: [{ type: 'MoveFunction', to: rootId }],
                    },
                    {
                        label: 'Go to Throne Room',
                        once: false,
                        functions: [{ type: 'MoveFunction', to: 'NODE_throne' }],
                    },
                ],
            },
            NODE_throne: {
                id: 'NODE_throne',
                name: 'Throne Room',
                text: 'The king sits here.',
                image: null,
                actions: [
                    {
                        label: 'Wait',
                        once: false,
                        functions: [{ type: 'MoveFunction', to: 'NODE_throne' }],
                    },
                ],
            },
        },
        nodePositions: {
            [rootId]: { x: 0, y: 0 },
            NODE_armory: { x: 300, y: 0 },
            NODE_throne: { x: 150, y: 200 },
        },
        _extra: {},
    };
}

// Actions that mutate state but shouldn't create undo snapshots.
const HISTORY_IGNORE = new Set([
    'SELECT_NODE',
    'SELECT_ITEM',
    'SELECT_MAP',
    'MARK_SAVED',
    'MOVE_NODE_POSITION',
    'LOAD_MAP',
    'NEW_MAP',
    'SET_EDITOR_CONFIG',
]);

function baseReducer(state, action) {
    switch (action.type) {
        case 'NEW_MAP':
            return createInitialState();

        case 'ADD_MAP': {
            const requestedId = action.payload?.id?.trim();
            const fallbackId = `MAP_${state.mapOrder.length + 1}`;
            const id = requestedId || fallbackId;
            if (state.mapsById[id]) return state;

            const map = createDefaultMap(id);
            return {
                ...state,
                mapsById: {
                    ...state.mapsById,
                    [id]: map,
                },
                mapOrder: [...state.mapOrder, id],
                selectedMapId: id,
                root: map.root,
                nodes: map.nodes,
                nodePositions: map.nodePositions,
                selectedNodeId: null,
                selectedItemId: null,
                nodeCounter: Math.max(state.nodeCounter, Object.keys(map.nodes).length),
                isDirty: true,
            };
        }

        case 'UPDATE_MAP': {
            const { id, changes } = action.payload || {};
            const map = state.mapsById[id];
            if (!map || !changes || typeof changes !== 'object') return state;
            return {
                ...state,
                mapsById: {
                    ...state.mapsById,
                    [id]: { ...map, ...changes },
                },
                isDirty: true,
            };
        }

        case 'DELETE_MAP': {
            const { id } = action.payload || {};
            if (!id || !state.mapsById[id]) return state;
            if (state.mapOrder.length <= 1) return state; // always keep at least one map

            const { [id]: _deleted, ...remainingMaps } = state.mapsById;
            const remainingOrder = state.mapOrder.filter((mapId) => mapId !== id);
            const nextSelectedMapId = state.selectedMapId === id ? remainingOrder[0] : state.selectedMapId;
            const nextTopRootMapId = state.topRootMapId === id ? remainingOrder[0] : state.topRootMapId;
            const selectedMap = remainingMaps[nextSelectedMapId];

            return {
                ...state,
                mapsById: remainingMaps,
                mapOrder: remainingOrder,
                selectedMapId: nextSelectedMapId,
                topRootMapId: nextTopRootMapId,
                root: selectedMap.root,
                nodes: selectedMap.nodes,
                nodePositions: selectedMap.nodePositions || {},
                selectedNodeId: null,
                isDirty: true,
            };
        }

        case 'SELECT_MAP': {
            const { id } = action.payload || {};
            const selectedMap = state.mapsById[id];
            if (!selectedMap) return state;
            return {
                ...state,
                selectedMapId: id,
                root: selectedMap.root,
                nodes: selectedMap.nodes,
                nodePositions: selectedMap.nodePositions || {},
                selectedNodeId: null,
                selectedItemId: null,
            };
        }

        case 'SET_TOP_ROOT_MAP': {
            const { id } = action.payload || {};
            if (!id || !state.mapsById[id]) return state;
            return {
                ...state,
                topRootMapId: id,
                isDirty: true,
            };
        }

        case 'ADD_NODE': {
            const { id: requestedId, x, y } = action.payload;
            const newCounter = state.nodeCounter + 1;
            const id = requestedId || `NODE_${newCounter}`;
            const normalizedX = normalizeCoordinate(x);
            const normalizedY = normalizeCoordinate(y);
            return {
                ...state,
                nodes: {
                    ...state.nodes,
                    [id]: {
                        id,
                        name: `New Node`,
                        text: '',
                        image: null,
                        actions: [],
                    },
                },
                nodePositions: {
                    ...state.nodePositions,
                    [id]: { x: normalizedX, y: normalizedY },
                },
                selectedNodeId: id,
                isDirty: true,
                nodeCounter: newCounter,
            };
        }

        case 'UPDATE_NODE': {
            const { id, changes } = action.payload;
            const node = state.nodes[id];
            if (!node) return state;
            return {
                ...state,
                nodes: {
                    ...state.nodes,
                    [id]: { ...node, ...changes },
                },
                isDirty: true,
            };
        }

        case 'DELETE_NODE': {
            const { id } = action.payload;
            if (id === state.root) return state; // Cannot delete root node

            const { [id]: _, ...remainingNodes } = state.nodes;
            const { [id]: __, ...remainingPositions } = state.nodePositions;

            // Clean up move actions referencing this node in other nodes
            const cleanedNodes = {};
            for (const [nodeId, node] of Object.entries(remainingNodes)) {
                cleanedNodes[nodeId] = {
                    ...node,
                    actions: removeActionsReferencingNode(node.actions, id),
                };
            }

            return {
                ...state,
                nodes: cleanedNodes,
                nodePositions: remainingPositions,
                selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
                isDirty: true,
            };
        }

        case 'SET_ROOT': {
            const { id } = action.payload;
            if (!state.nodes[id]) return state;
            return {
                ...state,
                root: id,
                isDirty: true,
            };
        }

        case 'MOVE_NODE_POSITION': {
            const { id, x, y } = action.payload;
            if (!state.nodes[id]) return state;
            return {
                ...state,
                nodePositions: {
                    ...state.nodePositions,
                    [id]: {
                        x: normalizeCoordinate(x),
                        y: normalizeCoordinate(y),
                    },
                },
            };
        }

        case 'COMMIT_NODE_POSITION': {
            // Fired on drag end (just triggers a history snapshot before doing nothing here).
            // Actually wait, if the payload contains (x,y), we could merge it, but drag handles the live position.
            // When drag ends, we want to save history. So we just act as a dummy mutation to trigger `pushHistory`.
            return {
                ...state,
                isDirty: true
            };
        }

        case 'SELECT_NODE': {
            return {
                ...state,
                selectedNodeId: action.payload.id,
                selectedItemId: null,
            };
        }

        case 'ADD_ITEM': {
            const { id: requestedItemId, name } = action.payload;
            const newCounter = state.itemCounter + 1;
            const itemId = requestedItemId || `ITEM_new_${newCounter}`;
            return {
                ...state,
                items: {
                    ...state.items,
                    [itemId]: { name: name || 'New Item' },
                },
                selectedItemId: itemId,
                selectedNodeId: null,
                isDirty: true,
                itemCounter: newCounter,
            };
        }

        case 'UPDATE_ITEM': {
            const { id, changes } = action.payload;
            const item = state.items[id];
            if (!item) return state;
            return {
                ...state,
                items: {
                    ...state.items,
                    [id]: { ...item, ...changes },
                },
                isDirty: true,
            };
        }

        case 'DELETE_ITEM': {
            const { id } = action.payload;
            const { [id]: _, ...remainingItems } = state.items;

            // Clean up pickup/has_item references across all nodes
            const cleanedNodes = {};
            for (const [nodeId, node] of Object.entries(state.nodes)) {
                cleanedNodes[nodeId] = {
                    ...node,
                    actions: removeActionsReferencingItem(node.actions, id),
                };
            }

            return {
                ...state,
                items: remainingItems,
                nodes: cleanedNodes,
                selectedItemId: state.selectedItemId === id ? null : state.selectedItemId,
                isDirty: true,
            };
        }

        case 'SELECT_ITEM': {
            return {
                ...state,
                selectedItemId: action.payload.id,
                selectedNodeId: null,
            };
        }

        case 'RENAME_ITEM': {
            const { oldId, newId } = action.payload;
            if (!state.items[oldId] || state.items[newId]) return state;

            // Rebuild items with new key
            const renamedItems = {};
            for (const [itemId, itemData] of Object.entries(state.items)) {
                const key = itemId === oldId ? newId : itemId;
                renamedItems[key] = { ...itemData };
            }

            // Cascade rename through all node actions
            const renamedNodes = {};
            for (const [nodeId, node] of Object.entries(state.nodes)) {
                renamedNodes[nodeId] = {
                    ...node,
                    actions: renameItemInActions(node.actions, oldId, newId),
                };
            }

            return {
                ...state,
                items: renamedItems,
                nodes: renamedNodes,
                selectedItemId: state.selectedItemId === oldId ? newId : state.selectedItemId,
                isDirty: true,
            };
        }

        case 'LOAD_MAP': {
            const { items, root, nodes, nodePositions, _extraTopLevel } = action.payload.state;
            const engineSyncMeta = _extraTopLevel?._engineSync || {};
            const activeMapId = engineSyncMeta.activeMapId || engineSyncMeta.topRootMapId || 'MAP_1';
            const topRootMapId = engineSyncMeta.topRootMapId || activeMapId;

            const activeMap = {
                id: activeMapId,
                name: activeMapId,
                root,
                nodes: nodes || {},
                nodePositions: nodePositions || {},
                _extra: engineSyncMeta.activeMapExtra || {},
            };

            const mapsById = { [activeMapId]: activeMap };
            const mapOrder = [activeMapId];

            for (const rawMap of engineSyncMeta.otherMaps || []) {
                if (!rawMap || typeof rawMap !== 'object' || !rawMap.id || mapsById[rawMap.id]) continue;
                const parsed = normalizeSerializedMap(rawMap);
                mapsById[rawMap.id] = parsed;
                mapOrder.push(rawMap.id);
            }

            return {
                ...state,
                items: items || {},
                root,
                nodes,
                nodePositions: nodePositions || {},
                _extraTopLevel: _extraTopLevel || {},
                mapsById,
                mapOrder,
                selectedMapId: activeMapId,
                topRootMapId,
                selectedNodeId: null,
                selectedItemId: null,
                isDirty: false,
                nodeCounter: Object.keys(nodes).length,
                itemCounter: Object.keys(items || {}).length,
                filePath: action.payload.filename || 'map.json',
                history: {
                    past: [],
                    future: [],
                }
            };
        }

        case 'MARK_SAVED': {
            return {
                ...state,
                isDirty: false,
                filePath: action.payload?.filename || state.filePath,
            };
        }

        case 'SET_EDITOR_CONFIG': {
            const patch = action.payload && typeof action.payload === 'object' ? action.payload : null;
            if (!patch) return state;

            const prevEditor = (state._extraTopLevel && state._extraTopLevel._editor) || {};
            const nextEditor = { ...prevEditor, ...patch };
            const changed = Object.keys(nextEditor).some((key) => nextEditor[key] !== prevEditor[key]);
            if (!changed) return state;

            return {
                ...state,
                _extraTopLevel: {
                    ...(state._extraTopLevel || {}),
                    _editor: nextEditor,
                },
                isDirty: true,
            };
        }

        case 'RENAME_NODE': {
            const { oldId, newId } = action.payload;
            if (!state.nodes[oldId] || state.nodes[newId]) return state;

            // Rebuild nodes with new key
            const renamedNodes = {};
            for (const [nodeId, nodeData] of Object.entries(state.nodes)) {
                const key = nodeId === oldId ? newId : nodeId;
                renamedNodes[key] = {
                    ...nodeData,
                    id: key,
                    actions: renameNodeInActions(nodeData.actions, oldId, newId),
                };
            }

            // Rebuild positions with new key
            const { [oldId]: oldPos, ...restPositions } = state.nodePositions;
            const renamedPositions = {
                ...restPositions,
                [newId]: oldPos || { x: 0, y: 0 },
            };

            return {
                ...state,
                nodes: renamedNodes,
                nodePositions: renamedPositions,
                root: state.root === oldId ? newId : state.root,
                selectedNodeId: state.selectedNodeId === oldId ? newId : state.selectedNodeId,
                isDirty: true,
            };
        }

        case 'ADD_ACTION': {
            const { nodeId, action: newAction } = action.payload;
            const node = state.nodes[nodeId];
            if (!node) return state;
            return {
                ...state,
                nodes: {
                    ...state.nodes,
                    [nodeId]: { ...node, actions: [...node.actions, newAction] },
                },
                isDirty: true,
            };
        }

        case 'UPDATE_ACTION': {
            const { nodeId, index, action: updatedAction } = action.payload;
            const node = state.nodes[nodeId];
            if (!node || index < 0 || index >= node.actions.length) return state;
            const newActions = [...node.actions];
            newActions[index] = { ...node.actions[index], ...updatedAction };
            return {
                ...state,
                nodes: {
                    ...state.nodes,
                    [nodeId]: { ...node, actions: newActions },
                },
                isDirty: true,
            };
        }

        case 'DELETE_ACTION': {
            const { nodeId, index } = action.payload;
            const node = state.nodes[nodeId];
            if (!node || index < 0 || index >= node.actions.length) return state;
            const newActions = node.actions.filter((_, i) => i !== index);
            return {
                ...state,
                nodes: {
                    ...state.nodes,
                    [nodeId]: { ...node, actions: newActions },
                },
                isDirty: true,
            };
        }

        case 'REORDER_ACTIONS': {
            const { nodeId, fromIndex, toIndex } = action.payload;
            const node = state.nodes[nodeId];
            if (!node) return state;
            const newActions = [...node.actions];
            const [moved] = newActions.splice(fromIndex, 1);
            newActions.splice(toIndex, 0, moved);
            return {
                ...state,
                nodes: {
                    ...state.nodes,
                    [nodeId]: { ...node, actions: newActions },
                },
                isDirty: true,
            };
        }

        default:
            return state;
    }
}

function normalizeCoordinate(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.round(numeric) : 0;
}

function normalizeSerializedMap(rawMap) {
    const mapId = rawMap.id;
    const root = rawMap.root || null;
    const nodes = {};

    if (Array.isArray(rawMap.nodes)) {
        for (const node of rawMap.nodes) {
            if (!node || typeof node !== 'object' || !node.id) continue;
            const { id, ...nodeFields } = node;
            nodes[id] = { id, ...nodeFields };
        }
    } else if (rawMap.nodes && typeof rawMap.nodes === 'object') {
        for (const [id, node] of Object.entries(rawMap.nodes)) {
            nodes[id] = { id, ...(node || {}) };
        }
    }

    const { id: _ignoreId, root: _ignoreRoot, nodes: _ignoreNodes, ...extra } = rawMap;
    return {
        id: mapId,
        name: mapId,
        root,
        nodes,
        nodePositions: {},
        _extra: extra,
    };
}

function buildEngineSyncMeta({ selectedMapId, topRootMapId, mapsById, mapOrder }) {
    const order = Array.isArray(mapOrder) ? mapOrder : [];
    const byId = mapsById || {};
    const effectiveSelected = selectedMapId && byId[selectedMapId]
        ? selectedMapId
        : order[0];
    const effectiveTopRoot = topRootMapId && byId[topRootMapId]
        ? topRootMapId
        : effectiveSelected;
    const selectedMap = effectiveSelected ? byId[effectiveSelected] : null;

    const activeMapExtra = selectedMap?._extra && typeof selectedMap._extra === 'object'
        ? selectedMap._extra
        : {};

    const otherMaps = order
        .filter((id) => id !== effectiveSelected)
        .map((id) => {
            const map = byId[id];
            if (!map) return null;
            return {
                id: map.id,
                root: map.root,
                nodes: map.nodes ? Object.values(map.nodes).map((node) => ({ ...node, id: node.id })) : [],
                ...(map._extra || {}),
            };
        })
        .filter(Boolean);

    return {
        activeMapId: effectiveSelected,
        topRootMapId: effectiveTopRoot,
        activeMapRootNodeId: selectedMap?.root || null,
        activeMapExtra,
        otherMaps,
    };
}

function synchronizeMultiMapState(state, actionType) {
    const selectedMapId = state.selectedMapId;
    if (!selectedMapId || !state.mapsById?.[selectedMapId]) {
        return state;
    }

    let nextState = state;
    const skipActiveAliasSync = actionType === 'SELECT_MAP' || actionType === 'LOAD_MAP' || actionType === 'NEW_MAP';

    if (!skipActiveAliasSync) {
        const selectedMap = state.mapsById[selectedMapId];
        const updatedSelectedMap = {
            ...selectedMap,
            root: state.root,
            nodes: state.nodes,
            nodePositions: state.nodePositions,
        };

        if (
            updatedSelectedMap.root !== selectedMap.root ||
            updatedSelectedMap.nodes !== selectedMap.nodes ||
            updatedSelectedMap.nodePositions !== selectedMap.nodePositions
        ) {
            nextState = {
                ...state,
                mapsById: {
                    ...state.mapsById,
                    [selectedMapId]: updatedSelectedMap,
                },
            };
        }
    }

    const nextMeta = buildEngineSyncMeta(nextState);
    const prevMeta = nextState._extraTopLevel?._engineSync;
    const metaChanged = JSON.stringify(prevMeta) !== JSON.stringify(nextMeta);

    if (!metaChanged) return nextState;

    return {
        ...nextState,
        _extraTopLevel: {
            ...(nextState._extraTopLevel || {}),
            _engineSync: nextMeta,
        },
    };
}

export function mapReducer(state, action) {
    if (action.type === 'UNDO') {
        return undo(state);
    }
    if (action.type === 'REDO') {
        return redo(state);
    }

    // Determine if we need to push history BEFORE applying the new state.
    const shouldPushHistory = !HISTORY_IGNORE.has(action.type);

    // Base reducer logic
    const baseState = baseReducer(state, action);
    const nextState = baseState === state ? state : synchronizeMultiMapState(baseState, action.type);

    // Did it actually change?
    if (nextState !== state && shouldPushHistory) {
        // Push the OLD state to history. By design we snapshot before applying the mutation.
        return pushHistory(nextState, state);
    }

    return nextState;
}

// Helper: recursively remove actions that reference a deleted node
function removeActionsReferencingNode(actions, deletedNodeId) {
    return (actions || [])
        .filter(Boolean)
        .map((action) => {
            // New action-choice model
            if (Array.isArray(action.functions)) {
                return {
                    ...action,
                    functions: removeNodeRefsFromFunctions(action.functions, deletedNodeId),
                };
            }

            // Legacy model fallback
            if (action.type === 'if' && action.action) {
                const cleanedNested = removeActionsReferencingNode([action.action], deletedNodeId);
                return {
                    ...action,
                    action: cleanedNested[0],
                };
            }
            return action;
        })
        .filter((action) => {
            if (action.type === 'move' && action.to === deletedNodeId) return false;
            return true;
        });
}

// Helper: recursively remove actions that reference a deleted item
function removeActionsReferencingItem(actions, deletedItemId) {
    return (actions || [])
        .filter(action => {
            if (Array.isArray(action?.functions)) {
                return true;
            }
            if (action.type === 'pickup' && action.item === deletedItemId) return false;
            return true;
        })
        .map(action => {
            if (Array.isArray(action?.functions)) {
                return {
                    ...action,
                    functions: removeItemRefsFromFunctions(action.functions, deletedItemId),
                };
            }
            if (action.type === 'if') {
                const result = { ...action };
                // Clean condition
                if (result.condition?.type === 'has_item' && result.condition.item === deletedItemId) {
                    result.condition = { ...result.condition, item: '' };
                }
                // Clean nested action
                if (result.action) {
                    const cleaned = removeActionsReferencingItem([result.action], deletedItemId);
                    result.action = cleaned.length > 0 ? cleaned[0] : { type: 'return' };
                }
                return result;
            }
            return action;
        });
}

// Helper: rename node references in actions
function renameNodeInActions(actions, oldId, newId) {
    return (actions || []).map(action => {
        if (Array.isArray(action?.functions)) {
            return {
                ...action,
                functions: renameNodeInFunctions(action.functions, oldId, newId),
            };
        }
        if (action.type === 'move' && action.to === oldId) {
            return { ...action, to: newId };
        }
        if (action.type === 'if' && action.action) {
            return {
                ...action,
                action: renameNodeInActions([action.action], oldId, newId)[0],
            };
        }
        return action;
    });
}

// Helper: rename item references in actions
function renameItemInActions(actions, oldId, newId) {
    return (actions || []).map(action => {
        if (Array.isArray(action?.functions)) {
            return {
                ...action,
                functions: renameItemInFunctions(action.functions, oldId, newId),
            };
        }
        if (action.type === 'pickup' && action.item === oldId) {
            return { ...action, item: newId };
        }
        if (action.type === 'if') {
            const result = { ...action };
            if (result.condition?.type === 'has_item' && result.condition.item === oldId) {
                result.condition = { ...result.condition, item: newId };
            }
            if (result.action) {
                result.action = renameItemInActions([result.action], oldId, newId)[0];
            }
            return result;
        }
        return action;
    });
}

function removeNodeRefsFromFunctions(functions, deletedNodeId) {
    return (functions || [])
        .filter(Boolean)
        .map((fn) => {
            const next = { ...fn };
            if (Array.isArray(next.then_functions)) {
                next.then_functions = removeNodeRefsFromFunctions(next.then_functions, deletedNodeId);
            }
            if (Array.isArray(next.else_functions)) {
                next.else_functions = removeNodeRefsFromFunctions(next.else_functions, deletedNodeId);
            }
            if (Array.isArray(next.on_success)) {
                next.on_success = removeNodeRefsFromFunctions(next.on_success, deletedNodeId);
            }
            if (Array.isArray(next.on_failure)) {
                next.on_failure = removeNodeRefsFromFunctions(next.on_failure, deletedNodeId);
            }
            return next;
        })
        .filter((fn) => !(fn.type === 'MoveFunction' && fn.to === deletedNodeId));
}

function removeItemRefsFromFunctions(functions, deletedItemId) {
    return (functions || [])
        .filter(Boolean)
        .map((fn) => {
            const next = { ...fn };
            if (Array.isArray(next.then_functions)) {
                next.then_functions = removeItemRefsFromFunctions(next.then_functions, deletedItemId);
            }
            if (Array.isArray(next.else_functions)) {
                next.else_functions = removeItemRefsFromFunctions(next.else_functions, deletedItemId);
            }
            if (Array.isArray(next.on_success)) {
                next.on_success = removeItemRefsFromFunctions(next.on_success, deletedItemId);
            }
            if (Array.isArray(next.on_failure)) {
                next.on_failure = removeItemRefsFromFunctions(next.on_failure, deletedItemId);
            }
            if (next.type === 'IfFunction' && next.condition?.item === deletedItemId) {
                next.condition = { ...next.condition, item: '' };
            }
            return next;
        })
        .filter((fn) => !(fn.type === 'PickUpItemFunction' && fn.item === deletedItemId));
}

function renameNodeInFunctions(functions, oldId, newId) {
    return (functions || []).map((fn) => {
        const next = { ...fn };
        if (next.type === 'MoveFunction' && next.to === oldId) {
            next.to = newId;
        }
        if (next.type === 'SetVariableFunction' && next.target_node === oldId) {
            next.target_node = newId;
        }
        if (Array.isArray(next.then_functions)) {
            next.then_functions = renameNodeInFunctions(next.then_functions, oldId, newId);
        }
        if (Array.isArray(next.else_functions)) {
            next.else_functions = renameNodeInFunctions(next.else_functions, oldId, newId);
        }
        if (Array.isArray(next.on_success)) {
            next.on_success = renameNodeInFunctions(next.on_success, oldId, newId);
        }
        if (Array.isArray(next.on_failure)) {
            next.on_failure = renameNodeInFunctions(next.on_failure, oldId, newId);
        }
        return next;
    });
}

function renameItemInFunctions(functions, oldId, newId) {
    return (functions || []).map((fn) => {
        const next = { ...fn };
        if (next.type === 'PickUpItemFunction' && next.item === oldId) {
            next.item = newId;
        }
        if (next.type === 'IfFunction' && next.condition?.item === oldId) {
            next.condition = { ...next.condition, item: newId };
        }
        if (Array.isArray(next.then_functions)) {
            next.then_functions = renameItemInFunctions(next.then_functions, oldId, newId);
        }
        if (Array.isArray(next.else_functions)) {
            next.else_functions = renameItemInFunctions(next.else_functions, oldId, newId);
        }
        if (Array.isArray(next.on_success)) {
            next.on_success = renameItemInFunctions(next.on_success, oldId, newId);
        }
        if (Array.isArray(next.on_failure)) {
            next.on_failure = renameItemInFunctions(next.on_failure, oldId, newId);
        }
        return next;
    });
}
