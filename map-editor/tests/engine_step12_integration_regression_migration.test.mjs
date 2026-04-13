import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { deserialize } from '../src/io/deserialize.js';
import { serialize } from '../src/io/serialize.js';
import { createInitialState, mapReducer } from '../src/state/mapReducer.js';

const FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures/engine_sync');
const APPROVED_FUNCTION_TYPES = new Set([
    'MoveFunction',
    'PickUpItemFunction',
    'SolveTaskFunction',
    'SetVariableFunction',
    'IfFunction',
    'ShowHintTextFunction',
    'InspectFunction',
]);
const APPROVED_IF_CONDITIONS = new Set(['has_item', 'item_used', 'item_not_collected']);

function readFixture(name) {
    return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
}

function collectFunctions(functions, out = []) {
    for (const fn of functions || []) {
        if (!fn) continue;
        out.push(fn);
        if (fn.type === 'IfFunction') {
            collectFunctions(fn.then_functions || [], out);
            collectFunctions(fn.else_functions || [], out);
        }
        if (fn.type === 'SolveTaskFunction') {
            collectFunctions(fn.on_success || [], out);
            collectFunctions(fn.on_failure || [], out);
        }
    }
    return out;
}

test('step 12: scenario-style flow matrix is representable with approved function set only', () => {
    const scenarioLike = {
        root: 'MAP_MAIN',
        items: [
            { id: 'ITEM_LENS', name: 'Debugger Lens' },
            { id: 'ITEM_KEY', name: 'Key' },
            { id: 'ITEM_TOKEN', name: 'Token' },
        ],
        maps: [
            {
                id: 'MAP_MAIN',
                root: 'NODE_GATE',
                nodes: [
                    {
                        id: 'NODE_GATE',
                        name: 'Gate',
                        text: 'Gate text',
                        actions: [
                            {
                                label: 'Use lens',
                                once: false,
                                functions: [
                                    {
                                        type: 'IfFunction',
                                        condition: { type: 'item_used', item: 'ITEM_LENS' },
                                        then_functions: [{ type: 'MoveFunction', to: 'NODE_PATH' }],
                                        else_functions: [],
                                    },
                                    {
                                        type: 'IfFunction',
                                        condition: { type: 'has_item', item: 'ITEM_KEY' },
                                        then_functions: [{ type: 'MoveFunction', to: 'NODE_PATH' }],
                                        else_functions: [],
                                    },
                                    {
                                        type: 'IfFunction',
                                        condition: { type: 'item_not_collected', item: 'ITEM_TOKEN' },
                                        then_functions: [{ type: 'ShowHintTextFunction', text: 'Collect token first.', once: false }],
                                        else_functions: [],
                                    },
                                    {
                                        type: 'SolveTaskFunction',
                                        task: 'TASK_GATE',
                                        on_success: [{ type: 'PickUpItemFunction', item: 'ITEM_TOKEN' }],
                                        on_failure: [{ type: 'InspectFunction', title: 'Task failed', content: 'Try another order.', once: false }],
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        id: 'NODE_PATH',
                        name: 'Path',
                        text: 'Opened path',
                        actions: [
                            {
                                label: 'Inspect notes',
                                once: false,
                                functions: [{ type: 'InspectFunction', title: 'Notes', content: 'Scenario text payload.', once: false }],
                            },
                        ],
                    },
                ],
            },
        ],
    };

    const state = deserialize(JSON.stringify(scenarioLike), null);
    const output = JSON.parse(serialize(state).gameJson);
    const map = output.maps.find((m) => m.id === 'MAP_MAIN');
    const allFns = [];
    for (const node of map.nodes) {
        for (const action of node.actions || []) {
            collectFunctions(action.functions || [], allFns);
        }
    }

    assert.ok(allFns.length > 0);
    for (const fn of allFns) {
        assert.ok(APPROVED_FUNCTION_TYPES.has(fn.type), `unexpected function type: ${fn.type}`);
        if (fn.type === 'IfFunction') {
            assert.ok(APPROVED_IF_CONDITIONS.has(fn.condition?.type), `unexpected if condition: ${fn.condition?.type}`);
        }
    }
});

test('step 12: legacy action migration maps old action types to action choices + functions', () => {
    const legacyInput = {
        items: {
            ITEM_key: { name: 'Key' },
            ITEM_badge: { name: 'Badge' },
        },
        root: 'NODE_start',
        nodes: {
            NODE_start: {
                name: 'Start',
                text: 'Legacy',
                actions: [
                    { type: 'move', to: 'NODE_hall' },
                    { type: 'solve_task', name: 'TASK_1' },
                    { type: 'return' },
                    {
                        type: 'if',
                        condition: { type: 'has_item', item: 'ITEM_key' },
                        action: { type: 'pickup', item: 'ITEM_badge' },
                    },
                ],
            },
            NODE_hall: { name: 'Hall', text: 'Hall', actions: [] },
        },
    };
    const legacyState = deserialize(JSON.stringify(legacyInput), null);
    const serialized = JSON.parse(serialize(legacyState).gameJson);
    const activeMap = serialized.maps.find((m) => m.id === serialized.root);
    const allFns = [];

    for (const node of activeMap.nodes) {
        for (const action of node.actions || []) {
            assert.equal(typeof action.label, 'string');
            assert.equal(typeof action.once, 'boolean');
            assert.ok(Array.isArray(action.functions));
            collectFunctions(action.functions, allFns);
        }
    }

    assert.ok(allFns.some((fn) => fn.type === 'MoveFunction'));
    assert.ok(allFns.some((fn) => fn.type === 'PickUpItemFunction'));
    assert.ok(allFns.some((fn) => fn.type === 'SolveTaskFunction'));

    // Removed legacy `return` must become explicit move strategy.
    const hasReturnType = allFns.some((fn) => fn.type === 'return' || fn.type === 'ReturnFunction');
    assert.equal(hasReturnType, false);
});

test('step 12: save-load-save cycle after migration is stable for required fields', () => {
    const migratedState = deserialize(readFixture('legacy_input_map.json'), null);

    const first = serialize(migratedState).gameJson;
    const secondState = deserialize(first, null);
    const second = serialize(secondState).gameJson;

    assert.deepEqual(JSON.parse(second), JSON.parse(first));
});

test('step 12: editor config is preserved across save/load round-trip', () => {
    const payload = {
        root: 'MAP_MAIN',
        maps: [
            {
                id: 'MAP_MAIN',
                root: 'NODE_root',
                nodes: [
                    {
                        id: 'NODE_root',
                        name: 'Root',
                        text: 'Start',
                        actions: [],
                    },
                ],
            },
        ],
        items: [],
        _editor: {
            sidePanelWidth: 468,
        },
    };

    const loaded = deserialize(JSON.stringify(payload), null);
    const output = JSON.parse(serialize(loaded).gameJson);

    assert.equal(output._editor?.sidePanelWidth, 468);
});

test('step 12: reducer updates persisted editor config width', () => {
    let state = createInitialState();
    state = mapReducer(state, {
        type: 'SET_EDITOR_CONFIG',
        payload: { sidePanelWidth: 512 },
    });

    assert.equal(state._extraTopLevel?._editor?.sidePanelWidth, 512);
    assert.equal(state.isDirty, true);
});
