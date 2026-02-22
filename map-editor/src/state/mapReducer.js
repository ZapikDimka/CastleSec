// ============================================
// Map Reducer — all map state mutations
// ============================================

let nodeCounter = 0;

export function createInitialState() {
    const rootId = 'NODE_root';
    nodeCounter = 3;

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
    };
}

function generateNodeId() {
    nodeCounter++;
    return `NODE_${nodeCounter}`;
}

export function mapReducer(state, action) {
    switch (action.type) {
        case 'NEW_MAP':
            return createInitialState();

        case 'ADD_NODE': {
            const { id: requestedId, x, y } = action.payload;
            const id = requestedId || generateNodeId();
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
                    [id]: { x, y },
                },
                selectedNodeId: id,
                isDirty: true,
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
            return {
                ...state,
                nodePositions: {
                    ...state.nodePositions,
                    [id]: { x, y },
                },
            };
        }

        case 'SELECT_NODE': {
            return {
                ...state,
                selectedNodeId: action.payload.id,
            };
        }

        case 'LOAD_MAP': {
            const { items, root, nodes, nodePositions, _extraTopLevel } = action.payload;
            // Sync nodeCounter to avoid ID collisions
            nodeCounter = Object.keys(nodes).length;
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
            };
        }

        case 'MARK_SAVED': {
            return {
                ...state,
                isDirty: false,
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
            const renamedPositions = { ...restPositions, [newId]: oldPos };

            return {
                ...state,
                nodes: renamedNodes,
                nodePositions: renamedPositions,
                root: state.root === oldId ? newId : state.root,
                selectedNodeId: state.selectedNodeId === oldId ? newId : state.selectedNodeId,
                isDirty: true,
            };
        }

        default:
            return state;
    }
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

