import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState } from '../src/state.mjs';
import {
  advanceEncounter,
  applyCompanionAction,
  applyGuardAction,
  applyHeroProbe,
  applyStrikeAction,
  applyToolAction,
  attemptCapture,
  canAdvanceEncounter,
} from '../src/engine.mjs';

test('the default expedition can capture all three default encounters with browser-visible actions', () => {
  let state = createInitialState();

  state = applyHeroProbe(state, 'ash');
  state = applyToolAction(state, 'snare-line');
  state = applyCompanionAction(state, 'grave-hound', 'harry');
  state = attemptCapture(state);
  state = advanceEncounter(state);

  state = applyHeroProbe(state, 'iron');
  state = applyToolAction(state, 'bait-stake');
  state = applyCompanionAction(state, 'grave-hound', 'harry');
  state = attemptCapture(state);
  state = advanceEncounter(state);

  state = applyHeroProbe(state, 'storm');
  state = applyToolAction(state, 'snare-line');
  state = applyCompanionAction(state, 'grave-hound', 'harry');
  state = attemptCapture(state);
  state = advanceEncounter(state);

  assert.equal(state.expeditionComplete, true);
  assert.equal(state.result.rank, 'strong-success');
  assert.deepEqual(state.party.captures, ['ashwing-moth', 'chain-maw', 'storm-antler']);
});

test('advance is blocked until the current encounter is captured or defeated', () => {
  const state = createInitialState();
  const nextState = advanceEncounter(state);

  assert.equal(nextState.encounterIndex, 0);
  assert.equal(canAdvanceEncounter(nextState), false);
  assert.match(nextState.log.at(-1), /cannot advance/i);
});

test('every non-advance action spends a turn and active targets push pressure back onto the party', () => {
  let state = createInitialState({ encounterIds: ['chain-maw'] });
  state = applyHeroProbe(state, 'stone');

  assert.equal(state.currentEncounter.turn, 2);
  assert.equal(state.currentEncounter.pressure, 1);
  assert.match(state.log.at(-1), /presses back/i);
});

test('guard changes encounter resolution by preventing the next retaliation step', () => {
  const guarded = applyGuardAction(createInitialState({ encounterIds: ['chain-maw'] }));
  const exposed = applyStrikeAction(createInitialState({ encounterIds: ['chain-maw'] }));

  assert.equal(guarded.currentEncounter.pressure, 0);
  assert.equal(exposed.currentEncounter.pressure, 1);
});

test('mireback brace changes encounter resolution by preventing the next retaliation step', () => {
  const braced = applyCompanionAction(
    createInitialState({ encounterIds: ['storm-antler'] }),
    'mireback-tortoise',
    'brace'
  );
  const exposed = applyStrikeAction(createInitialState({ encounterIds: ['storm-antler'] }));

  assert.equal(braced.currentEncounter.pressure, 0);
  assert.equal(braced.party.beasts['mireback-tortoise'].fatigue, 1);
  assert.equal(exposed.currentEncounter.pressure, 1);
});

test('captured encounters preserve learned clues into the expedition result summary', () => {
  let state = createInitialState({ encounterIds: ['ashwing-moth'] });

  state = applyHeroProbe(state, 'ash');
  state = applyToolAction(state, 'snare-line');
  state = applyCompanionAction(state, 'grave-hound', 'harry');
  state = attemptCapture(state);
  state = advanceEncounter(state);

  assert.deepEqual(state.codexHints['ashwing-moth'], ['ash']);
  assert.equal(state.result.rank, 'success');
});

test('resolved encounters ignore later action dispatches instead of mutating state', () => {
  let state = createInitialState({ encounterIds: ['ashwing-moth'] });
  state = applyHeroProbe(state, 'ash');
  state = applyToolAction(state, 'snare-line');
  state = applyCompanionAction(state, 'grave-hound', 'harry');
  state = attemptCapture(state);

  const resolvedState = state;
  const afterProbe = applyHeroProbe(state, 'storm');
  const afterTool = applyToolAction(state, 'bait-stake');
  const afterStrike = applyStrikeAction(state);
  const afterGuard = applyGuardAction(state);
  const afterBrace = applyCompanionAction(state, 'mireback-tortoise', 'brace');
  const afterCapture = attemptCapture(state);

  assert.equal(afterProbe, resolvedState);
  assert.equal(afterTool, resolvedState);
  assert.equal(afterStrike, resolvedState);
  assert.equal(afterGuard, resolvedState);
  assert.equal(afterBrace, resolvedState);
  assert.equal(afterCapture, resolvedState);
});

test('probing while bindable does not collapse the capture window', () => {
  let state = createInitialState({ encounterIds: ['ashwing-moth'] });
  state = applyHeroProbe(state, 'ash');
  state = applyToolAction(state, 'snare-line');
  state = applyCompanionAction(state, 'grave-hound', 'harry');
  assert.equal(state.currentEncounter.target.captureState, 'bindable');

  const afterProbe = applyHeroProbe(state, 'ash');

  assert.equal(afterProbe.currentEncounter.target.captureState, 'bindable');
  assert.equal(attemptCapture(afterProbe).party.captures.at(-1), 'ashwing-moth');
});

test('only confirmed probes are recorded as codex hints', () => {
  let state = createInitialState({ encounterIds: ['chain-maw'] });
  state = applyHeroProbe(state, 'stone');
  state = applyHeroProbe(state, 'iron');

  assert.deepEqual(state.codexHints['chain-maw'], ['iron']);
});
