import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState, buildEncounterOrder, buyUpgrade, upgradeCost } from '../src/state.mjs';
import {
  advanceEncounter,
  anchorExpedition,
  anchorHeal,
  applyCompanionAction,
  applyGuardAction,
  applyHeroProbe,
  applyStrikeAction,
  applyToolAction,
  attemptCapture,
  canAdvanceEncounter,
  extractExpedition,
  pressurePerTurn,
  withdrawEncounter,
} from '../src/engine.mjs';
import { createTargetState } from '../src/state.mjs';

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
  state = extractExpedition(state);

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

test('a completed run earns lore from captures and depth reached', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'], lore: 0 });
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  s = extractExpedition(s);
  // base 1 capture, depth 1 -> 1*3 + 1 = 4; this clean+fast capture adds +3 (cme.3)
  assert.equal(s.expeditionComplete, true);
  assert.equal(s.lore, 7);
  assert.equal(s.result.loreEarned, 7);
});

test('buying the infirmary upgrade spends lore and raises leader max HP', () => {
  const town = createInitialState({ started: false, lore: 10, upgrades: {} });
  assert.equal(town.party.leader.maxHealth, 6);

  const after = buyUpgrade(town, 'infirmary'); // cost upgradeCost('infirmary', 0)
  assert.equal(after.lore, 10 - upgradeCost('infirmary', 0));
  assert.equal(after.upgrades.infirmary, 1);
  assert.equal(after.party.leader.maxHealth, 7);
});

test('an unaffordable upgrade is a no-op', () => {
  const broke = createInitialState({ started: false, lore: 1, upgrades: {} });
  assert.equal(buyUpgrade(broke, 'infirmary'), broke);
});

test('completing an expedition banks its captures into the roster', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'] });
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  s = extractExpedition(s);

  assert.equal(s.expeditionComplete, true);
  assert.deepEqual(s.roster, ['ashwing-moth']);
});

test('the roster carries across runs and accumulates new captures', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'], roster: ['chain-maw'] });
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  s = extractExpedition(s);

  assert.deepEqual(s.roster, ['chain-maw', 'ashwing-moth']);
});

test('a fielded captured beast contributes its signature action', () => {
  let s = createInitialState({ roster: ['chain-maw'], fielded: ['chain-maw'], encounterIds: ['chain-maw'] });
  assert.ok(s.party.beasts['chain-maw']);

  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'chain-maw', 'slam'); // captured Chain Maw staggers, no Mireback needed
  assert.equal(s.currentEncounter.target.captureState, 'bindable');
});

test('completing a run increments the bond of fielded captured beasts', () => {
  let s = createInitialState({
    roster: ['chain-maw'],
    fielded: ['chain-maw'],
    encounterIds: ['chain-maw'],
    bonds: { 'chain-maw': 0 },
  });
  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'chain-maw', 'slam');
  s = attemptCapture(s);
  s = extractExpedition(s);

  assert.equal(s.bonds['chain-maw'], 1);
});

test('Veilsight: a fielded Veil Lynx ally reveals target attunements on arrival', () => {
  const s = createInitialState({ roster: ['veil-lynx'], fielded: ['veil-lynx'], encounterIds: ['chain-maw'] });
  assert.ok(s.codexHints['chain-maw']?.includes('iron'));

  const without = createInitialState({ encounterIds: ['chain-maw'] });
  assert.ok(!(without.codexHints['chain-maw'] ?? []).includes('iron'));
});

test('Grounding Aura: a fielded Storm Antler ally reduces per-turn pressure', () => {
  const withStorm = applyStrikeAction(
    createInitialState({ roster: ['storm-antler'], fielded: ['storm-antler'], encounterIds: ['chain-maw'] })
  );
  const without = applyStrikeAction(createInitialState({ encounterIds: ['chain-maw'] }));

  assert.equal(withStorm.currentEncounter.pressure, 0);
  assert.equal(without.currentEncounter.pressure, 1);
});

test('Iron Hold: a fielded Chain Maw ally keeps the capture window from decaying', () => {
  let s = createInitialState({
    roster: ['chain-maw'],
    fielded: ['grave-hound', 'mireback-tortoise', 'chain-maw'],
    encounterIds: ['chain-maw'],
  });
  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove');
  assert.equal(s.currentEncounter.target.captureState, 'bindable');

  s = applyCompanionAction(s, 'grave-hound', 'warning-bark');
  s = applyCompanionAction(s, 'grave-hound', 'warning-bark');
  s = applyCompanionAction(s, 'grave-hound', 'warning-bark');
  assert.equal(s.currentEncounter.target.captureState, 'bindable');
});

