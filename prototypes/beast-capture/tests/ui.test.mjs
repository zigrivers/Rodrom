import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState } from '../src/state.mjs';
import {
  advanceEncounter,
  applyCompanionAction,
  applyHeroProbe,
  applyToolAction,
  attemptCapture,
  extractExpedition,
} from '../src/engine.mjs';
import { renderApp } from '../src/ui.mjs';

test('renderApp exposes the browser-visible probes, tools, and beast actions for the default run', () => {
  const html = renderApp(createInitialState());

  assert.match(html, /Probe Ash/);
  assert.match(html, /Probe Iron/);
  assert.match(html, /Probe Storm/);
  assert.match(html, /Snare Line/);
  assert.match(html, /Bait Stake/);
  assert.match(html, /Grave Hound: Harry/);
  assert.match(html, /Mireback: Brace/);
  assert.match(html, /Probe Veil/);
  assert.doesNotMatch(html, /Salt Marker/);
});

test('renderApp shows a start screen before the expedition begins', () => {
  const html = renderApp(createInitialState({ started: false }));
  assert.match(html, /Spiral Descent/);
  assert.match(html, /data-action="start-expedition"/);
  assert.doesNotMatch(html, /data-action="probe-ash"/);
});

test('the start screen frames the full loop, not just the capture slice (cme.8)', () => {
  const html = renderApp(createInitialState({ started: false }));
  assert.match(html, /descend/i);
  assert.match(html, /roster|town|bond/i);
});

test('the town (start screen) shows lore and an upgrade option', () => {
  const html = renderApp(createInitialState({ started: false, lore: 12 }));
  assert.match(html, /Lore: 12/);
  assert.match(html, /data-action="buy-infirmary"/);
});

test('the town offers multiple distinct services to spend Lore on (cme.4)', () => {
  const html = renderApp(createInitialState({ started: false, lore: 30 }));
  assert.match(html, /data-action="buy-infirmary"/);
  assert.match(html, /data-action="buy-quartermaster"/);
  assert.match(html, /data-action="buy-scouts-lantern"/);
});

test('the result screen reports lore earned', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'] });
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  s = extractExpedition(s);

  assert.match(renderApp(s), /lore/i);
});

test('the start screen lets you select which beasts to field', () => {
  const html = renderApp(createInitialState({ started: false }));
  assert.match(html, /data-action="toggle-grave-hound"/);
  assert.match(html, /data-action="toggle-mireback-tortoise"/);
});

test('the party picker lists captured roster beasts as fieldable', () => {
  const html = renderApp(createInitialState({ started: false, roster: ['ashwing-moth'] }));
  assert.match(html, /data-action="toggle-ashwing-moth"/);
});

test('the party picker shows each captured ally its distinct passive power', () => {
  const html = renderApp(createInitialState({ started: false, roster: ['chain-maw'] }));
  assert.match(html, /Iron Hold/);
});

test('a fielded captured beast gets its signature action button in an encounter', () => {
  const html = renderApp(
    createInitialState({ roster: ['chain-maw'], fielded: ['chain-maw'], encounterIds: ['veil-lynx'] })
  );
  assert.match(html, /Chain Maw: Slam/);
});

test('unfielded beasts get no action buttons in an encounter', () => {
  const html = renderApp(createInitialState({ fielded: ['mireback-tortoise'], encounterIds: ['chain-maw'] }));
  assert.doesNotMatch(html, /Grave Hound: Harry/);
  assert.match(html, /Mireback: Shove/);
});

test('the start screen shows the carried-over roster', () => {
  const html = renderApp(createInitialState({ started: false, roster: ['ashwing-moth'] }));
  assert.match(html, /Roster/);
  assert.match(html, /Ashwing Moth/);
});

test('the result screen shows the persistent roster including prior captures', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'], roster: ['chain-maw'] });
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  s = extractExpedition(s);

  const html = renderApp(s);
  assert.match(html, /Roster/);
  assert.match(html, /Chain Maw/);
  assert.match(html, /Ashwing Moth/);
});

test('the encounter view coaches the player toward the capture path', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'] });
  assert.match(renderApp(s), /Learn what Ashwing Moth responds to/i);

  s = applyHeroProbe(s, 'ash');
  assert.match(renderApp(s), /make it cornered/i);

  s = applyCompanionAction(s, 'grave-hound', 'harry');
  assert.match(renderApp(s), /Capture now before it closes/i);
});

