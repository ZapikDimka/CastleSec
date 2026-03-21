import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { createInitialState, mapReducer } from '../src/state/mapReducer.js';
import { serialize } from '../src/io/serialize.js';
import { deserialize } from '../src/io/deserialize.js';

const FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures/engine_sync');

function readFixture(name) {
    return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
}

function reduce(state, action) {
    return mapReducer(state, action);
}

test('step 03: map-scoped node edits stay isolated per selected map', () => {
    let state = createInitialState();

    state = reduce(state, { type: 'ADD_MAP', payload: { id: 'MAP_2' } });
    assert.equal(state.selectedMapId, 'MAP_2');

    state = reduce(state, { type: 'ADD_NODE', payload: { id: 'NODE_map2_only', x: 10, y: 20 } });
    assert.ok(state.nodes.NODE_map2_only, 'node must exist in MAP_2 while selected');

    state = reduce(state, { type: 'SELECT_MAP', payload: { id: 'MAP_1' } });
    assert.equal(state.selectedMapId, 'MAP_1');
    assert.equal(state.nodes.NODE_map2_only, undefined, 'MAP_2 node must not appear in MAP_1');

    state = reduce(state, { type: 'ADD_NODE', payload: { id: 'NODE_map1_only', x: 20, y: 30 } });
    assert.ok(state.nodes.NODE_map1_only, 'node must exist in MAP_1 while selected');

    state = reduce(state, { type: 'SELECT_MAP', payload: { id: 'MAP_2' } });
    assert.equal(state.nodes.NODE_map1_only, undefined, 'MAP_1 node must not appear in MAP_2');
    assert.ok(state.nodes.NODE_map2_only, 'MAP_2 node must still exist');
});

test('step 03: serialize emits maps array from multi-map state and respects top root map', () => {
    let state = createInitialState();
    state = reduce(state, { type: 'ADD_MAP', payload: { id: 'MAP_2' } });
    state = reduce(state, { type: 'SET_TOP_ROOT_MAP', payload: { id: 'MAP_2' } });

    const out = JSON.parse(serialize(state).gameJson);
    assert.equal(out.root, 'MAP_2');
    assert.ok(Array.isArray(out.maps));
    assert.ok(out.maps.find((m) => m.id === 'MAP_1'));
    assert.ok(out.maps.find((m) => m.id === 'MAP_2'));
});

test('step 03: LOAD_MAP builds map list and SELECT_MAP swaps map scope', () => {
    const parsed = deserialize(readFixture('roundtrip_unknowns_map.json'), null);
    let state = createInitialState();

    state = reduce(state, { type: 'LOAD_MAP', payload: { state: parsed, filename: 'roundtrip_unknowns_map.json' } });
    assert.ok(state.mapOrder.includes('MAP_MAIN'));
    assert.ok(state.mapOrder.includes('MAP_SIDE'));
    assert.equal(state.selectedMapId, 'MAP_MAIN');
    assert.ok(state.nodes.NODE_MAIN);

    state = reduce(state, { type: 'SELECT_MAP', payload: { id: 'MAP_SIDE' } });
    assert.equal(state.selectedMapId, 'MAP_SIDE');
    assert.ok(state.nodes.NODE_SIDE);
    assert.equal(state.nodes.NODE_MAIN, undefined);
});
