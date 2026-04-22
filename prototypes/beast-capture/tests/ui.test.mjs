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
