import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState, mapReducer } from '../src/state/mapReducer.js';
import { serialize } from '../src/io/serialize.js';
import { deserialize } from '../src/io/deserialize.js';

function reduce(state, action) {
    return mapReducer(state, action);
}

test('step 05: action choice can store ordered Move + PickUp functions', () => {
    let state = createInitialState();
    const nodeId = state.root;

    state = reduce(state, {
        type: 'ADD_ACTION',
        payload: {
            nodeId,
            action: {
                label: 'Move and loot',
                once: false,
                functions: [
                    { type: 'MoveFunction', to: 'NODE_armory' },
                    { type: 'PickUpItemFunction', item: 'ITEM_key' },
                ],
            },
        },
    });

    const created = state.nodes[nodeId].actions[state.nodes[nodeId].actions.length - 1];
    assert.deepEqual(created.functions, [
        { type: 'MoveFunction', to: 'NODE_armory' },
        { type: 'PickUpItemFunction', item: 'ITEM_key' },
    ]);
});

test('step 05: reducer update supports nested SolveTask branches and function reorder', () => {
    let state = createInitialState();
    const nodeId = state.root;

    state = reduce(state, {
        type: 'ADD_ACTION',
        payload: {
            nodeId,
            action: { label: 'Quest', once: false, functions: [] },
        },
    });

    const index = state.nodes[nodeId].actions.length - 1;
    const updatedAction = {
        label: 'Quest',
        once: false,
        functions: [
            {
                type: 'SolveTaskFunction',
                task: 'open_gate',
                on_success: [
                    { type: 'PickUpItemFunction', item: 'ITEM_badge' },
                    { type: 'MoveFunction', to: 'NODE_throne' },
                ],
                on_failure: [
                    { type: 'MoveFunction', to: 'NODE_root' },
                ],
            },
            { type: 'MoveFunction', to: 'NODE_armory' },
        ],
    };

    state = reduce(state, {
        type: 'UPDATE_ACTION',
        payload: { nodeId, index, action: updatedAction },
    });

    const stored = state.nodes[nodeId].actions[index];
    assert.equal(stored.functions[0].type, 'SolveTaskFunction');
    assert.equal(stored.functions[0].on_success[0].type, 'PickUpItemFunction');
    assert.equal(stored.functions[0].on_success[1].type, 'MoveFunction');
    assert.equal(stored.functions[1].type, 'MoveFunction');

    const reordered = {
        ...stored,
        functions: [stored.functions[1], stored.functions[0]],
    };

    state = reduce(state, {
        type: 'UPDATE_ACTION',
        payload: { nodeId, index, action: reordered },
    });

    const afterReorder = state.nodes[nodeId].actions[index];
    assert.equal(afterReorder.functions[0].type, 'MoveFunction');
    assert.equal(afterReorder.functions[1].type, 'SolveTaskFunction');
    assert.equal(afterReorder.functions[1].on_failure[0].to, 'NODE_root');
});

test('step 05: serialize + deserialize preserve function order and nested branches', () => {
    let state = createInitialState();
    const nodeId = state.root;

    const action = {
        label: 'Nested test',
        once: true,
        functions: [
            { type: 'MoveFunction', to: 'NODE_armory' },
            {
                type: 'SolveTaskFunction',
                task: 'door_riddle',
                on_success: [
                    { type: 'PickUpItemFunction', item: 'ITEM_key' },
                    { type: 'MoveFunction', to: 'NODE_throne' },
                ],
                on_failure: [
                    { type: 'MoveFunction', to: 'NODE_root' },
                ],
            },
            { type: 'PickUpItemFunction', item: 'ITEM_scroll' },
        ],
    };

    state = reduce(state, {
        type: 'ADD_ACTION',
        payload: { nodeId, action },
    });

    const before = state.nodes[nodeId].actions[state.nodes[nodeId].actions.length - 1];
    const out = serialize(state);
    const loaded = deserialize(out.gameJson, null);
    const after = loaded.nodes[nodeId].actions[loaded.nodes[nodeId].actions.length - 1];

    assert.deepEqual(after, before);
});
