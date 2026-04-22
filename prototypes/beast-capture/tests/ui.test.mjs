import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState } from '../src/state.mjs';
import {
  applyGuardAction,
  applyHeroProbe,
  applyStrikeAction,
  applyToolAction,
  applyCompanionAction,
  attemptCapture,
  advanceEncounter,
} from '../src/engine.mjs';
import { renderApp } from '../src/ui.mjs';

test('renderApp shows the current target and action controls', () => {
  const html = renderApp(createInitialState({ encounterIds: ['ashwing-moth'] }));

  assert.match(html, /Ashwing Moth/);
  assert.match(html, /Strike/);
  assert.match(html, /Probe/);
  assert.match(html, /Snare Line/);
});

test('renderApp disables capture until the target is bindable', () => {
  const html = renderApp(createInitialState({ encounterIds: ['ashwing-moth'] }));
  assert.match(html, /data-action="capture"[^>]*disabled/);
});

test('renderApp reflects strike damage in the target panel', () => {
  let state = createInitialState({ encounterIds: ['ashwing-moth'] });
  state = applyStrikeAction(state);

  const html = renderApp(state);

  assert.match(html, /Target HP: 1\/2/);
  assert.match(html, /data-action="capture"[^>]*disabled/);
});

test('renderApp reflects a guarded stance and capture enablement stays state-driven', () => {
  let state = createInitialState({ encounterIds: ['ashwing-moth'] });
  state = applyGuardAction(state);
  state = applyHeroProbe(state, 'ash');
  state = applyToolAction(state, 'snare-line');
  state = applyCompanionAction(state, 'grave-hound', 'harry');

  const html = renderApp(state);

  assert.match(html, /Guard: Raised/);
  assert.match(html, /data-action="capture"(?![^>]*disabled)/);
});

test('renderApp shows elevated encounter risk after failed reads and fatigue carryover', () => {
  let state = createInitialState({ encounterIds: ['chain-maw', 'veil-lynx'] });
  state = applyHeroProbe(state, 'stone');
  state = applyCompanionAction(state, 'grave-hound', 'harry');
  state = advanceEncounter(state);

  const html = renderApp(state);

  assert.match(html, /Risk: High/);
});

test('renderApp shows the expedition result screen after the final capture', () => {
  let state = createInitialState({ encounterIds: ['ashwing-moth'] });
  state = applyHeroProbe(state, 'ash');
  state = applyToolAction(state, 'snare-line');
  state = applyCompanionAction(state, 'grave-hound', 'harry');
  state = attemptCapture(state);
  state = advanceEncounter(state);

  const html = renderApp(state);

  assert.match(html, /Expedition Complete/);
  assert.match(html, /Result: strong-success/);
  assert.match(html, /Run Again/);
});