test('Skittish Kin: a fielded Ashwing ally raises the escape tolerance', () => {
  let without = createInitialState({ encounterIds: ['chain-maw'] });
  without = applyHeroProbe(without, 'stone');
  without = applyHeroProbe(without, 'stone');
  without = applyHeroProbe(without, 'stone');
  assert.equal(without.currentEncounter.target.captureState, 'escaped');

  let withKin = createInitialState({ roster: ['ashwing-moth'], fielded: ['ashwing-moth'], encounterIds: ['chain-maw'] });
  withKin = applyHeroProbe(withKin, 'stone');
  withKin = applyHeroProbe(withKin, 'stone');
  withKin = applyHeroProbe(withKin, 'stone');
  assert.notEqual(withKin.currentEncounter.target.captureState, 'escaped');
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

test('depth scales the per-turn pressure', () => {
  assert.equal(pressurePerTurn(1), 1);
  assert.equal(pressurePerTurn(3), 2);
  assert.equal(pressurePerTurn(5), 3);
});

test('a run tracks descent depth and deeper layers press harder', () => {
  let s = createInitialState();
  assert.equal(s.currentEncounter.depth, 1);

  // descend to layer 3
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  s = advanceEncounter(s);
  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove');
  s = attemptCapture(s);
  s = advanceEncounter(s);

  assert.equal(s.currentEncounter.depth, 3);
  const before = s.currentEncounter.pressure;
  s = applyStrikeAction(s); // undefended turn at depth 3
  assert.equal(s.currentEncounter.pressure - before, 2);
});

test('deeper layers field tougher targets', () => {
  assert.equal(
    createTargetState('chain-maw', 3).maxHealth,
    createTargetState('chain-maw', 1).maxHealth + 2
  );
});

test('advance is blocked until the current encounter is captured or defeated', () => {
  const state = createInitialState();
  const nextState = advanceEncounter(state);

  assert.equal(nextState.encounterIndex, 0);
  assert.equal(canAdvanceEncounter(nextState), false);
  assert.match(nextState.log.at(-1), /cannot descend/i);
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
  state = extractExpedition(state);

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

test('anchor recovery thins with depth', () => {
  assert.equal(anchorHeal(1), 3);
  assert.equal(anchorHeal(3), 1);
  assert.equal(anchorHeal(5), 1);
});

test('anchoring sheds beast fatigue and marks the layer anchored', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth', 'chain-maw'] });
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  assert.equal(s.party.beasts['grave-hound'].fatigue, 1);

  s = anchorExpedition(s);
  assert.equal(s.party.beasts['grave-hound'].fatigue, 0);
  assert.equal(s.currentEncounter.anchored, true);
});

test('anchoring heals a wounded leader, capped at max', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth', 'chain-maw', 'storm-antler'] });
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  s = advanceEncounter(s); // carryover wounds the leader
  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove');
  s = attemptCapture(s);

  const before = s.party.leader.health;
  s = anchorExpedition(s);
  assert.ok(s.party.leader.health > before);
  assert.ok(s.party.leader.health <= s.party.leader.maxHealth);
});

test('anchoring is unavailable until the layer is resolved and only once per layer', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'] });
  assert.equal(anchorExpedition(s), s); // unresolved

  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove');
  s = attemptCapture(s);
  s = anchorExpedition(s);
  const anchored = s;
  assert.equal(anchorExpedition(s), anchored); // already anchored -> no-op
});

test('the descent is endless: descending past the planned layers never auto-completes', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth', 'chain-maw'] });
  for (let i = 0; i < 4; i += 1) {
    s = withdrawEncounter(s);
    s = advanceEncounter(s);
    assert.equal(s.expeditionComplete, false);
  }
  assert.equal(s.currentEncounter.depth, 5);
});

test('a successful run ends only by extracting', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'] });
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  assert.equal(s.expeditionComplete, false); // resolving a layer does not end the run

  s = extractExpedition(s);
  assert.equal(s.expeditionComplete, true);
});

test('extracting after a resolved layer ends the run and banks the haul', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth', 'chain-maw', 'storm-antler'] });
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s); // layer 1 resolved, 1 capture

  s = extractExpedition(s);

  assert.equal(s.expeditionComplete, true);
  assert.equal(s.result.rank, 'success');
  assert.deepEqual(s.party.captures, ['ashwing-moth']);
  assert.deepEqual(s.roster, ['ashwing-moth']);
  assert.match(s.log.at(-1), /extract/i);
});

test('extract is unavailable until the current layer is resolved', () => {
  const s = createInitialState({ encounterIds: ['chain-maw'] });
  assert.equal(extractExpedition(s), s);
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

  s = extractExpedition(s);
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

// cme.3 — capture scoring: clean (no wrong reads) and fast (quick bind) captures
// earn bonus Lore, and a cleanly captured new species arrives pre-bonded.
test('a clean, fast capture earns bonus lore', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'], lore: 0 });
  s = applyHeroProbe(s, 'ash'); // turn 1, correct read
  s = applyCompanionAction(s, 'grave-hound', 'harry'); // turn 2, corner
  s = attemptCapture(s); // turn 3 -> clean + fast
  s = extractExpedition(s);

  // base 1*3 + depth 1 = 4, + clean(2) + fast(1) = 7
  assert.equal(s.result.bonusLore, 3);
  assert.equal(s.result.loreEarned, 7);
});

test('a sloppy capture (a wrong read) forfeits the clean bonus', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'], lore: 0 });
  s = applyHeroProbe(s, 'storm'); // wrong read -> not clean
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s); // turn 4 -> still fast, not clean
  s = extractExpedition(s);

  // base 4 + fast(1) = 5, no clean bonus
  assert.equal(s.result.bonusLore, 1);
  assert.equal(s.result.loreEarned, 5);
});

test('a cleanly captured new beast joins the roster pre-bonded', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'] });
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s); // clean
  s = extractExpedition(s);

  assert.equal(s.bonds['ashwing-moth'], 1);
});

test('a sloppily captured beast joins the roster unbonded', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'] });
  s = applyHeroProbe(s, 'storm'); // wrong read -> not clean
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  s = extractExpedition(s);

  assert.equal(s.bonds['ashwing-moth'] ?? 0, 0);
});

test('the coach is on by default and can be disabled', () => {
  assert.equal(createInitialState().coach, true);
  assert.equal(createInitialState({ coach: false }).coach, false);
});
