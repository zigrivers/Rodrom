import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createInitialState,
  buildEncounterOrder,
  buyUpgrade,
  upgradeCost,
  toggleFielded,
  fieldCap,
  FIELD_CAP,
} from '../src/state.mjs';
import {
  advanceEncounter,
  anchorHeal,
  applyCompanionAction,
  applyGuardAction,
  applyHeroProbe,
  applyStrikeAction,
  applyToolAction,
  attemptCapture,
  canAdvanceEncounter,
  extractExpedition,
  pressCapture,
  pressurePerTurn,
  recoverAtLayer,
  secureHaul,
  startingPressure,
  withdrawEncounter,
} from '../src/engine.mjs';
import { createTargetState, isEliteDepth } from '../src/state.mjs';

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

// cme.6 — run variety: the fixed tutorial opener is reserved for the first run;
// later runs rotate the full pool so any quarry can open.
test('the opener is fixed only on the first run; later runs vary it', () => {
  assert.equal(buildEncounterOrder(0, true)[0], 'ashwing-moth'); // run 1 = gentle tutorial

  const openers = [0, 1, 2, 3].map((v) => buildEncounterOrder(v, false)[0]);
  assert.ok(new Set(openers).size > 1, 'opener should vary across runs');
  assert.ok(openers.some((o) => o !== 'ashwing-moth'), 'opener need not be the tutorial beast');
  assert.ok(buildEncounterOrder(0, false).includes('veil-lynx'), 'deception beast appears in rotation');
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

// G3b — keep Lore meaningful: a steeper cost curve plus a run-changing sink
// (the Kennel raises the field cap, so Lore buys more passives in play).
test('the Lore cost curve is steeper so Lore keeps its weight', () => {
  assert.equal(upgradeCost('infirmary', 0), 5);
  assert.equal(upgradeCost('infirmary', 1), 20);
  assert.equal(upgradeCost('infirmary', 2), 45);
});

test('the Kennel raises the field cap so Lore buys more passives in play', () => {
  assert.equal(fieldCap({}), FIELD_CAP);
  assert.equal(fieldCap({ kennel: 2 }), FIELD_CAP + 2);

  const base = ['grave-hound', 'mireback-tortoise', 'chain-maw', 'veil-lynx']; // base cap
  assert.equal(toggleFielded(base, 'storm-antler', fieldCap({ kennel: 1 })).length, 5);
});

test('buying the Kennel spends lore and is a real town service', () => {
  const town = createInitialState({ started: false, lore: 30, upgrades: {} });
  const after = buyUpgrade(town, 'kennel');
  assert.equal(after.upgrades.kennel, 1);
  assert.equal(after.lore, 30 - upgradeCost('kennel', 0));
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

  // +1 for completing a run with it fielded, +1 for fusing the duplicate capture (cme.7)
  assert.equal(s.bonds['chain-maw'], 2);
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

// G3c — elite "Dire" quarries appear at deep layers: tougher, tagged, and worth
// bonus Lore, so descending introduces interest instead of recycling the same beasts.
test('elite layers appear at depth and tag a tougher, richer quarry', () => {
  assert.equal(isEliteDepth(1), false);
  assert.equal(isEliteDepth(3), false);
  assert.equal(isEliteDepth(4), true);
  assert.equal(isEliteDepth(8), true);

  const elite = createTargetState('chain-maw', 4);
  assert.equal(elite.elite, true);
  assert.match(elite.name, /Dire/);
  assert.ok(elite.maxHealth > createTargetState('chain-maw', 4 - 0).maxHealth - 2); // boosted vs base+depth

  const normal = createTargetState('chain-maw', 1);
  assert.ok(!normal.elite);
});

test('capturing an elite quarry earns bonus Lore', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'], lore: 0 });
  // simulate an elite layer (depth 4)
  s = { ...s, currentEncounter: { ...s.currentEncounter, depth: 4, target: createTargetState('chain-maw', 4) } };
  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove');
  s = attemptCapture(s); // clean + fast
  s = extractExpedition(s);

  assert.equal(s.result.eliteCaptures, 1);
  // base 1*3 + depth 4 + clean/fast 3 + elite 4 + bold 2 = 16 (iron+shove = bold route)
  assert.equal(s.result.loreEarned, 16);
});

// G3a — a field cap makes composition a real trade-off: with a full roster you
// must choose which passives to bring, not field everything.
test('fielding is capped so composition is a real choice', () => {
  assert.equal(FIELD_CAP, 4);
  const full = ['grave-hound', 'mireback-tortoise', 'chain-maw', 'veil-lynx']; // == FIELD_CAP

  // at the cap, fielding another is a no-op
  assert.equal(toggleFielded(full, 'storm-antler').length, 4);
  assert.ok(!toggleFielded(full, 'storm-antler').includes('storm-antler'));

  // benching always works, even at the cap
  assert.deepEqual(toggleFielded(full, 'chain-maw'), ['grave-hound', 'mireback-tortoise', 'veil-lynx']);

  // under the cap, fielding works
  assert.deepEqual(toggleFielded(['grave-hound'], 'chain-maw'), ['grave-hound', 'chain-maw']);
});

test('fielding a subset of beasts omits the unfielded ones from the party', () => {
  const s = createInitialState({ fielded: ['mireback-tortoise'] });
  assert.deepEqual(Object.keys(s.party.beasts), ['mireback-tortoise']);
  assert.deepEqual(s.fielded, ['mireback-tortoise']);
});

// G2 — bond-scaled passives: deepening a bond (via clean captures + dupe fusing)
// makes the ally's passive measurably stronger, so the roster-build loop pays off.
test('Grounding Aura scales its pressure relief with bond', () => {
  const pressureAtDepth5 = (bond) => {
    let s = createInitialState({
      roster: ['storm-antler'],
      fielded: ['storm-antler'],
      bonds: { 'storm-antler': bond },
      encounterIds: ['chain-maw'],
    });
    s = { ...s, currentEncounter: { ...s.currentEncounter, depth: 5 } };
    return applyStrikeAction(s).currentEncounter.pressure; // pressurePerTurn(5) = 3
  };
  assert.equal(pressureAtDepth5(0), 2, 'bond 0 relieves 1 (3 - 1)');
  assert.equal(pressureAtDepth5(4), 0, 'bond 4 relieves 3 (3 - 3)');
});

test('Veilsight also reveals the next layer at a deep bond', () => {
  const deep = createInitialState({
    roster: ['veil-lynx'],
    fielded: ['veil-lynx'],
    bonds: { 'veil-lynx': 3 },
    encounterIds: ['chain-maw', 'storm-antler'],
  });
  assert.ok(deep.codexHints['chain-maw']?.includes('iron'), 'current layer revealed');
  assert.ok(deep.codexHints['storm-antler']?.includes('storm'), 'next layer revealed at deep bond');

  const shallow = createInitialState({
    roster: ['veil-lynx'],
    fielded: ['veil-lynx'],
    bonds: { 'veil-lynx': 1 },
    encounterIds: ['chain-maw', 'storm-antler'],
  });
  assert.ok(shallow.codexHints['chain-maw']?.includes('iron'));
  assert.ok(!(shallow.codexHints['storm-antler'] ?? []).includes('storm'), 'next layer hidden at shallow bond');
});

test('Iron Hold at a deep bond also holds the quarry from escaping', () => {
  let deep = createInitialState({
    roster: ['chain-maw'],
    fielded: ['chain-maw'],
    bonds: { 'chain-maw': 3 },
    encounterIds: ['ashwing-moth'],
  });
  for (let i = 0; i < 5; i += 1) deep = applyHeroProbe(deep, 'storm'); // all wrong reads
  assert.notEqual(deep.currentEncounter.target.captureState, 'escaped', 'deep Iron Hold prevents escape');

  let shallow = createInitialState({
    roster: ['chain-maw'],
    fielded: ['chain-maw'],
    bonds: { 'chain-maw': 1 },
    encounterIds: ['ashwing-moth'],
  });
  for (let i = 0; i < 5; i += 1) shallow = applyHeroProbe(shallow, 'storm');
  assert.equal(shallow.currentEncounter.target.captureState, 'escaped', 'shallow Iron Hold does not');
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

// G1 (checkpoint stakes) — Anchors secure the haul; dying forfeits the
// captures made since the last Anchor, while extracting secures everything.
test('securing locks in the captures made so far', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth', 'chain-maw'] });
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  assert.equal(s.securedCount, 0, 'captures start unsecured');

  s = secureHaul(s);
  assert.equal(s.securedCount, 1, 'securing banks the haul so far');
});

test('dying forfeits unsecured captures but keeps anchored (secured) ones', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth', 'chain-maw', 'storm-antler'] });
  // Layer 1: capture Ashwing, then Anchor to secure it.
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  s = secureHaul(s);
  s = advanceEncounter(s); // depth 2: Chain Maw

  // Layer 2: capture Chain Maw — unsecured (no Anchor after it).
  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove');
  s = attemptCapture(s);

  // Force the leader to the brink, then descend into a fatal carryover.
  s = { ...s, party: { ...s.party, leader: { ...s.party.leader, health: 1 } } };
  s = advanceEncounter(s);

  assert.equal(s.expeditionComplete, true);
  assert.equal(s.result.rank, 'expedition-failure');
  assert.ok(s.roster.includes('ashwing-moth'), 'secured capture is kept');
  assert.ok(!s.roster.includes('chain-maw'), 'unsecured capture is forfeited');
  assert.equal(s.result.forfeited, 1);
});

test('dying after choosing Recover (not Secure) forfeits the unsecured haul', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth', 'chain-maw', 'storm-antler'] });
  // Layer 1: capture Ashwing, then RECOVER (heals, does NOT secure)
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  s = recoverAtLayer(s);
  assert.equal(s.securedCount, 0, 'recover heals but does not secure');
  s = advanceEncounter(s); // depth 2: Chain Maw

  // Layer 2: capture Chain Maw (also unsecured), building carryover for a fatal descent
  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove');
  s = attemptCapture(s);

  s = { ...s, party: { ...s.party, leader: { ...s.party.leader, health: 1 } } };
  s = advanceEncounter(s); // fatal descent

  assert.equal(s.result.rank, 'expedition-failure');
  assert.ok(!s.roster.includes('ashwing-moth'), 'recovered-but-unsecured capture is forfeited');
  assert.equal(s.result.forfeited, 2);
});

test('extracting secures the whole haul, even captures made after the last anchor', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'] });
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  s = extractExpedition(s); // no anchor, but extract secures all

  assert.ok(s.roster.includes('ashwing-moth'));
  assert.equal(s.result.forfeited, 0);
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

test('recovering sheds beast fatigue and marks the layer anchored', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth', 'chain-maw'] });
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  assert.equal(s.party.beasts['grave-hound'].fatigue, 1);

  s = recoverAtLayer(s);
  assert.equal(s.party.beasts['grave-hound'].fatigue, 0);
  assert.equal(s.currentEncounter.anchored, true);
});

test('recovering heals a wounded leader, capped at max', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth', 'chain-maw', 'storm-antler'] });
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  s = advanceEncounter(s); // carryover wounds the leader
  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove');
  s = attemptCapture(s);

  const before = s.party.leader.health;
  s = recoverAtLayer(s);
  assert.ok(s.party.leader.health > before);
  assert.ok(s.party.leader.health <= s.party.leader.maxHealth);
});

test('an anchor is gated until the layer is resolved and is once per layer', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth', 'chain-maw'] });
  assert.equal(recoverAtLayer(s), s, 'unresolved -> no-op');
  assert.equal(secureHaul(s), s, 'unresolved -> no-op');

  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);

  s = recoverAtLayer(s); // spends the layer's single anchor
  const anchored = s;
  assert.equal(secureHaul(s), anchored, 'cannot also secure after recovering');
  assert.equal(recoverAtLayer(s), anchored, 'cannot recover twice');
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

// cme.7 — duplicate-capture payoff: re-capturing an owned species fuses into a
// deeper bond and converts the surplus to Lore, instead of a dead roster dupe.
test('capturing a species you already own deepens its bond, not the roster', () => {
  let s = createInitialState({
    roster: ['chain-maw'],
    bonds: { 'chain-maw': 1 },
    fielded: ['mireback-tortoise'],
    encounterIds: ['chain-maw'],
  });
  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove');
  s = attemptCapture(s);
  s = extractExpedition(s);

  assert.equal(s.roster.filter((id) => id === 'chain-maw').length, 1, 'no dead duplicate entry');
  assert.equal(s.roster.length, 1);
  assert.equal(s.bonds['chain-maw'], 2, 'fused +1 bond');
});

test('a duplicate capture converts the surplus into bonus Lore', () => {
  let s = createInitialState({
    roster: ['chain-maw'],
    bonds: { 'chain-maw': 1 },
    fielded: ['mireback-tortoise'],
    encounterIds: ['chain-maw'],
    lore: 0,
  });
  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove');
  s = attemptCapture(s); // clean + fast
  s = extractExpedition(s);

  assert.equal(s.result.dupesFused, 1);
  assert.equal(s.result.dupeLore, 2);
  // base 4 + capture bonus 3 + dupe convert 2 = 9
  assert.equal(s.result.loreEarned, 9);
});

// cme.4 — town services beyond +HP: distinct Lore sinks that grant capabilities.
test('Quartermaster raises field tool uses per run, scaling with level', () => {
  const base = createInitialState();
  assert.equal(base.party.tools['snare-line'], 2);
  assert.equal(base.party.tools['bait-stake'], 2);

  const stocked = createInitialState({ upgrades: { quartermaster: 2 } });
  assert.equal(stocked.party.tools['snare-line'], 4);
  assert.equal(stocked.party.tools['bait-stake'], 4);
});

test("Scout's Lantern pre-reveals the first quarries' attunements at run start", () => {
  const lit = createInitialState({
    encounterIds: ['chain-maw', 'storm-antler'],
    upgrades: { 'scouts-lantern': 1 },
  });
  assert.ok(lit.codexHints['chain-maw']?.includes('iron'));
  assert.ok(!(lit.codexHints['storm-antler'] ?? []).includes('storm'));

  const brighter = createInitialState({
    encounterIds: ['chain-maw', 'storm-antler'],
    upgrades: { 'scouts-lantern': 2 },
  });
  assert.ok(brighter.codexHints['storm-antler']?.includes('storm'));
});

test('buying the Quartermaster service spends lore and stocks more tools', () => {
  const town = createInitialState({ started: false, lore: 20, upgrades: {} });
  const after = buyUpgrade(town, 'quartermaster');
  assert.equal(after.upgrades.quartermaster, 1);
  assert.equal(after.lore, 20 - upgradeCost('quartermaster', 0));
  assert.equal(after.party.tools['snare-line'], 3);
});

// cme.5 — depth-scaled threats: deeper layers begin under pressure (a depth
// ambush), so the frenzy clock fires and HP/Anchors/Infirmary actually matter.
test('deeper layers carry a higher starting pressure (depth ambush)', () => {
  assert.equal(startingPressure(1), 0);
  assert.equal(startingPressure(2), 0);
  assert.equal(startingPressure(3), 1);
  assert.equal(startingPressure(5), 2);
});

// cme.6 — run omens: a run-level modifier picked at the start that changes how
// the run plays (the shelved Entry Oracle concept).
test('the Restless Deep omen raises the starting pressure of every layer', () => {
  const calm = createInitialState({ encounterIds: ['chain-maw'] });
  assert.equal(calm.currentEncounter.pressure, 0);

  const restless = createInitialState({ encounterIds: ['chain-maw'], omen: 'restless-deep' });
  assert.equal(restless.currentEncounter.pressure, 1);
  assert.equal(restless.omen.name, 'Restless Deep');
});

test('the Bountiful Vein omen adds bonus Lore per capture', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'], lore: 0, omen: 'bountiful-vein' });
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s); // clean + fast
  s = extractExpedition(s);
  // base 4 + capture bonus 3 + omen (2 per capture * 1) = 9
  assert.equal(s.result.loreEarned, 9);
});

