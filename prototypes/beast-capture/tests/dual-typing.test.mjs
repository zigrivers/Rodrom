import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.mjs';
import { applyHeroProbe, applyToolAction } from '../src/engine.mjs';

// storm-antler: primary storm (Sky), binds via ground. Give it a secondary iron (Mass) for dual-typing.
function dualState() {
  let s = createInitialState({ encounterIds: ['storm-antler'], fielded: ['mireback-tortoise'] });
  const t = { ...s.currentEncounter.target, secondaryAttunement: 'iron' };
  return { ...s, currentEncounter: { ...s.currentEncounter, target: t } };
}

test('a dual-typed beast is not bindable after only one court read', () => {
  let s = dualState();
  s = applyHeroProbe(s, 'sky'); // storm (primary) only
  s = applyToolAction(s, 'bait-stake'); // ground it
  assert.notEqual(s.currentEncounter.target.captureState, 'bindable');
});

test('a dual-typed beast becomes bindable after BOTH court reads + posture', () => {
  let s = dualState();
  s = applyHeroProbe(s, 'sky'); // storm
  s = applyHeroProbe(s, 'mass'); // iron (secondary)
  s = applyToolAction(s, 'bait-stake'); // ground
  assert.equal(s.currentEncounter.target.captureState, 'bindable');
});

test('an authored lead+twin dual reads sharp on its lead court and faint on its twin court', () => {
  let s = createInitialState({ encounterIds: ['stormcoil-apostate'] }); // storm (Sky lead) + stone (Mass twin)
  s = applyHeroProbe(s, 'sky');
  assert.match(s.log.at(-2), /sharply/);
  assert.equal(s.currentEncounter.flags.attunementMatch, true);
  s = applyHeroProbe(s, 'mass');
  assert.match(s.log.at(-2), /faintly/);
  assert.equal(s.currentEncounter.flags.secondaryAttunementMatch, true);
});
