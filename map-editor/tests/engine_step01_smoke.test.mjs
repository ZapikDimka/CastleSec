import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { deserialize } from '../src/io/deserialize.js';

const FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures/engine_sync');

function readFixture(name) {
    return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
}

function loadJsonFixture(name) {
    return JSON.parse(readFixture(name));
}

function assertNewSchemaContract(doc) {
    assert.equal(typeof doc, 'object');
    assert.equal(typeof doc.root, 'string');
    assert.ok(Array.isArray(doc.items), 'items must be an array');
    assert.ok(Array.isArray(doc.maps), 'maps must be an array');
    assert.ok(doc.maps.length > 0, 'maps must contain at least one map');

    for (const item of doc.items) {
        assert.equal(typeof item.id, 'string');
        assert.equal(typeof item.name, 'string');
    }

    for (const map of doc.maps) {
        assert.equal(typeof map.id, 'string');
        assert.equal(typeof map.root, 'string');
        assert.ok(Array.isArray(map.nodes), 'map.nodes must be an array');

        for (const node of map.nodes) {
            assert.equal(typeof node.id, 'string');
            assert.equal(typeof node.name, 'string');
            assert.ok(Array.isArray(node.actions), 'node.actions must be an array');

            for (const action of node.actions) {
                assert.equal(typeof action.label, 'string');
                assert.equal(typeof action.once, 'boolean');
                assert.ok(Array.isArray(action.functions), 'action.functions must be an array');
            }
        }
    }
}

test('step 01: minimal new-schema fixture parses and matches contract', () => {
    const doc = loadJsonFixture('minimal_valid_map.json');
    assertNewSchemaContract(doc);
});

test('step 01: full nested fixture parses and contains nested function branches', () => {
    const doc = loadJsonFixture('full_nested_functions_map.json');
    assertNewSchemaContract(doc);

    const map = doc.maps[0];
    const wellNode = map.nodes.find((node) => node.id === 'NODE_WELL');
    assert.ok(wellNode, 'expected NODE_WELL');

    const openHatch = wellNode.actions.find((action) => action.label === 'Open hatch');
    assert.ok(openHatch, 'expected "Open hatch" action');

    const ifFn = openHatch.functions.find((fn) => fn.type === 'IfFunction');
    assert.ok(ifFn, 'expected IfFunction');
    assert.equal(ifFn.condition.type, 'item_not_collected');
    assert.equal(ifFn.condition.item, 'ITEM_TOKEN');
    assert.ok(Array.isArray(ifFn.then_functions), 'expected then_functions');
    assert.ok(Array.isArray(ifFn.else_functions), 'expected else_functions');

    const solveTask = ifFn.then_functions.find((fn) => fn.type === 'SolveTaskFunction');
    assert.ok(solveTask, 'expected SolveTaskFunction in then_functions');
    assert.ok(Array.isArray(solveTask.on_success), 'expected on_success');
    assert.ok(Array.isArray(solveTask.on_failure), 'expected on_failure');
});

test('step 01: legacy fixture loads through current deserialize without crashing', () => {
    const legacyFixture = readFixture('legacy_input_map.json');
    const state = deserialize(legacyFixture, null);

    assert.equal(typeof state.root, 'string');
    assert.equal(typeof state.nodes, 'object');
    assert.equal(typeof state.items, 'object');
    assert.ok(Object.keys(state.nodes).length > 0, 'expected non-empty nodes');
});