test('the Thin Veil omen pre-reveals the opening quarry attunement', () => {
  const s = createInitialState({ encounterIds: ['chain-maw'], omen: 'thin-veil' });
  assert.ok(s.codexHints['chain-maw']?.includes('iron'));
});

test('an unknown omen id is treated as no omen', () => {
  const s = createInitialState({ encounterIds: ['chain-maw'], omen: 'not-a-real-omen' });
  assert.equal(s.omen, null);
  assert.equal(s.currentEncounter.pressure, 0);
});

test('descending into a deeper layer starts it already under pressure', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth', 'chain-maw', 'storm-antler'] });
  // layer 1 (depth 1) begins calm
  assert.equal(s.currentEncounter.pressure, 0);

  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  s = advanceEncounter(s); // depth 2

  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove');
  s = attemptCapture(s);
  s = advanceEncounter(s); // depth 3

  assert.equal(s.currentEncounter.depth, 3);
  assert.equal(s.currentEncounter.pressure, startingPressure(3));
  assert.ok(s.currentEncounter.pressure > 0);
});

test('every encounter starts at press level 0', () => {
  const fresh = createInitialState({ encounterIds: ['chain-maw'] });
  assert.equal(fresh.currentEncounter.pressLevel, 0);
});

test('secureHaul locks in the haul without healing', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth', 'chain-maw'] });
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  s = { ...s, party: { ...s.party, leader: { ...s.party.leader, health: 3 } } };

  const before = s.party.leader.health;
  s = secureHaul(s);

  assert.equal(s.securedCount, 1, 'haul secured');
  assert.equal(s.party.leader.health, before, 'no healing');
  assert.equal(s.currentEncounter.anchored, true, 'consumes the layer anchor');
});

