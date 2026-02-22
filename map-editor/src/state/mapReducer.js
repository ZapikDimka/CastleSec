// ============================================
// Map Reducer — all map state mutations
// ============================================

let nodeCounter = 0;

export function createInitialState() {
    const rootId = 'NODE_root';
    nodeCounter = 1;

    return {
        // ----- Map Data (serialized to JSON) -----
        items: {},
        root: rootId,
        nodes: {
            [rootId]: {
                name: 'Root Node',
                text: 'Starting point of the map.',
                image: null,
                actions: [],
            },
        },

        // ----- Editor-Only State -----
        nodePositions: {
            [rootId]: { x: 0, y: 0 },
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
            // If the nested action references the deleted node, remove the whole if
            if (action.action.type === 'move' && action.action.to === deletedNodeId) {
                return false;
            }
        }
        return true;
    });
}
