import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState, mapReducer } from '../src/state/mapReducer.js';
import { serialize } from '../src/io/serialize.js';
import { deserialize } from '../src/io/deserialize.js';
import { validate } from '../src/validation/validate.js';

function reduce(state, action) {
    return mapReducer(state, action);
}

test('step 06: reducer stores IfFunction with supported condition types', () => {
    let state = createInitialState();
    const nodeId = state.root;

    state = reduce(state, {
        type: 'ADD_ACTION',
        payload: {
            nodeId,
            action: {
                label: 'If chain',
                once: false,
                functions: [
                    {
                        type: 'IfFunction',
                        condition: { type: 'has_item', item: 'ITEM_key' },
                        then_functions: [{ type: 'MoveFunction', to: 'NODE_armory' }],
                        else_functions: [],
                    },
                    {
                        type: 'IfFunction',
                        condition: { type: 'item_used', item: 'ITEM_key' },
                        then_functions: [{ type: 'MoveFunction', to: 'NODE_throne' }],
                        else_functions: [],
                    },
                    {
                        type: 'IfFunction',
                        condition: { type: 'item_not_collected', item: 'ITEM_token' },
                        then_functions: [{ type: 'PickUpItemFunction', item: 'ITEM_token' }],
                        else_functions: [],
                    },
                ],
            },
        },
    });

    const created = state.nodes[nodeId].actions[state.nodes[nodeId].actions.length - 1];
    assert.equal(created.functions[0].condition.type, 'has_item');
    assert.equal(created.functions[1].condition.type, 'item_used');
    assert.equal(created.functions[2].condition.type, 'item_not_collected');
});

test('step 06: roundtrip preserves recursive IfFunction nesting and SolveTask branches', () => {
    let state = createInitialState();
    const nodeId = state.root;

    const action = {
        label: 'Recursive conditions',
        once: false,
        functions: [
            {
                type: 'IfFunction',
                condition: { type: 'has_item', item: 'ITEM_key' },
                then_functions: [
                    {
                        type: 'IfFunction',
                        condition: { type: 'item_used', item: 'ITEM_key' },
                        then_functions: [{ type: 'MoveFunction', to: 'NODE_throne' }],
                        else_functions: [{ type: 'MoveFunction', to: 'NODE_armory' }],
                    },
                ],
                else_functions: [],
            },
            {
                type: 'SolveTaskFunction',
                task: 'unlock_gate',
                on_success: [
                    {
                        type: 'IfFunction',
                        condition: { type: 'item_not_collected', item: 'ITEM_badge' },
                        then_functions: [{ type: 'PickUpItemFunction', item: 'ITEM_badge' }],
                        else_functions: [],
                    },
                ],
                on_failure: [],
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

test('step 06: validation checks item refs for all supported IfFunction conditions', () => {
    let state = createInitialState();
    const nodeId = state.root;
    state = {
        ...state,
        items: {
            ITEM_key: { name: 'Key' },
        },
    };

    state = reduce(state, {
        type: 'ADD_ACTION',
        payload: {
            nodeId,
            action: {
                label: 'Validate conditions',
                once: false,
                functions: [
                    {
                        type: 'IfFunction',
                        condition: { type: 'item_used', item: 'ITEM_missing' },
                        then_functions: [],
                        else_functions: [],
                    },
                    {
                        type: 'IfFunction',
                        condition: { type: 'item_not_collected', item: '' },
                        then_functions: [],
                        else_functions: [],
                    },
                ],
            },
        },
    });

    const results = validate(state);
    const nodeIssues = results.get(nodeId) || [];
    const conditionErrors = nodeIssues.filter((issue) => issue.id === 'V-04');
    assert.equal(conditionErrors.length, 2);
});