test('recoverAtLayer heals and sheds fatigue without securing', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth', 'chain-maw'] });
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  s = { ...s, party: { ...s.party, leader: { ...s.party.leader, health: 2 } } };

  s = recoverAtLayer(s);

  assert.equal(s.party.leader.health, 2 + anchorHeal(1), 'leader healed');
  assert.equal(s.party.beasts['grave-hound'].fatigue, 0, 'fatigue shed (was 1, -2 floored at 0)');
  assert.equal(s.securedCount, 0, 'haul NOT secured');
  assert.equal(s.currentEncounter.anchored, true, 'consumes the layer anchor');
});

test('pressing a bindable target raises press level and spends a turn', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'] });
  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove'); // -> bindable
  assert.equal(s.currentEncounter.target.captureState, 'bindable');
  const turnBefore = s.currentEncounter.turn;

  s = pressCapture(s);

  assert.equal(s.currentEncounter.pressLevel, 1, 'press level up');
  assert.equal(s.currentEncounter.turn, turnBefore + 1, 'a turn was spent');
});

test('pressing a target that is not bindable does not raise press level', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'] });
  s = applyHeroProbe(s, 'iron'); // probed but not yet bindable (no posture)
  s = pressCapture(s);
  assert.equal(s.currentEncounter.pressLevel, 0);
});

