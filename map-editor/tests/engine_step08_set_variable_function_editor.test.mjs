import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState, mapReducer } from '../src/state/mapReducer.js';
import { serialize } from '../src/io/serialize.js';
import { deserialize } from '../src/io/deserialize.js';
import { validate } from '../src/validation/validate.js';

function reduce(state, action) {
    return mapReducer(state, action);
}

test('step 08: reducer stores SetVariableFunction for current and other node targets', () => {
    let state = createInitialState();
    const nodeId = state.root;

    state = reduce(state, {
        type: 'ADD_ACTION',
        payload: {
            nodeId,
            action: {
                label: 'Mutate runtime node fields',
                once: false,
                functions: [
                    {
                        type: 'SetVariableFunction',
                        target_node: null,
                        variable: 'text',
                        value: 'Current node text update.',
                    },
                    {
                        type: 'SetVariableFunction',
                        target_node: 'NODE_armory',
                        variable: 'name',
                        value: 'Armory (opened)',
                    },
                ],
            },
        },
    });

    const created = state.nodes[nodeId].actions[state.nodes[nodeId].actions.length - 1];
    assert.equal(created.functions[0].target_node, null);
    assert.equal(created.functions[0].variable, 'text');
    assert.equal(created.functions[0].value, 'Current node text update.');
    assert.equal(created.functions[1].target_node, 'NODE_armory');
    assert.equal(created.functions[1].variable, 'name');
});

test('step 08: serialize output keeps SetVariableFunction argument names exactly', () => {
    let state = createInitialState();
    const nodeId = state.root;
    const fn = {
        type: 'SetVariableFunction',
        target_node: 'NODE_throne',
        variable: 'image',
        value: 'assets/throne_broken.png',
    };

    state = reduce(state, {
        type: 'ADD_ACTION',
        payload: {
            nodeId,
            action: { label: 'Set image', once: false, functions: [fn] },
        },
    });

    const out = JSON.parse(serialize(state).gameJson);
    const activeMap = out.maps.find((m) => m.id === out.root);
    const node = activeMap.nodes.find((n) => n.id === nodeId);
    const savedFn = node.actions[node.actions.length - 1].functions[0];

    assert.deepEqual(savedFn, fn);
    assert.ok(Object.prototype.hasOwnProperty.call(savedFn, 'target_node'));
    assert.ok(Object.prototype.hasOwnProperty.call(savedFn, 'variable'));
    assert.ok(Object.prototype.hasOwnProperty.call(savedFn, 'value'));
});

test('step 08: roundtrip preserves SetVariableFunction with null target and custom variable', () => {
    let state = createInitialState();
    const nodeId = state.root;

    const action = {
        label: 'Custom variable write',
        once: false,
        functions: [
            {
                type: 'SetVariableFunction',
                target_node: null,
                variable: 'custom_runtime_flag',
                value: 'enabled',
            },
        ],
    };

    state = reduce(state, { type: 'ADD_ACTION', payload: { nodeId, action } });
    const before = state.nodes[nodeId].actions[state.nodes[nodeId].actions.length - 1];

    const out = serialize(state);
    const loaded = deserialize(out.gameJson, null);
    const after = loaded.nodes[nodeId].actions[loaded.nodes[nodeId].actions.length - 1];

    assert.deepEqual(after, before);
});

test('step 08: validation reports missing SetVariableFunction value/variable and bad target', () => {
    let state = createInitialState();
    const nodeId = state.root;

    state = reduce(state, {
        type: 'ADD_ACTION',
        payload: {
            nodeId,
            action: {
                label: 'Invalid set variable',
                once: false,
                functions: [
                    {
                        type: 'SetVariableFunction',
                        target_node: 'NODE_missing',
                        variable: '',
                        value: '   ',
                    },
                ],
            },
        },
    });

    const ids = (validate(state).get(nodeId) || []).map((issue) => issue.id);
    assert.ok(ids.includes('V-14'));
    assert.ok(ids.includes('V-15'));
    assert.ok(ids.includes('V-16'));
});
