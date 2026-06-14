import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState } from '../src/state.mjs';
import {
  advanceEncounter,
  applyCompanionAction,
  applyHeroProbe,
  applyToolAction,
  attemptCapture,
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
  assert.doesNotMatch(html, /Probe Veil/);
  assert.doesNotMatch(html, /Salt Marker/);
});

test('the encounter view coaches the player toward the capture path', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'] });
  assert.match(renderApp(s), /Learn what Ashwing Moth responds to/i);

  s = applyHeroProbe(s, 'ash');
  assert.match(renderApp(s), /make it cornered/i);

  s = applyCompanionAction(s, 'grave-hound', 'harry');
  assert.match(renderApp(s), /Capture now before it closes/i);
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

test('renderApp offers a withdraw option during an active encounter', () => {
  const html = renderApp(createInitialState({ encounterIds: ['storm-antler'] }));
  assert.match(html, /data-action="withdraw"(?![^>]*disabled)/);
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
  state = advanceEncounter(state);

  const html = renderApp(state);

  assert.match(html, /Expedition Complete/);
  assert.match(html, /Learned Clue Summary/);
  assert.match(html, /Ashwing Moth/);
  assert.match(html, /Ash/);
});