test('binding after pressing banks bonus Lore and a perfect-catch bond', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'], lore: 0 });
  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove'); // bindable, windowDecay now 1
  s = pressCapture(s); // pressLevel 1, windowDecay 2 (still bindable)
  assert.equal(s.currentEncounter.target.captureState, 'bindable');
  s = attemptCapture(s); // bind at pressLevel 1
  s = extractExpedition(s);

  // base 1*3 + depth 1 = 4; clean+fast bonus 3; press 1*2 = 2  => 9
  assert.equal(s.result.loreEarned, 9);
});

test('a deeply pressed catch (level >= 2) arrives with an extra bond', () => {
  let s = createInitialState({ roster: ['chain-maw'], fielded: ['mireback-tortoise', 'chain-maw'], encounterIds: ['chain-maw'], bonds: { 'chain-maw': 0 } });
  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove'); // bindable (Iron Hold from fielded chain-maw => no decay)
  s = pressCapture(s); // 1
  s = pressCapture(s); // 2 (no slip: Iron Hold)
  assert.equal(s.currentEncounter.target.captureState, 'bindable');
  s = attemptCapture(s);
  s = extractExpedition(s);

  // chain-maw is a dupe (already owned) so it fuses (+1); pressLevel>=2 adds a further +1;
  // plus fielded-ally bond (+1). bonds: 0 +1(fielded) +1(fuse) +1(press) = 3
  assert.equal(s.bonds['chain-maw'], 3);
});

