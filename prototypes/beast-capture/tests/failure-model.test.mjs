import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.mjs';
import { withdrawEncounter, advanceEncounter } from '../src/engine.mjs';

// Descend to a target depth by withdrawing through each layer (no captures), then die there by
// dropping the leader to 1 HP and taking a fatal carryover descent. Returns the failed end-state.
function dieAtDepth(targetDepth, opts) {
  let s = createInitialState({
    encounterIds: Array(targetDepth + 1).fill('storm-antler'),
    ...opts,
  });
  while (s.currentEncounter.depth < targetDepth) {
    s = withdrawEncounter(s);
    s = advanceEncounter(s);
  }
  s = withdrawEncounter(s);
  s = { ...s, party: { ...s.party, leader: { ...s.party.leader, health: 1 } } };
  return advanceEncounter(s); // fatal: the descent's carryover finishes the leader
}

test('a DEEP failure wounds fielded beasts, costing bond scaled by depth (ua7.1)', () => {
  const s = dieAtDepth(4, { roster: ['chain-maw'], fielded: ['chain-maw', 'mireback-tortoise'], bonds: { 'chain-maw': 3 } });
  assert.equal(s.result.rank, 'expedition-failure');
  assert.equal(s.currentEncounter.depth, 4);
  assert.equal(s.result.deepFailure, true);
  assert.equal(s.result.bondPenalty, 1); // floor(4 / 4)
  assert.equal(s.bonds['chain-maw'], 2, 'a fielded ally returns wounded (3 -> 2)');
});

test('deeper failures wound more (the penalty scales with depth)', () => {
  const s = dieAtDepth(8, { roster: ['chain-maw'], fielded: ['chain-maw'], bonds: { 'chain-maw': 5 } });
  assert.equal(s.currentEncounter.depth, 8);
  assert.equal(s.result.bondPenalty, 2); // floor(8 / 4)
  assert.equal(s.bonds['chain-maw'], 3, 'a depth-8 death costs 2 bond (5 -> 3)');
});

test('a SHALLOW failure stays gentle — fielded beasts keep their survival bond, no wound (ua7.2)', () => {
  const s = dieAtDepth(3, { roster: ['chain-maw'], fielded: ['chain-maw'], bonds: { 'chain-maw': 3 } });
  assert.equal(s.result.rank, 'expedition-failure');
  assert.equal(s.result.deepFailure, false);
  assert.equal(s.result.bondPenalty, 0);
  assert.equal(s.bonds['chain-maw'], 4, 'early failure still grants the survival bond (3 -> 4)');
});

test('bond cannot be driven below zero by a deep failure', () => {
  const s = dieAtDepth(4, { roster: ['chain-maw'], fielded: ['chain-maw'], bonds: { 'chain-maw': 0 } });
  assert.equal(s.bonds['chain-maw'], 0, 'a wounded beast bottoms out at 0, not negative');
});
