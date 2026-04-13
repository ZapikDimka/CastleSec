import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { deserialize } from '../src/io/deserialize.js';
import { serialize } from '../src/io/serialize.js';

const FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures/engine_sync');

function readFixture(name) {
    return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
}

test('step 02: legacy input serializes to engine arrays with explicit ids', () => {
    const legacy = readFixture('legacy_input_map.json');
    const state = deserialize(legacy, null);
    const output = JSON.parse(serialize(state).gameJson);

    assert.equal(typeof output.root, 'string', 'root must be map id in output');
    assert.ok(Array.isArray(output.items), 'items must be array');
    assert.ok(Array.isArray(output.maps), 'maps must be array');
    assert.ok(output.maps.length >= 1, 'maps must contain active map');

    for (const item of output.items) {
        assert.equal(typeof item.id, 'string', 'each item must have id');
    }

    const activeMap = output.maps[0];
    assert.equal(typeof activeMap.id, 'string');
    assert.equal(typeof activeMap.root, 'string');
    assert.ok(Array.isArray(activeMap.nodes), 'active map nodes must be array');
    for (const node of activeMap.nodes) {
        assert.equal(typeof node.id, 'string', 'each node must have id');
    }
});

test('step 02: round-trip preserves unknown top-level and extra maps', () => {
    const raw = readFixture('roundtrip_unknowns_map.json');
    const state = deserialize(raw, null);
    const output = JSON.parse(serialize(state).gameJson);

    // top-level unknown
    assert.equal(output.world_seed, 'SEED-42');

    // active map unknown
    const main = output.maps.find((m) => m.id === 'MAP_MAIN');
    assert.ok(main, 'expected MAP_MAIN');
    assert.equal(main.theme, 'copper');

    // non-active map preserved untouched
    const side = output.maps.find((m) => m.id === 'MAP_SIDE');
    assert.ok(side, 'expected MAP_SIDE to be preserved');
    assert.equal(side.region, 'backup');
    assert.equal(side.nodes?.[0]?.id, 'NODE_SIDE');
});

test('step 02: deserialize uses map root as editor root node id for new schema', () => {
    const raw = readFixture('minimal_valid_map.json');
    const state = deserialize(raw, null);

    assert.equal(state.root, 'NODE_GATE');
    assert.ok(state.nodes.NODE_GATE);
    assert.ok(state.nodes.NODE_COURTYARD);
});
