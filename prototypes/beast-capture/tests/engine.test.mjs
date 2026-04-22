import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState } from '../src/state.mjs';
import {
  applyHeroProbe,
  applyToolAction,
  applyCompanionAction,
  attemptCapture,
  advanceEncounter,
} from '../src/engine.mjs';

test('Ashwing Moth becomes bindable after the correct ash read and snare setup', () => {
  let state = createInitialState({ encounterIds: ['ashwing-moth'] });

  state = applyHeroProbe(state, 'ash');
  state = applyToolAction(state, 'snare-line');
  state = applyCompanionAction(state, 'grave-hound', 'harry');

  assert.equal(state.currentEncounter.target.captureState, 'bindable');
});

test('Capture attempt fails cleanly before a beast is bindable', () => {
  let state = createInitialState({ encounterIds: ['chain-maw'] });
  state = attemptCapture(state);

  assert.equal(state.currentEncounter.target.captureState, 'unreadable');
  assert.match(state.log.at(-1), /not ready to bind/i);
});

test('Advance encounter carries wounds, spent tools, and clue discoveries forward', () => {
  let state = createInitialState({ encounterIds: ['ashwing-moth', 'veil-lynx'] });
  state = applyHeroProbe(state, 'ash');
  state = applyToolAction(state, 'snare-line');
  state = applyCompanionAction(state, 'grave-hound', 'harry');
  state = attemptCapture(state);
  state = advanceEncounter(state);

  assert.equal(state.encounterIndex, 1);
  assert.equal(state.party.tools['snare-line'], 0);
  assert.ok(state.codexHints['ashwing-moth'].includes('ash'));
  assert.equal(state.currentEncounter.target.id, 'veil-lynx');
});
