import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.mjs';
import { BUILD_CATALOG } from '../src/content.mjs';
import {
  applyHeroProbe, applyCompanionAction, applyToolAction, attemptCapture, advanceEncounter,
  recoverAtLayer, buildStructure,
} from '../src/engine.mjs';

const q = (beastId) => ({ kind: 'quarry', beastId });
const resolveChainMaw = (s) =>
  attemptCapture(applyCompanionAction(applyHeroProbe(s, 'mass'), 'mireback-tortoise', 'shove'));

test('a heavy structure builds only at a completed circuit, costs Lore, and is one-per-run', () => {
  const run = { layers: [[q('chain-maw'), q('storm-antler')]] };
  let s = createInitialState({ run, fielded: ['mireback-tortoise'], lore: 20 });
  s = resolveChainMaw(s); // node 0 resolved, circuit NOT complete
  assert.deepEqual(buildStructure(s, 'sanctified-camp').builds, [], 'no heavy build mid-circuit');

  s = advanceEncounter(s);
  s = applyToolAction(s, 'bait-stake');
  s = applyHeroProbe(s, 'sky');
  s = attemptCapture(s); // last quarry resolved -> circuit complete
  const built = buildStructure(s, 'sanctified-camp');
  assert.ok(built.builds.includes('sanctified-camp'));
  assert.equal(built.lore, 20 - BUILD_CATALOG['sanctified-camp'].cost);
  assert.equal(buildStructure(built, 'sanctified-camp').lore, built.lore, 'one of each per run (second build is a no-op)');
});

test('a structure cannot be built without enough Lore', () => {
  const run = { layers: [[q('chain-maw')]] };
  let s = createInitialState({ run, fielded: ['mireback-tortoise'], lore: 2 });
  s = resolveChainMaw(s);
  assert.deepEqual(buildStructure(s, 'descent-support').builds, [], 'too poor to build');
});

test('Sanctified Camp makes anchor Recover heal more', () => {
  const run = { layers: [[q('chain-maw')]] };
  let base = createInitialState({ run, fielded: ['mireback-tortoise'], lore: 20 });
  base = resolveChainMaw(base);
  const wound = (s) => ({ ...s, party: { ...s.party, leader: { ...s.party.leader, health: 1 } } });
  const withoutCamp = recoverAtLayer(wound(base));
  const withCamp = recoverAtLayer(wound(buildStructure(base, 'sanctified-camp')));
  assert.ok(withCamp.party.leader.health > withoutCamp.party.leader.health, 'the camp heals more');
});

test('Watch Totem raises escape tolerance by one', () => {
  const run = { layers: [[q('chain-maw')]] };
  const wrongReads = (s, n) => {
    for (let i = 0; i < n; i += 1) s = applyHeroProbe(s, 'veil'); // Absence is foreign to chain-maw (Mass)
    return s;
  };
  const base = wrongReads(createInitialState({ run }), 3);
  assert.equal(base.currentEncounter.target.captureState, 'escaped', 'baseline flees after 3 wrong reads');
  const warded = wrongReads(createInitialState({ run, builds: ['watch-totem'] }), 3);
  assert.notEqual(warded.currentEncounter.target.captureState, 'escaped', 'the totem buys one more read');
});

test('Descent Support lowers the starting pressure of a descent', () => {
  const ids = ['chain-maw', 'chain-maw', 'chain-maw'];
  const toDepth3 = (opts) => {
    let s = createInitialState({ encounterIds: ids, fielded: ['mireback-tortoise'], ...opts });
    s = advanceEncounter(resolveChainMaw(s)); // depth 2
    s = advanceEncounter(resolveChainMaw(s)); // depth 3 (startingPressure = 1)
    return s;
  };
  const base = toDepth3({});
  const supported = toDepth3({ builds: ['descent-support'] });
  assert.equal(base.currentEncounter.depth, 3);
  assert.ok(supported.currentEncounter.pressure < base.currentEncounter.pressure, 'support relieves the descent');
});
