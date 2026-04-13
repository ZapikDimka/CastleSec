import test from 'node:test';
import assert from 'node:assert/strict';

import { deserialize } from '../src/io/deserialize.js';
import { serialize } from '../src/io/serialize.js';
import { createInitialState, mapReducer } from '../src/state/mapReducer.js';

function makeUnknownFixture() {
    return JSON.stringify({
        root: 'MAP_MAIN',
        world_seed: 'SEED-11',
        items: [{ id: 'ITEM_1', name: 'Item' }],
        maps: [
            {
                id: 'MAP_MAIN',
                root: 'NODE_MAIN',
                map_meta: { chapter: 1 },
                nodes: [
                    {
                        id: 'NODE_MAIN',
                        name: 'Main',
                        text: 'Hello',
                        debug_color: '#123',
                        actions: [
                            {
                                label: 'Do mixed',
                                once: false,
                                action_meta: { rank: 5 },
                                functions: [
                                    {
                                        type: 'FutureFunction',
                                        foo: 'bar',
                                        nested: { a: 1, b: [1, 2, 3] },
                                    },
                                    {
                                        type: 'MoveFunction',
                                        to: 'NODE_MAIN',
                                        custom_hint: 'keep me',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
        nodePositions: { NODE_MAIN: { x: 10, y: 20 } },
    }, null, 2);
}

test('step 11: unknown function type loads with unknown marker and stays visible in model', () => {
    const state = deserialize(makeUnknownFixture(), null);
    const fn = state.nodes.NODE_MAIN.actions[0].functions[0];

    assert.equal(fn.type, 'FutureFunction');
    assert.equal(fn._unknown, true);
    assert.equal(fn.foo, 'bar');
});

test('step 11: save round-trip preserves unknown payloads and extra properties', () => {
    const inputObj = JSON.parse(makeUnknownFixture());
    const state = deserialize(JSON.stringify(inputObj), null);
    const outputObj = JSON.parse(serialize(state).gameJson);

    assert.equal(outputObj.world_seed, inputObj.world_seed);

    const inNode = inputObj.maps[0].nodes[0];
    const outNode = outputObj.maps[0].nodes.find((n) => n.id === 'NODE_MAIN');
    assert.equal(outNode.debug_color, inNode.debug_color);
    assert.deepEqual(outNode.actions[0].action_meta, inNode.actions[0].action_meta);

    const inUnknownFn = inNode.actions[0].functions[0];
    const outUnknownFn = outNode.actions[0].functions[0];
    assert.deepEqual(outUnknownFn, inUnknownFn);

    const inKnownWithExtra = inNode.actions[0].functions[1];
    const outKnownWithExtra = outNode.actions[0].functions[1];
    assert.equal(outKnownWithExtra.custom_hint, inKnownWithExtra.custom_hint);
});

test('step 11: editing known sibling function does not remove unknown entries', () => {
    const parsed = deserialize(makeUnknownFixture(), null);
    let state = createInitialState();
    state = mapReducer(state, {
        type: 'LOAD_MAP',
        payload: { state: parsed, filename: 'unknown_fixture.json' },
    });

    const nodeId = state.root;
    const actionIndex = 0;
    const before = state.nodes[nodeId].actions[actionIndex];

    const updated = {
        ...before,
        functions: before.functions.map((fn, idx) => (
            idx === 1
                ? { ...fn, to: 'NODE_MAIN' }
                : fn
        )),
    };

    state = mapReducer(state, {
        type: 'UPDATE_ACTION',
        payload: { nodeId, index: actionIndex, action: updated },
    });

    const after = state.nodes[nodeId].actions[actionIndex];
    assert.equal(after.functions.length, 2);
    assert.equal(after.functions[0].type, 'FutureFunction');
    assert.equal(after.functions[0].foo, 'bar');
    assert.equal(after.functions[0]._unknown, true);
});
