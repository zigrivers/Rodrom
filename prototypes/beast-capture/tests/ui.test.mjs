import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState } from '../src/state.mjs';
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
