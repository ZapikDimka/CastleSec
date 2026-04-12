const HISTORY_LIMIT = 50;

/**
 * Creates a snapshot of the current map state.
 * @param {Object} state - The current state.
 * @returns {Object} A snapshot containing just the serializable map data.
 */
function createSnapshot(state) {
    return {
        items: state.items,
        root: state.root,
        nodes: state.nodes,
        nodePositions: state.nodePositions,
        mapsById: state.mapsById,
        mapOrder: state.mapOrder,
        selectedMapId: state.selectedMapId,
        topRootMapId: state.topRootMapId,
        _extraTopLevel: state._extraTopLevel,
    };
}

/**
 * Pushes a new snapshot onto the past stack, clears the future stack,
 * and enforces the size limit.
 */
export function pushHistory(state) {
    const snapshot = createSnapshot(state);
    const newPast = [...state.history.past, snapshot];
    if (newPast.length > HISTORY_LIMIT) {
        newPast.shift(); // Remove oldest
    }

    return {
        ...state,
        history: {
            past: newPast,
            future: [],
        }
    };
}

/**
 * Pops the most recent snapshot from the past stack,
 * pushes the current state to the future stack,
 * and restores the map data from the popped snapshot.
 */
export function undo(state) {
    const past = [...state.history.past];
    if (past.length === 0) return state;

    const previousSnapshot = past.pop();
    const currentSnapshot = createSnapshot(state);

    return {
        ...state,
        ...previousSnapshot,
        isDirty: true,
        history: {
            past,
            future: [currentSnapshot, ...state.history.future],
        }
    };
}

/**
 * Pops the most recent snapshot from the future stack,
 * pushes the current state to the past stack,
 * and restores the map data from the popped snapshot.
 */
export function redo(state) {
    const future = [...state.history.future];
    if (future.length === 0) return state;

    const nextSnapshot = future.shift();
    const currentSnapshot = createSnapshot(state);

    // push current map state onto past stack
    const newPast = [...state.history.past, currentSnapshot];
    if (newPast.length > HISTORY_LIMIT) {
        newPast.shift(); // Remove oldest
    }

    return {
        ...state,
        ...nextSnapshot,
        isDirty: true,
        history: {
            past: newPast,
            future,
        }
    };
}