test('pressing until the window closes slips the beast and resets press level', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'] });
  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove'); // bindable, windowDecay 1
  s = pressCapture(s); // windowDecay 2 (warning)
  s = pressCapture(s); // windowDecay 3 -> slip
  assert.notEqual(s.currentEncounter.target.captureState, 'bindable', 'beast slipped');
  assert.equal(s.currentEncounter.pressLevel, 0, 'press level reset on slip');
});

test('Iron Hold lets you press without the window slipping', () => {
  let s = createInitialState({ roster: ['chain-maw'], fielded: ['mireback-tortoise', 'chain-maw'], encounterIds: ['chain-maw'] });
  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove');
  s = pressCapture(s);
  s = pressCapture(s);
  s = pressCapture(s);
  assert.equal(s.currentEncounter.target.captureState, 'bindable', 'still bindable');
  assert.equal(s.currentEncounter.pressLevel, 3, 'pressed three times safely');
});

test('pressing while pressure is high can frenzy and wound the leader', () => {
  // staked snare keeps the window open so we can press into a frenzy without slipping
  let s = createInitialState({ encounterIds: ['chain-maw'] });
  s = applyToolAction(s, 'snare-line'); // window will not decay
  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove'); // bindable
  const hp0 = s.party.leader.health;
  for (let i = 0; i < 8 && s.party.leader.health === hp0; i += 1) {
    s = pressCapture(s);
  }
  assert.ok(s.party.leader.health < hp0, 'a frenzy during a long press wounded the leader');
});