test('after scent-read reveals the attunement, the coach says to probe it', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'] });
  s = applyCompanionAction(s, 'grave-hound', 'scent-read');

  assert.match(renderApp(s), /probe Ash to lock it in/i);
});

test('a concealed beast is coached to reveal it with Scent Read', () => {
  const s = createInitialState({ encounterIds: ['veil-lynx'] });
  assert.match(renderApp(s), /reveal it/i);
});

test('renderApp exposes the full grave-hound and mireback action sets', () => {
  const html = renderApp(createInitialState());

  assert.match(html, /Grave Hound: Scent Read/);
  assert.match(html, /Grave Hound: Harry/);
  assert.match(html, /Grave Hound: Warning Bark/);
  assert.match(html, /Mireback: Brace/);
  assert.match(html, /Mireback: Shove/);
  assert.match(html, /Mireback: Burden Shelter/);
});

test('renderApp disables advance until the encounter is resolved', () => {
  const unresolved = renderApp(createInitialState({ encounterIds: ['ashwing-moth'] }));
  assert.match(unresolved, /data-action="advance"[^>]*disabled/);

  let state = createInitialState({ encounterIds: ['ashwing-moth'] });
  state = applyHeroProbe(state, 'ash');
  state = applyToolAction(state, 'snare-line');
  state = applyCompanionAction(state, 'grave-hound', 'harry');
  state = attemptCapture(state);

  const resolved = renderApp(state);
  assert.match(resolved, /Advance: Ready/);
  assert.doesNotMatch(resolved, /data-action="advance"[^>]*disabled/);
});

test('renderApp shows turn, tool counts, structures, learned clues, and advance status', () => {
  let state = createInitialState({ encounterIds: ['chain-maw'] });
  state = applyHeroProbe(state, 'iron');
  state = applyToolAction(state, 'bait-stake');

  const html = renderApp(state);

  assert.match(html, /Turn: 3/);
  assert.match(html, /Advance: Locked/);
  assert.match(html, /Snare Line: 2/);
  assert.match(html, /Bait Stake: 1/);
  assert.match(html, /Placed Structures/);
  assert.match(html, /Bait Stake/);
  assert.match(html, /Learned Clues/);
  assert.match(html, /Iron/);
});

test('renderApp hides normal encounter actions once an encounter is resolved', () => {
  let state = createInitialState({ encounterIds: ['ashwing-moth'] });
  state = applyHeroProbe(state, 'ash');
  state = applyToolAction(state, 'snare-line');
  state = applyCompanionAction(state, 'grave-hound', 'harry');
  state = attemptCapture(state);

  const html = renderApp(state);

  assert.match(html, /data-action="advance"(?![^>]*disabled)/);
  assert.match(html, /data-action="strike"[^>]*disabled/);
  assert.match(html, /data-action="guard"[^>]*disabled/);
  assert.match(html, /data-action="probe-ash"[^>]*disabled/);
  assert.match(html, /data-action="tool-snare-line"[^>]*disabled/);
  assert.match(html, /data-action="hound-harry"[^>]*disabled/);
  assert.match(html, /data-action="capture"[^>]*disabled/);
});

test('learned clues from earlier encounters stay visible during play', () => {
  let s = createInitialState();
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  s = advanceEncounter(s); // now on the second encounter

  const html = renderApp(s);
  assert.match(html, /Codex/);
  assert.match(html, /Ashwing Moth: Ash/i);
});

test('an Anchor option appears once a layer is resolved', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth', 'chain-maw'] });
  assert.doesNotMatch(renderApp(s), /data-action="anchor"(?![^>]*disabled)/);

  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);

  assert.match(renderApp(s), /data-action="anchor"(?![^>]*disabled)/);
});

test('an Extract option appears once a layer is resolved', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth', 'chain-maw'] });
  assert.doesNotMatch(renderApp(s), /data-action="extract"(?![^>]*disabled)/);

  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);

  assert.match(renderApp(s), /data-action="extract"(?![^>]*disabled)/);
});

