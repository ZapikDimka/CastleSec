import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState, mapReducer } from '../src/state/mapReducer.js';
import { serialize } from '../src/io/serialize.js';
import { deserialize } from '../src/io/deserialize.js';
import { validate } from '../src/validation/validate.js';

function reduce(state, action) {
    return mapReducer(state, action);
}

test('step 07: reducer stores ShowHintTextFunction and InspectFunction fields', () => {
    let state = createInitialState();
    const nodeId = state.root;

    state = reduce(state, {
        type: 'ADD_ACTION',
        payload: {
            nodeId,
            action: {
                label: 'Scenario text actions',
                once: false,
                functions: [
                    { type: 'ShowHintTextFunction', text: 'Use the blue key.', once: true },
                    {
                        type: 'InspectFunction',
                        title: 'Ancient tablet',
                        content: 'Symbols glow when touched.',
                        once: false,
                    },
                ],
            },
        },
    });

    const created = state.nodes[nodeId].actions[state.nodes[nodeId].actions.length - 1];
    assert.equal(created.functions[0].type, 'ShowHintTextFunction');
    assert.equal(created.functions[0].text, 'Use the blue key.');
    assert.equal(created.functions[0].once, true);

    assert.equal(created.functions[1].type, 'InspectFunction');
    assert.equal(created.functions[1].title, 'Ancient tablet');
    assert.equal(created.functions[1].content, 'Symbols glow when touched.');
    assert.equal(created.functions[1].once, false);
});

test('step 07: serialize/deserialize preserves multiline hint and inspect content', () => {
    let state = createInitialState();
    const nodeId = state.root;

    const action = {
        label: 'Multiline preserve',
        once: false,
        functions: [
            {
                type: 'ShowHintTextFunction',
                text: 'Line one\nLine two\nLine three',
                once: false,
            },
            {
                type: 'InspectFunction',
                title: 'Letter',
                content: 'Dear hero,\nFind the hidden passage.\nSigned: Keeper',
                once: true,
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

test('step 07: validation reports missing required hint/inspect fields', () => {
    let state = createInitialState();
    const nodeId = state.root;

    state = reduce(state, {
        type: 'ADD_ACTION',
        payload: {
            nodeId,
            action: {
                label: 'Invalid scenario text actions',
                once: false,
                functions: [
                    { type: 'ShowHintTextFunction', text: '   ', once: false },
                    { type: 'InspectFunction', title: '', content: '   ', once: false },
                ],
            },
        },
    });

    const issues = validate(state).get(nodeId) || [];
    const ids = issues.map((issue) => issue.id).sort();

    assert.ok(ids.includes('V-11'));
    assert.ok(ids.includes('V-12'));
    assert.ok(ids.includes('V-13'));
});
