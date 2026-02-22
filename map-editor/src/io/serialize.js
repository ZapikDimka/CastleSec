/**
 * Converts the editor's in-memory state back into two JSON payloads:
 * - gameJson: The main map data for the game engine
 * - editorJson: The sidecar file containing node positions
 */
export function serialize(state) {
    const { items, root, nodes, nodePositions, _extraTopLevel } = state;

    // 1. Serialize Items
    const serializedItems = {};
    for (const [itemId, item] of Object.entries(items)) {
        const itemCopy = { ...item };
        // Omit empty image
        if (!itemCopy.image) {
            delete itemCopy.image;
        }
        serializedItems[itemId] = itemCopy;
    }

    // 2. Serialize Nodes
    const serializedNodes = {};
    for (const [nodeId, node] of Object.entries(nodes)) {
        const nodeCopy = { ...node };
        // Omit empty image
        if (!nodeCopy.image) {
            delete nodeCopy.image;
        }

        // Ensure actions is always an array and strip out any editor-only flags if we added any
        if (!Array.isArray(nodeCopy.actions)) {
            nodeCopy.actions = [];
        } else {
            // Remove the _unknown flag we might have added during deserialization
            nodeCopy.actions = nodeCopy.actions.map(action => {
                const a = { ...action };
                delete a._unknown;

                // If it's an 'if' action, clean the condition too
                if (a.type === 'if' && a.condition) {
                    a.condition = { ...a.condition };
                    delete a.condition._unknown;
                }
                return a;
            });
        }

        serializedNodes[nodeId] = nodeCopy;
    }

    // 3. Assemble Game JSON
    const gameData = {
        items: serializedItems,
        root,
        nodes: serializedNodes,
        ...(_extraTopLevel || {}) // spread unknown top-level keys
    };

    // 4. Assemble Editor JSON
    const editorData = {
        nodePositions
    };

    return {
        gameJson: JSON.stringify(gameData, null, 2),
        editorJson: JSON.stringify(editorData, null, 2)
    };
}
