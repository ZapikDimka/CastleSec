import { pushHistory, undo, redo } from './history';

// ============================================
// Map Reducer — all map state mutations
// ============================================

export function createInitialState() {
    const rootId = 'NODE_root';

    return {
        // ----- Map Data (serialized to JSON) -----
        items: {},
        root: rootId,
        nodes: {
            [rootId]: {
                name: 'Entrance Hall',
                text: 'Starting point of the map.',
                image: null,
                actions: [
                    { type: 'move', to: 'NODE_armory' },
                    {
                        type: 'if',
                        condition: { type: 'has_item', item: 'ITEM_key' },
                        action: { type: 'move', to: 'NODE_throne' },
                    },
                ],
            },
            NODE_armory: {
                name: 'Armory',
                text: 'Weapons line the walls.',
                image: null,
                actions: [
                    { type: 'move', to: rootId },
                    { type: 'move', to: 'NODE_throne' },
                ],
            },
            NODE_throne: {
                name: 'Throne Room',
                text: 'The king sits here.',
                image: null,
                actions: [
                    { type: 'move', to: 'NODE_throne' },
                ],
            },
        },

        // ----- Editor-Only State -----
        nodePositions: {
            [rootId]: { x: 0, y: 0 },
            NODE_armory: { x: 300, y: 0 },
            NODE_throne: { x: 150, y: 200 },
        },
        selectedNodeId: null,
        selectedItemId: null,
        filePath: null,
        isDirty: false,
        _extraTopLevel: {},
        nodeCounter: 3,
        itemCounter: 0,
        history: {
            past: [],
            future: [],
        }
    };
}

// Actions that mutate state but shouldn't create undo snapshots.
const HISTORY_IGNORE = new Set([
    'SELECT_NODE',
    'SELECT_ITEM',
    'MARK_SAVED',
    'MOVE_NODE_POSITION',
    'LOAD_MAP',
    'NEW_MAP',
]);

function baseReducer(state, action) {
    switch (action.type) {
        case 'NEW_MAP':
            return createInitialState();

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
            return {
                ...state,
                items: items || {},
                root,
                nodes,
                nodePositions: nodePositions || {},
                _extraTopLevel: _extraTopLevel || {},
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

        case 'RENAME_NODE': {
            const { oldId, newId } = action.payload;
            if (!state.nodes[oldId] || state.nodes[newId]) return state;

            // Rebuild nodes with new key
            const renamedNodes = {};
            for (const [nodeId, nodeData] of Object.entries(state.nodes)) {
                const key = nodeId === oldId ? newId : nodeId;
                renamedNodes[key] = {
                    ...nodeData,
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
    const nextState = baseReducer(state, action);

    // Did it actually change?
    if (nextState !== state && shouldPushHistory) {
        // Push the OLD state to history. By design we snapshot before applying the mutation.
        return pushHistory(nextState, state);
    }

    return nextState;
}

// Helper: recursively remove actions that reference a deleted node
function removeActionsReferencingNode(actions, deletedNodeId) {
    return actions.filter(action => {
        if (action.type === 'move' && action.to === deletedNodeId) {
            return false;
        }
        if (action.type === 'if' && action.action) {
            if (action.action.type === 'move' && action.action.to === deletedNodeId) {
                return false;
            }
        }
        return true;
    });
}

// Helper: recursively remove actions that reference a deleted item
function removeActionsReferencingItem(actions, deletedItemId) {
    return actions
        .filter(action => {
            if (action.type === 'pickup' && action.item === deletedItemId) return false;
            return true;
        })
        .map(action => {
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
    return actions.map(action => {
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
    return actions.map(action => {
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
