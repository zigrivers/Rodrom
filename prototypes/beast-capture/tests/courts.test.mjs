import test from 'node:test';
import assert from 'node:assert/strict';
import { COURTS, COURT_OF, COURT_LEAD, COURT_LABEL, toCourt, reactionStrength } from '../src/courts.mjs';

test('courts cover all 8 core attunements as 4 confusion-pairs', () => {
  assert.deepEqual(COURTS, ['heat', 'mass', 'sky', 'absence']);
  assert.equal(COURT_OF.ash, 'heat');
  assert.equal(COURT_OF.flame, 'heat');
  assert.equal(COURT_OF.veil, 'absence');
  assert.equal(COURT_OF.silence, 'absence');
  assert.equal(Object.keys(COURT_OF).length, 8);
  assert.equal(COURT_LEAD.heat, 'ash');
  assert.equal(COURT_LABEL.absence, 'Absence');
});

test('toCourt accepts a court name or an exact attunement; null for unknown', () => {
  assert.equal(toCourt('heat'), 'heat');
  assert.equal(toCourt('iron'), 'mass');
  assert.equal(toCourt('silence'), 'absence');
  assert.equal(toCourt('rot'), null);
});

test('reactionStrength is strong for a court lead, faint for its twin', () => {
  assert.equal(reactionStrength('ash'), 'strong');
  assert.equal(reactionStrength('flame'), 'faint');
  assert.equal(reactionStrength('storm'), 'strong');
  assert.equal(reactionStrength('light'), 'faint');
});
