import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState } from '../src/state.mjs';
import {
  applyHeroProbe,
  applyGuardAction,
  applyStrikeAction,
  applyToolAction,
  applyCompanionAction,
  attemptCapture,
  advanceEncounter,
} from '../src/engine.mjs';

test('Ashwing Moth becomes bindable after the correct ash read and snare setup', () => {
  let state = createInitialState({ encounterIds: ['ashwing-moth'] });

  state = applyHeroProbe(state, 'ash');
  state = applyToolAction(state, 'snare-line');
  state = applyCompanionAction(state, 'grave-hound', 'harry');

  assert.equal(state.currentEncounter.target.captureState, 'bindable');
});

test('Capture attempt fails cleanly before a beast is bindable', () => {
  let state = createInitialState({ encounterIds: ['chain-maw'] });
  state = attemptCapture(state);

  assert.equal(state.currentEncounter.target.captureState, 'unreadable');
  assert.match(state.log.at(-1), /not ready to bind/i);
});

test('Encounter setup persists after a wrong probe and later tool placement', () => {
  let state = createInitialState({ encounterIds: ['ashwing-moth'] });
  state = applyHeroProbe(state, 'ash');
  state = applyHeroProbe(state, 'stone');
  state = applyToolAction(state, 'snare-line');
  state = applyToolAction(state, 'torch-pylon');

  assert.equal(state.currentEncounter.flags.attunementMatch, true);
  assert.equal(state.currentEncounter.flags.postureReady, true);
});

test('Encounter setup persists when a later probe and tool do not clear prior readiness', () => {
  let state = createInitialState({ encounterIds: ['ashwing-moth'] });
  state = applyHeroProbe(state, 'ash');
  state = applyToolAction(state, 'snare-line');
  state = applyCompanionAction(state, 'grave-hound', 'harry');
  state = applyHeroProbe(state, 'stone');
  state = applyToolAction(state, 'torch-pylon');

  assert.equal(state.currentEncounter.target.captureState, 'bindable');
  assert.equal(state.currentEncounter.flags.attunementMatch, true);
  assert.equal(state.currentEncounter.flags.postureReady, true);
});

test('Advance encounter resets the current target and preserves codex hints', () => {
  let state = createInitialState({ encounterIds: ['ashwing-moth', 'veil-lynx'] });
  state = applyHeroProbe(state, 'ash');
  state = applyToolAction(state, 'snare-line');
  state = applyCompanionAction(state, 'grave-hound', 'harry');
  state = attemptCapture(state);
  state = advanceEncounter(state);

  assert.equal(state.encounterIndex, 1);
  assert.equal(state.party.tools['snare-line'], 0);
  assert.ok(state.codexHints['ashwing-moth'].includes('ash'));
  assert.equal(state.currentEncounter.target.id, 'veil-lynx');
});

test('Strike defeats a target at zero HP and makes it non-capturable', () => {
  let state = createInitialState({ encounterIds: ['ashwing-moth'] });
  state = applyStrikeAction(state);
  state = applyStrikeAction(state);

  assert.equal(state.currentEncounter.target.health, 0);
  assert.equal(state.currentEncounter.target.captureState, 'defeated');
  state = attemptCapture(state);
  assert.match(state.log.at(-1), /not ready to bind/i);
});

test('Guard raises a persistent defensive stance on the encounter', () => {
  const state = applyGuardAction(createInitialState({ encounterIds: ['ashwing-moth'] }));

  assert.equal(state.currentEncounter.flags.guardRaised, true);
  assert.match(state.log.at(-1), /guarded stance/i);
});

test('Terminal target states are not rewritten by later probe or companion actions', () => {
  let state = createInitialState({ encounterIds: ['ashwing-moth'] });
  state = applyStrikeAction(state);
  state = applyStrikeAction(state);
  state = applyHeroProbe(state, 'ash');
  state = applyToolAction(state, 'snare-line');
  state = applyCompanionAction(state, 'grave-hound', 'harry');

  assert.equal(state.currentEncounter.target.health, 0);
  assert.equal(state.currentEncounter.target.captureState, 'defeated');
});

test('Captured targets stay captured after later probe and companion actions', () => {
  let state = createInitialState({ encounterIds: ['ashwing-moth'] });
  state = applyHeroProbe(state, 'ash');
  state = applyToolAction(state, 'snare-line');
  state = applyCompanionAction(state, 'grave-hound', 'harry');
  state = attemptCapture(state);
  state = applyHeroProbe(state, 'ash');
  state = applyToolAction(state, 'torch-pylon');
  state = applyCompanionAction(state, 'grave-hound', 'harry');

  assert.equal(state.currentEncounter.target.captureState, 'captured');
  assert.deepEqual(state.party.captures, ['ashwing-moth']);
});

test('failed probes and actions create fatigue and make later encounters riskier', () => {
  let state = createInitialState({ encounterIds: ['chain-maw', 'veil-lynx'] });
  state = applyHeroProbe(state, 'stone');
  state = applyCompanionAction(state, 'grave-hound', 'harry');
  state = advanceEncounter(state);

  assert.equal(state.party.beasts['grave-hound'].fatigue, 1);
  assert.match(state.log.at(-1), /advance to encounter 2/i);
});

test('capturing the final target marks the expedition complete with a strong result', () => {
  let state = createInitialState({ encounterIds: ['ashwing-moth'] });
  state = applyHeroProbe(state, 'ash');
  state = applyToolAction(state, 'snare-line');
  state = applyCompanionAction(state, 'grave-hound', 'harry');
  state = attemptCapture(state);
  state = advanceEncounter(state);

  assert.equal(state.expeditionComplete, true);
  assert.equal(state.result.rank, 'strong-success');
});
