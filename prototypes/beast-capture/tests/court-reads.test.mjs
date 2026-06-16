import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.mjs';
import { applyHeroProbe } from '../src/engine.mjs';

test('probing the lead court sets attunementMatch and reacts sharply', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'] });
  s = applyHeroProbe(s, 'heat'); // ash is the Heat lead
  assert.equal(s.currentEncounter.flags.attunementMatch, true);
  assert.match(s.log.at(-2), /sharply/);
});

test('an exact attunement still works (normalizes to its court) for back-compat', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'] });
  s = applyHeroProbe(s, 'ash');
  assert.equal(s.currentEncounter.flags.attunementMatch, true);
});

test('probing a foreign court is a wrong read (escape progresses)', () => {
  let s = createInitialState({ encounterIds: ['ashwing-moth'] });
  s = applyHeroProbe(s, 'sky'); // ashwing is Heat, not Sky
  assert.equal(s.currentEncounter.flags.attunementMatch, false);
  assert.equal(s.currentEncounter.escapeProgress, 1);
  assert.match(s.log.at(-2), /rejects/);
});

test('a concealed beast stirs faintly to its court until revealed', () => {
  let s = createInitialState({ encounterIds: ['veil-lynx'] });
  s = applyHeroProbe(s, 'absence');
  assert.equal(s.currentEncounter.flags.attunementMatch, false);
  assert.match(s.log.at(-2), /faintly/);
});

test('a twin-attuned beast stirs faintly to its own court but still reads in', () => {
  let s = createInitialState({ encounterIds: ['pyre-wisp'] }); // flame primary = the Heat twin
  s = applyHeroProbe(s, 'heat');
  assert.equal(s.currentEncounter.flags.attunementMatch, true); // a faint read is still a read
  assert.match(s.log.at(-2), /faintly/);
});
