import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBeast, validateBeast } from '../src/beasts/schema.mjs';
import { direVariant, evolveVariant, regionalVariant } from '../src/beasts/generate.mjs';

const base = normalizeBeast({
  id: 'ash-wanderer', name: 'Ash Wanderer', genus: 'Stalkers', primaryAttunement: 'ash',
  bindKind: 'corner', bindPosture: 'cornered', initialPosture: 'skittish',
  initialCaptureState: 'unreadable', maxHealth: 3, stratum: 'ashfields',
});

test('direVariant produces a valid elite with +2 HP, a dual route, and gold=dire', () => {
  const dire = direVariant(base);
  assert.deepEqual(validateBeast(dire), []);
  assert.equal(dire.id, 'ash-wanderer-dire');
  assert.equal(dire.name, 'Dire Ash Wanderer');
  assert.equal(dire.rank, 'dire');
  assert.equal(dire.baseSpeciesId, 'ash-wanderer');
  assert.equal(dire.authored, false);
  assert.equal(dire.maxHealth, 5);
  assert.equal(dire.tierGold, 'dire');
  // base had no altBind -> an alt route is derived deterministically (corner -> stagger)
  assert.deepEqual(dire.altBind, { attunement: 'flame', bindKind: 'stagger', bindPosture: 'staggered' });
});

test('direVariant preserves an authored altBind if present', () => {
  const withAlt = normalizeBeast({ ...base, altBind: { attunement: 'storm', bindKind: 'ground', bindPosture: 'grounded' } });
  assert.deepEqual(direVariant(withAlt).altBind, { attunement: 'storm', bindKind: 'ground', bindPosture: 'grounded' });
});

test('evolveVariant scales HP per stage and conceals at stage 3', () => {
  const s2 = evolveVariant(base, 2);
  assert.deepEqual(validateBeast(s2), []);
  assert.equal(s2.id, 'ash-wanderer-s2');
  assert.equal(s2.name, 'Ash Wanderer (Risen)');
  assert.equal(s2.stage, 2);
  assert.equal(s2.maxHealth, 4); // base 3 + (stage-1)
  assert.equal(s2.concealed, false);

  const s3 = evolveVariant(base, 3);
  assert.equal(s3.name, 'Ash Wanderer (Elder)');
  assert.equal(s3.maxHealth, 5);
  assert.equal(s3.concealed, true);
  assert.equal(s3.baseSpeciesId, 'ash-wanderer');
});

test('regionalVariant re-skins to a new stratum attunement and re-pairs the false lead', () => {
  const r = regionalVariant(base, 'veilmarsh', 'veil');
  assert.deepEqual(validateBeast(r), []);
  assert.equal(r.id, 'ash-wanderer-veilmarsh');
  assert.equal(r.stratum, 'veilmarsh');
  assert.equal(r.primaryAttunement, 'veil');
  assert.equal(r.falseLead, 'silence'); // veil's pair-twin
  assert.equal(r.name, 'Veil-touched Ash Wanderer');
  assert.equal(r.baseSpeciesId, 'ash-wanderer');
});
