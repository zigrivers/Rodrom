import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState, buildEncounterOrder } from '../src/state.mjs';
import {
  advanceEncounter,
  applyCompanionAction,
  applyGuardAction,
  applyHeroProbe,
  applyStrikeAction,
  applyToolAction,
  attemptCapture,
  canAdvanceEncounter,
  withdrawEncounter,
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

test('run variation builds different encounter orders, always tutorial-first and sometimes the veil lynx', () => {
  const a = buildEncounterOrder(0);
  const b = buildEncounterOrder(1);

  assert.notDeepEqual(a, b);
  assert.equal(a[0], 'ashwing-moth');
  assert.equal(b[0], 'ashwing-moth');
  const everShowsVeil = [0, 1, 2].some((variant) => buildEncounterOrder(variant).includes('veil-lynx'));
  assert.ok(everShowsVeil);
});

test('completing an expedition banks its captures into the roster', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'] });
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  s = advanceEncounter(s);

  assert.equal(s.expeditionComplete, true);
  assert.deepEqual(s.roster, ['ashwing-moth']);
});

test('the roster carries across runs and accumulates new captures', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'], roster: ['chain-maw'] });
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  s = advanceEncounter(s);

  assert.deepEqual(s.roster, ['chain-maw', 'ashwing-moth']);
});

test('fielding a subset of beasts omits the unfielded ones from the party', () => {
  const s = createInitialState({ fielded: ['mireback-tortoise'] });
  assert.deepEqual(Object.keys(s.party.beasts), ['mireback-tortoise']);
  assert.deepEqual(s.fielded, ['mireback-tortoise']);
});

test('an unfielded beast action is a no-op', () => {
  const s = createInitialState({ fielded: ['mireback-tortoise'], encounterIds: ['chain-maw'] });
  assert.equal(applyCompanionAction(s, 'grave-hound', 'harry'), s);
});

test('composition changes outcomes: only a fielded Mireback can stagger the Chain Maw', () => {
  let withMireback = createInitialState({ fielded: ['mireback-tortoise'], encounterIds: ['chain-maw'] });
  withMireback = applyHeroProbe(withMireback, 'iron');
  withMireback = applyCompanionAction(withMireback, 'mireback-tortoise', 'shove');
  assert.equal(withMireback.currentEncounter.target.captureState, 'bindable');

  let withoutMireback = createInitialState({ fielded: ['grave-hound'], encounterIds: ['chain-maw'] });
  withoutMireback = applyHeroProbe(withoutMireback, 'iron');
  withoutMireback = applyCompanionAction(withoutMireback, 'mireback-tortoise', 'shove'); // not fielded -> no-op
  assert.notEqual(withoutMireback.currentEncounter.target.captureState, 'bindable');
});

test('a new run preserves the prior roster and starts with no run captures', () => {
  const s = createInitialState({ roster: ['ashwing-moth', 'chain-maw'], started: true });

  assert.deepEqual(s.roster, ['ashwing-moth', 'chain-maw']);
  assert.deepEqual(s.party.captures, []);
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

test('three wrong reads let the beast escape and cost supplies', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'] });
  const startTools = s.party.tools['snare-line'] + s.party.tools['bait-stake'];

  s = applyHeroProbe(s, 'stone');
  s = applyHeroProbe(s, 'stone');
  s = applyHeroProbe(s, 'stone');

  assert.equal(s.currentEncounter.target.captureState, 'escaped');
  assert.equal(canAdvanceEncounter(s), true);
  assert.deepEqual(s.party.captures, []);
  assert.match(s.log.join('\n'), /escapes/i);
  const endTools = s.party.tools['snare-line'] + s.party.tools['bait-stake'];
  assert.ok(endTools < startTools);
});

test('sustained pressure frenzies and wounds the leader', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'] });
  for (let i = 0; i < 6; i += 1) {
    s = applyHeroProbe(s, 'iron'); // correct read: never escapes, but pressure keeps climbing
  }

  assert.ok(s.party.leader.health < 6);
  assert.match(s.log.join('\n'), /frenz/i);
});

test('warning bark and burden shelter prevent the pressure tick', () => {
  const bark = applyCompanionAction(
    createInitialState({ encounterIds: ['chain-maw'] }),
    'grave-hound',
    'warning-bark'
  );
  const shelter = applyCompanionAction(
    createInitialState({ encounterIds: ['chain-maw'] }),
    'mireback-tortoise',
    'burden-shelter'
  );

  assert.equal(bark.currentEncounter.pressure, 0);
  assert.equal(shelter.currentEncounter.pressure, 0);
});

test('stalling on a bindable target closes the capture window', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'] });
  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove');
  assert.equal(s.currentEncounter.target.captureState, 'bindable');

  s = applyCompanionAction(s, 'grave-hound', 'warning-bark');
  s = applyCompanionAction(s, 'grave-hound', 'warning-bark');

  assert.notEqual(s.currentEncounter.target.captureState, 'bindable');
  assert.match(s.log.join('\n'), /window clos/i);
});

test('relentless reckless pressure can lose the leader and fail the expedition', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'] });
  let guard = 0;
  while (!s.expeditionComplete && guard < 40) {
    s = applyHeroProbe(s, 'iron');
    guard += 1;
  }

  assert.equal(s.expeditionComplete, true);
  assert.equal(s.result.rank, 'expedition-failure');
});

test('a staked snare line holds the beast so bad reads cannot make it flee', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'] });
  s = applyToolAction(s, 'snare-line');
  s = applyHeroProbe(s, 'stone');
  s = applyHeroProbe(s, 'stone');
  s = applyHeroProbe(s, 'stone');
  s = applyHeroProbe(s, 'stone');

  assert.notEqual(s.currentEncounter.target.captureState, 'escaped');
});

test('a staked snare line holds an open capture window from decaying', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'] });
  s = applyToolAction(s, 'snare-line');
  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove');
  assert.equal(s.currentEncounter.target.captureState, 'bindable');

  s = applyCompanionAction(s, 'grave-hound', 'warning-bark');
  s = applyCompanionAction(s, 'grave-hound', 'warning-bark');
  s = applyCompanionAction(s, 'grave-hound', 'warning-bark');

  assert.equal(s.currentEncounter.target.captureState, 'bindable');
});

test('withdrawing resolves the encounter without a capture and spares the party', () => {
  let s = createInitialState({ encounterIds: ['storm-antler'] });
  s = applyHeroProbe(s, 'storm');
  const leaderBefore = s.party.leader.health;

  s = withdrawEncounter(s);

  assert.equal(s.currentEncounter.target.captureState, 'withdrawn');
  assert.equal(canAdvanceEncounter(s), true);
  assert.equal(s.party.leader.health, leaderBefore);
  assert.match(s.log.join('\n'), /withdraw/i);

  s = advanceEncounter(s);
  assert.equal(s.expeditionComplete, true);
  assert.deepEqual(s.party.captures, []);
});

test('withdraw is ignored once the encounter is already resolved', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'] });
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);

  assert.equal(withdrawEncounter(s), s);
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