test('dual-path altBind activates only for non-concealed elites', () => {
  const normal = createTargetState('chain-maw', 1);
  assert.equal(normal.altBind, null, 'normal beast is single-path');

  const elite = createTargetState('chain-maw', 4); // isEliteDepth(4) === true
  assert.deepEqual(elite.altBind, { attunement: 'storm', bindKind: 'ground', bindPosture: 'grounded' });

  const direVeil = createTargetState('veil-lynx', 4); // concealed -> excluded
  assert.equal(direVeil.altBind, null, 'concealed elite stays single-path');
});

test('probing the alt attunement on a Dire beast reads as a valid alt match', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'] });
  s = { ...s, currentEncounter: { ...s.currentEncounter, depth: 4, target: createTargetState('chain-maw', 4) } };
  s = applyHeroProbe(s, 'storm'); // alt attunement for Dire Chain Maw

  assert.equal(s.currentEncounter.flags.altAttunementMatch, true, 'alt read registered');
  assert.equal(s.currentEncounter.escapeProgress ?? 0, 0, 'a valid alt read is not a wrong read');
  assert.ok((s.codexHints['chain-maw'] ?? []).includes('storm'), 'alt read recorded as a clue');
});

test('probing that same attunement on a NON-elite beast is still a wrong read', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'] }); // depth 1, not elite, altBind null
  s = applyHeroProbe(s, 'storm'); // wrong for a normal Chain Maw (it answers to iron)

  assert.equal(s.currentEncounter.flags.altAttunementMatch, false);
  assert.equal(s.currentEncounter.escapeProgress, 1, 'wrong read raises escape risk');
});

test('a Dire beast is bindable via its patient route alone', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'] });
  s = { ...s, currentEncounter: { ...s.currentEncounter, depth: 4, target: createTargetState('chain-maw', 4) } };
  s = applyHeroProbe(s, 'storm');               // alt attunement
  s = applyToolAction(s, 'bait-stake');          // ground -> alt posture 'grounded'
  assert.equal(s.currentEncounter.target.captureState, 'bindable', 'patient route opens the window');
  assert.equal(s.currentEncounter.flags.agitated, false, 'patient route does not agitate');
});

