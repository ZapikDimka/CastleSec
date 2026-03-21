import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { deserialize } from '../src/io/deserialize.js';
import { createInitialState, mapReducer } from '../src/state/mapReducer.js';

const FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures/engine_sync');

function readFixture(name) {
    return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
}

test('step 04: legacy action rows are migrated to action choices on load', () => {
    const legacy = readFixture('legacy_input_map.json');
    const state = deserialize(legacy, null);
    const node = state.nodes.NODE_start;

    assert.ok(Array.isArray(node.actions));
    assert.ok(node.actions.length > 0);

    const first = node.actions[0];
    assert.equal(typeof first.label, 'string');
    assert.equal(typeof first.once, 'boolean');
    assert.ok(Array.isArray(first.functions));
    assert.equal(first.functions[0]?.type, 'MoveFunction');
});

test('step 04: reducer supports adding and updating action choice fields', () => {
    let state = createInitialState();
    const nodeId = state.root;
    const beforeCount = state.nodes[nodeId].actions.length;

    state = mapReducer(state, {
        type: 'ADD_ACTION',
        payload: {
            nodeId,
            action: { label: 'Kick door', once: false, functions: [] },
        },
    });

    assert.equal(state.nodes[nodeId].actions.length, beforeCount + 1);
    const index = state.nodes[nodeId].actions.length - 1;
    assert.equal(state.nodes[nodeId].actions[index].label, 'Kick door');
    assert.equal(state.nodes[nodeId].actions[index].once, false);
    assert.ok(Array.isArray(state.nodes[nodeId].actions[index].functions));

    state = mapReducer(state, {
        type: 'UPDATE_ACTION',
        payload: {
            nodeId,
            index,
            action: {
                label: 'Kick door hard',
                once: true,
                functions: [{ type: 'MoveFunction', to: 'NODE_armory' }],
            },
        },
    });

    const updated = state.nodes[nodeId].actions[index];
    assert.equal(updated.label, 'Kick door hard');
    assert.equal(updated.once, true);
    assert.equal(updated.functions[0]?.type, 'MoveFunction');
});
