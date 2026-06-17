import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRun, createInitialState, CIRCUIT_SIZE, quarryList } from '../src/state.mjs';
import {
  applyHeroProbe, applyToolAction, applyCompanionAction, attemptCapture, advanceEncounter,
  circuitComplete, secureHaul,
} from '../src/engine.mjs';

// --- buildRun: the run is a sequence of layers, each a circuit of content nodes ---

test('the first run is one tutorial circuit of three quarry nodes, no salvage', () => {
  const { layers } = buildRun(0, true);
  assert.equal(layers.length, 1);
  assert.deepEqual(layers[0].map((n) => n.kind), ['quarry', 'quarry', 'quarry']);
  assert.deepEqual(layers[0].map((n) => n.beastId), ['ashwing-moth', 'chain-maw', 'storm-antler']);
});

test('a later-run layer is a CIRCUIT_SIZE circuit with one salvage cache among quarries', () => {
  const { layers } = buildRun(1, false);
  const layer = layers[0];
  assert.equal(layer.length, CIRCUIT_SIZE);
  assert.equal(layer.filter((n) => n.kind === 'salvage').length, 1);
  assert.ok(layer.filter((n) => n.kind === 'quarry').length >= 1);
  assert.equal(layer[0].kind, 'quarry', 'a circuit opens on a quarry, not a cache');
});

test('run generation is deterministic for a given variant', () => {
  assert.deepEqual(buildRun(2, false), buildRun(2, false));
});

// --- createInitialState: run cursor + back-compat ---

test('createInitialState seeds a run cursor at the first quarry', () => {
  const s = createInitialState();
  assert.ok(s.run && Array.isArray(s.run.layers));
  assert.equal(s.layerIndex, 0);
  assert.equal(s.nodeIndex, 0);
  assert.equal(s.currentEncounter.target.id, 'ashwing-moth');
});

test('encounterIds map to single-node layers (each encounter is its own complete circuit)', () => {
  const s = createInitialState({ encounterIds: ['chain-maw', 'storm-antler'] });
  assert.equal(s.run.layers.length, 2);
  assert.deepEqual(s.run.layers.map((l) => l.length), [1, 1]);
  assert.deepEqual(quarryList(s.run), ['chain-maw', 'storm-antler']);
});

// --- circuit completion (t9i.4) ---

test('a single-node circuit is complete as soon as its one encounter resolves (back-compat)', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'] });
  assert.equal(circuitComplete(s), false, 'not complete while unresolved');
  s = applyHeroProbe(s, 'mass');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove');
  s = attemptCapture(s);
  assert.equal(circuitComplete(s), true);
});

test('a multi-node circuit is NOT complete until the last quarry resolves', () => {
  const run = { layers: [[{ kind: 'quarry', beastId: 'chain-maw' }, { kind: 'quarry', beastId: 'storm-antler' }]] };
  let s = createInitialState({ run, fielded: ['mireback-tortoise'] });
  // resolve node 0
  s = applyHeroProbe(s, 'mass');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove');
  s = attemptCapture(s);
  assert.equal(circuitComplete(s), false, 'one quarry still ahead in the circuit');
  s = advanceEncounter(s);
  assert.equal(s.currentEncounter.target.id, 'storm-antler');
  s = applyToolAction(s, 'bait-stake');
  s = applyHeroProbe(s, 'sky');
  s = attemptCapture(s);
  assert.equal(circuitComplete(s), true);
});

// --- salvage caches are collected on descent (t9i.2) ---

test('descending past a salvage cache banks its lore', () => {
  const run = { layers: [
    [{ kind: 'quarry', beastId: 'chain-maw' }, { kind: 'salvage', lore: 3 }, { kind: 'quarry', beastId: 'storm-antler' }],
  ] };
  let s = createInitialState({ run, fielded: ['mireback-tortoise'] });
  const before = s.lore;
  s = applyHeroProbe(s, 'mass');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove');
  s = attemptCapture(s); // node 0 resolved; salvage sits between this and the next quarry
  s = advanceEncounter(s); // crossing the cache to reach storm-antler
  assert.equal(s.lore, before + 3, 'cache lore banked on the way down');
  assert.equal(s.currentEncounter.target.id, 'storm-antler');
});

// --- anchors gate to circuit completion (t9i.4) ---

test('Secure is a no-op mid-circuit and works at circuit completion', () => {
  const run = { layers: [[{ kind: 'quarry', beastId: 'chain-maw' }, { kind: 'quarry', beastId: 'storm-antler' }]] };
  let s = createInitialState({ run, fielded: ['mireback-tortoise'] });
  s = applyHeroProbe(s, 'mass');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove');
  s = attemptCapture(s); // node 0 resolved, circuit NOT complete
  assert.equal(secureHaul(s).securedCount, 0, 'cannot secure mid-circuit');
  s = advanceEncounter(s);
  s = applyToolAction(s, 'bait-stake');
  s = applyHeroProbe(s, 'sky');
  s = attemptCapture(s); // last quarry resolved -> circuit complete
  assert.equal(circuitComplete(s), true);
  assert.equal(secureHaul(s).securedCount, secureHaul(s).party.captures.length, 'secure works at circuit completion');
});
