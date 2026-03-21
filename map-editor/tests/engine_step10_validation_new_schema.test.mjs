import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState, mapReducer } from '../src/state/mapReducer.js';
import { validate } from '../src/validation/validate.js';

function reduce(state, action) {
    return mapReducer(state, action);
}

test('step 10: validates top root map existence and per-map root node references', () => {
    let state = createInitialState();
    state = reduce(state, { type: 'ADD_MAP', payload: { id: 'MAP_2' } });

    state = {
        ...state,
        topRootMapId: 'MAP_missing',
        mapsById: {
            ...state.mapsById,
            MAP_2: {
                ...state.mapsById.MAP_2,
                root: 'NODE_missing',
            },
        },
    };

    const results = validate(state);
    const mapIssues = results.get('map') || [];
    const map2Issues = results.get('MAP_2') || [];

    assert.ok(mapIssues.some((i) => i.id === 'V-17'));
    assert.ok(map2Issues.some((i) => i.id === 'V-18'));
});

test('step 10: validates required new-schema action/function fields recursively', () => {
    let state = createInitialState();
    const nodeId = state.root;

    state = reduce(state, {
        type: 'ADD_ACTION',
        payload: {
            nodeId,
            action: {
                label: '   ', // invalid
                once: false,
                functions: [
                    { type: 'MoveFunction', to: 'NODE_missing' }, // invalid ref
                    { type: 'PickUpItemFunction', item: 'ITEM_missing' }, // invalid ref
                    {
                        type: 'IfFunction',
                        condition: { type: 'has_item', item: '' }, // missing item
                        then_functions: [],
                        else_functions: [],
                    },
                    {
                        type: 'SolveTaskFunction',
                        task: '',
                        on_success: [],
                        on_failure: [],
                    },
                ],
            },
        },
    });

    const issues = validate(state).get(nodeId) || [];
    const ids = new Set(issues.map((i) => i.id));

    assert.ok(ids.has('V-10')); // action label
    assert.ok(ids.has('V-02')); // move ref
    assert.ok(ids.has('V-03')); // pickup ref
    assert.ok(ids.has('V-04')); // if condition item
    assert.ok(ids.has('V-22')); // solve task required task
});

test('step 10: fixing invalid references clears errors without reload', () => {
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
                label: '',
                once: false,
                functions: [
                    { type: 'MoveFunction', to: 'NODE_missing' },
                    { type: 'PickUpItemFunction', item: 'ITEM_missing' },
                    {
                        type: 'IfFunction',
                        condition: { type: 'item_used', item: '' },
                        then_functions: [],
                        else_functions: [],
                    },
                ],
            },
        },
    });

    let ids = new Set((validate(state).get(nodeId) || []).map((i) => i.id));
    assert.ok(ids.has('V-10'));
    assert.ok(ids.has('V-02'));
    assert.ok(ids.has('V-03'));
    assert.ok(ids.has('V-04'));

    const index = state.nodes[nodeId].actions.length - 1;
    state = reduce(state, {
        type: 'UPDATE_ACTION',
        payload: {
            nodeId,
            index,
            action: {
                label: 'Fixed action',
                once: false,
                functions: [
                    { type: 'MoveFunction', to: 'NODE_armory' },
                    { type: 'PickUpItemFunction', item: 'ITEM_key' },
                    {
                        type: 'IfFunction',
                        condition: { type: 'item_used', item: 'ITEM_key' },
                        then_functions: [{ type: 'MoveFunction', to: 'NODE_throne' }],
                        else_functions: [],
                    },
                ],
            },
        },
    });

    ids = new Set((validate(state).get(nodeId) || []).map((i) => i.id));
    assert.ok(!ids.has('V-10'));
    assert.ok(!ids.has('V-02'));
    assert.ok(!ids.has('V-03'));
    assert.ok(!ids.has('V-04'));
});