test('a Dire beast bound the bold way agitates the quarry', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'] });
  s = { ...s, currentEncounter: { ...s.currentEncounter, depth: 4, target: createTargetState('chain-maw', 4) } };
  s = applyHeroProbe(s, 'iron');                 // primary attunement
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove'); // stagger -> bold posture
  assert.equal(s.currentEncounter.target.captureState, 'bindable', 'bold route opens the window');
  assert.equal(s.currentEncounter.flags.agitated, true, 'bold route agitates');
});

test('agitation from the bold route adds per-turn pressure', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'] });
  s = { ...s, currentEncounter: { ...s.currentEncounter, depth: 4, target: createTargetState('chain-maw', 4) } };
  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove'); // bold drive -> agitated
  const pressureAfterBold = s.currentEncounter.pressure;

  // a calm reference: same setup but the patient route (no agitation)
  let c = createInitialState({ encounterIds: ['chain-maw'] });
  c = { ...c, currentEncounter: { ...c.currentEncounter, depth: 4, target: createTargetState('chain-maw', 4) } };
  c = applyHeroProbe(c, 'storm');
  c = applyToolAction(c, 'bait-stake'); // patient drive -> calm
  const pressureAfterPatient = c.currentEncounter.pressure;

  assert.ok(pressureAfterBold > pressureAfterPatient, 'agitation makes the bold line press harder');
});

test('a bold-route elite capture banks bonus Lore and a bond', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'], lore: 0 });
  s = { ...s, currentEncounter: { ...s.currentEncounter, depth: 4, target: createTargetState('chain-maw', 4) } };
  s = applyHeroProbe(s, 'iron');
  s = applyCompanionAction(s, 'mireback-tortoise', 'shove'); // bold -> bindable
  s = attemptCapture(s);
  s = extractExpedition(s);

  // bond: clean-capture pre-bond (+1, cme.3) + bold-route bond (+1) = 2
  assert.equal(s.bonds['chain-maw'], 2, 'bold catch deepens the bond beyond the clean pre-bond');
  // base 1*3 + depth 4 = 7; elite +4; clean/fast +3; bold +2 => 16 (no dupe; chain-maw is new)
  assert.equal(s.result.loreEarned, 16);
});

test('a patient-route elite capture is plain (no bold bonus)', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'], lore: 0 });
  s = { ...s, currentEncounter: { ...s.currentEncounter, depth: 4, target: createTargetState('chain-maw', 4) } };
  s = applyHeroProbe(s, 'storm');
  s = applyToolAction(s, 'bait-stake'); // patient -> bindable
  s = attemptCapture(s);
  s = extractExpedition(s);

  // bond: only the clean-capture pre-bond (+1, cme.3) — NO bold-route bond
  assert.equal(s.bonds['chain-maw'], 1, 'patient catch grants only the clean pre-bond, not the bold bond');
  // base 1*3 + depth 4 = 7; elite +4; clean +2 (no wrong reads); fast +1 (bind on turn 3) => 14
  assert.equal(s.result.loreEarned, 14);
});

test('a truly-wrong read (neither route) still escapes a dual-path elite', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'] });
  s = { ...s, currentEncounter: { ...s.currentEncounter, depth: 4, target: createTargetState('chain-maw', 4) } };
  // Dire Chain Maw answers to iron (bold) or storm (patient); veil is neither.
  s = applyHeroProbe(s, 'veil');
  s = applyHeroProbe(s, 'veil');
  s = applyHeroProbe(s, 'veil');
  assert.equal(s.currentEncounter.target.captureState, 'escaped', 'wrong reads still escape on a Dire beast');
});

test('a Dire Veil Lynx stays single-path and captures via its reveal route', () => {
  let s = createInitialState({ encounterIds: ['veil-lynx'] }); // default party fields grave-hound + mireback
  s = { ...s, currentEncounter: { ...s.currentEncounter, depth: 4, target: createTargetState('veil-lynx', 4) } };
  assert.equal(s.currentEncounter.target.altBind, null, 'concealed elite has no alt route');

  s = applyCompanionAction(s, 'grave-hound', 'scent-read'); // reveal -> posture revealed + attunement hint
  s = applyHeroProbe(s, 'veil');                            // lock in the revealed attunement
  assert.equal(s.currentEncounter.target.captureState, 'bindable', 'single-path concealed capture still works');
});
