import test from 'node:test';
import assert from 'node:assert/strict';

import { computeEdges } from '../src/state/selectors.js';

test('step 09: computeEdges includes direct MoveFunction edges from action functions[]', () => {
    const nodes = {
        NODE_A: {
            id: 'NODE_A',
            actions: [
                {
                    label: 'Go',
                    once: false,
                    functions: [{ type: 'MoveFunction', to: 'NODE_B' }],
                },
            ],
        },
        NODE_B: { id: 'NODE_B', actions: [] },
    };

    const edges = computeEdges(nodes);
    assert.equal(edges.length, 1);
    assert.equal(edges[0].from, 'NODE_A');
    assert.equal(edges[0].to, 'NODE_B');
    assert.equal(edges[0].conditional, false);
});

test('step 09: computeEdges includes nested IfFunction and SolveTaskFunction branch edges', () => {
    const nodes = {
        NODE_A: {
            id: 'NODE_A',
            actions: [
                {
                    label: 'Complex',
                    once: false,
                    functions: [
                        {
                            type: 'IfFunction',
                            condition: { type: 'has_item', item: 'ITEM_key' },
                            then_functions: [{ type: 'MoveFunction', to: 'NODE_B' }],
                            else_functions: [{ type: 'MoveFunction', to: 'NODE_C' }],
                        },
                        {
                            type: 'SolveTaskFunction',
                            task: 'open',
                            on_success: [{ type: 'MoveFunction', to: 'NODE_D' }],
                            on_failure: [{ type: 'MoveFunction', to: 'NODE_E' }],
                        },
                    ],
                },
            ],
        },
        NODE_B: { id: 'NODE_B', actions: [] },
        NODE_C: { id: 'NODE_C', actions: [] },
        NODE_D: { id: 'NODE_D', actions: [] },
        NODE_E: { id: 'NODE_E', actions: [] },
    };

    const edges = computeEdges(nodes);
    const key = (e) => `${e.from}->${e.to}#${e.conditionSummary || ''}`;
    const keys = new Set(edges.map(key));

    assert.ok(keys.has('NODE_A->NODE_B#if:has ITEM_key:then'));
    assert.ok(keys.has('NODE_A->NODE_C#if:has ITEM_key:else'));
    assert.ok(keys.has('NODE_A->NODE_D#task:success'));
    assert.ok(keys.has('NODE_A->NODE_E#task:failure'));
    assert.ok(edges.every((e) => e.conditional === true));
});

test('step 09: computeEdges is cycle-safe and does not duplicate same derived edge', () => {
    const cycleFn = {
        type: 'IfFunction',
        condition: { type: 'item_used', item: 'ITEM_token' },
        then_functions: [],
        else_functions: [],
    };
    cycleFn.then_functions.push(cycleFn); // explicit object cycle
    cycleFn.then_functions.push({ type: 'MoveFunction', to: 'NODE_LOOP_TARGET' });
    cycleFn.else_functions.push({ type: 'MoveFunction', to: 'NODE_LOOP_TARGET' });

    const nodes = {
        NODE_SRC: {
            id: 'NODE_SRC',
            actions: [{ label: 'Cycle', once: false, functions: [cycleFn] }],
        },
        NODE_LOOP_TARGET: { id: 'NODE_LOOP_TARGET', actions: [] },
    };

    const first = computeEdges(nodes);
    const second = computeEdges(nodes);

    assert.equal(first.length, 2);
    assert.equal(second.length, 2);
    const uniqueFirst = new Set(first.map((e) => `${e.from}|${e.to}|${e.conditionSummary}`));
    assert.equal(uniqueFirst.size, first.length);
});
