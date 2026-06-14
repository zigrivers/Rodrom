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

test('the default expedition captures all three encounters via their distinct conditions', () => {
  let state = createInitialState();

  // Ashwing Moth: correct attunement + Harry corners it
  state = applyHeroProbe(state, 'ash');
  state = applyCompanionAction(state, 'grave-hound', 'harry');
  state = attemptCapture(state);
  state = advanceEncounter(state);

  // Chain Maw: correct attunement + Shove staggers it (Harry alone will not do)
  state = applyHeroProbe(state, 'iron');
  state = applyCompanionAction(state, 'mireback-tortoise', 'shove');
  state = attemptCapture(state);
  state = advanceEncounter(state);

  // Storm Antler: correct attunement + Bait Stake grounds its charge
  state = applyHeroProbe(state, 'storm');
  state = applyToolAction(state, 'bait-stake');
  state = attemptCapture(state);
  state = advanceEncounter(state);

  assert.equal(state.expeditionComplete, true);
  assert.equal(state.result.rank, 'strong-success');
  assert.deepEqual(state.party.captures, ['ashwing-moth', 'chain-maw', 'storm-antler']);
});

test('each beast requires its own control action to become bindable', () => {
  // Chain Maw cannot be bound by Harry; it needs Shove
  let chain = createInitialState({ encounterIds: ['chain-maw'] });
  chain = applyHeroProbe(chain, 'iron');
  chain = applyCompanionAction(chain, 'grave-hound', 'harry');
  assert.notEqual(chain.currentEncounter.target.captureState, 'bindable');
  chain = applyCompanionAction(chain, 'mireback-tortoise', 'shove');
  assert.equal(chain.currentEncounter.target.captureState, 'bindable');

  // Storm Antler needs Bait Stake, not a Snare Line
  let storm = createInitialState({ encounterIds: ['storm-antler'] });
  storm = applyHeroProbe(storm, 'storm');
  storm = applyToolAction(storm, 'snare-line');
  assert.notEqual(storm.currentEncounter.target.captureState, 'bindable');
  storm = applyToolAction(storm, 'bait-stake');
  assert.equal(storm.currentEncounter.target.captureState, 'bindable');
});

test('a beast-specific control action drives the target into its bind posture', () => {
  let chain = createInitialState({ encounterIds: ['chain-maw'] });
  assert.equal(chain.currentEncounter.target.posture, 'charging');
  chain = applyCompanionAction(chain, 'mireback-tortoise', 'shove');
  assert.equal(chain.currentEncounter.target.posture, 'staggered');
});

test('correct attunement alone is not enough without the bind posture', () => {
  let chain = createInitialState({ encounterIds: ['chain-maw'] });
  chain = applyHeroProbe(chain, 'iron');
  assert.equal(chain.currentEncounter.target.captureState, 'probed');
  assert.notEqual(chain.currentEncounter.target.captureState, 'bindable');
});

test('veil lynx conceals its attunement until scent-read reveals it', () => {
  let s = createInitialState({ encounterIds: ['veil-lynx'] });

  // Probing the true attunement while hidden is misleading and makes no progress
  s = applyHeroProbe(s, 'veil');
  assert.match(s.log.at(-2), /rejects/i);
  assert.notEqual(s.currentEncounter.target.captureState, 'bindable');

  // The false lead reads as a (misleading) reaction but never matches
  let f = createInitialState({ encounterIds: ['veil-lynx'] });
  f = applyHeroProbe(f, 'silence');
  assert.match(f.log.at(-2), /reacts/i);
  assert.notEqual(f.currentEncounter.target.captureState, 'bindable');

  // Scent Read reveals the true attunement and exposes the lynx
  s = applyCompanionAction(s, 'grave-hound', 'scent-read');
  assert.equal(s.currentEncounter.target.posture, 'revealed');
  assert.ok(s.codexHints['veil-lynx']?.includes('veil'));

  // Now the true attunement reads correctly and capture opens
  s = applyHeroProbe(s, 'veil');
  assert.equal(s.currentEncounter.target.captureState, 'bindable');
  s = attemptCapture(s);
  assert.deepEqual(s.party.captures, ['veil-lynx']);
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