test('renderApp offers a withdraw option during an active encounter', () => {
  const html = renderApp(createInitialState({ encounterIds: ['storm-antler'] }));
  assert.match(html, /data-action="withdraw"(?![^>]*disabled)/);
});

test('the encounter view shows the current layer depth', () => {
  const html = renderApp(createInitialState({ encounterIds: ['chain-maw'] }));
  assert.match(html, /Layer 1/);
});

test('the encounter action bar is grouped, not a flat wall of buttons (cme.9)', () => {
  const html = renderApp(createInitialState({ encounterIds: ['chain-maw'] }));
  assert.match(html, /class="action-group"/);
  assert.match(html, /Reads/);
  assert.match(html, /Resolve/);
  // all the underlying actions are still present, just organized
  assert.match(html, /data-action="probe-iron"/);
  assert.match(html, /data-action="capture"/);
});

test('the encounter view shows the active run omen (cme.6)', () => {
  const html = renderApp(createInitialState({ encounterIds: ['chain-maw'], omen: 'restless-deep' }));
  assert.match(html, /Omen:/);
  assert.match(html, /Restless Deep/);
});

test('the encounter view conveys state through cues, not literal meters', () => {
  const html = renderApp(createInitialState({ encounterIds: ['chain-maw'] }));

  assert.doesNotMatch(html, /Capture state:/);
  assert.doesNotMatch(html, /Pressure: \d/);
  assert.match(html, /Posture:/);
  assert.match(html, /calm|restless|agitated|frenzied/i);
});

test('the encounter view warns when bad reads are spooking the quarry', () => {
  let s = createInitialState({ encounterIds: ['chain-maw'] });
  s = applyHeroProbe(s, 'stone'); // wrong read raises escape risk

  assert.match(renderApp(s), /spooking it/i);
});

test('renderApp does not present one-step defense effects as persistent status fields', () => {
  const html = renderApp(createInitialState({ encounterIds: ['storm-antler'] }));

  assert.doesNotMatch(html, /Guard:/);
  assert.doesNotMatch(html, /Brace:/);
  assert.match(html, /Guard/);
  assert.match(html, /Mireback: Brace/);
});

test('renderApp only shows confirmed probes as learned clues', () => {
  let state = createInitialState({ encounterIds: ['chain-maw'] });
  state = applyHeroProbe(state, 'stone');
  state = applyHeroProbe(state, 'iron');

  const html = renderApp(state);

  assert.match(html, /Learned Clues/);
  assert.match(html, /Iron/);
  assert.doesNotMatch(html, /Stone/);
});

test('renderApp shows a learned clue summary on the expedition result screen', () => {
  let state = createInitialState({ encounterIds: ['ashwing-moth'] });
  state = applyHeroProbe(state, 'ash');
  state = applyToolAction(state, 'snare-line');
  state = applyCompanionAction(state, 'grave-hound', 'harry');
  state = attemptCapture(state);
  state = extractExpedition(state);

  const html = renderApp(state);

  assert.match(html, /Expedition Complete/);
  assert.match(html, /Learned Clue Summary/);
  assert.match(html, /Ashwing Moth/);
  assert.match(html, /Ash/);
});

// cme.3 — the coach can be demoted to an oblique "tracker", and capture quality
// is surfaced on the result screen.
test('with the coach off, guidance is oblique rather than prescriptive', () => {
  const html = renderApp(createInitialState({ coach: false, encounterIds: ['ashwing-moth'] }));
  assert.match(html, /Read the quarry yourself/i);
  assert.doesNotMatch(html, /probe Ash to lock it in/i);
  assert.doesNotMatch(html, /make it cornered/i);
});

test('the coach can be toggled from the start screen', () => {
  const html = renderApp(createInitialState({ started: false }));
  assert.match(html, /data-action="toggle-coach"/);
});

test('the result screen reports the clean/fast capture bonus', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'] });
  s = applyHeroProbe(s, 'ash');
  s = applyCompanionAction(s, 'grave-hound', 'harry');
  s = attemptCapture(s);
  s = extractExpedition(s);

  assert.match(renderApp(s), /Capture bonus/i);
});

test('the result screen reports duplicate captures fused into bonds (cme.7)', () => {
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

  assert.match(renderApp(s), /fused|duplicate/i);
});
