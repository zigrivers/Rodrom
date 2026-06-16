import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBeast, validateBeast, BIND_KINDS } from '../src/beasts/schema.mjs';
import { direVariant, evolveVariant, regionalVariant, deriveAltBind, ALT_ROUTE } from '../src/beasts/generate.mjs';

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

test('regionalVariant clears stale secondary and altBind on attunement swap', () => {
  const dual = normalizeBeast({
    ...base, secondaryAttunement: 'iron',
    altBind: { attunement: 'storm', bindKind: 'ground', bindPosture: 'grounded' },
  });
  const r = regionalVariant(dual, 'veilmarsh', 'veil');
  // the old iron secondary / storm altBind are incoherent under a veil primary -> dropped
  assert.equal(r.secondaryAttunement, null);
  assert.equal(r.altBind, null);
  assert.deepEqual(validateBeast(r), []);
});

test('deriveAltBind returns null when there is no distinct alt attunement (deep primary)', () => {
  const deep = normalizeBeast({
    id: 'rot-thing', name: 'Rot Thing', genus: 'Broods', primaryAttunement: 'rot',
    bindKind: 'ground', bindPosture: 'grounded', initialPosture: 'braced',
    initialCaptureState: 'unreadable', maxHealth: 4, stratum: 'blightwarren',
  });
  // rot has no pair-twin and the beast has no secondary -> no second read to require
  assert.equal(deriveAltBind(deep), null);
  // ...so the dire of such a beast has no alt route, not a degenerate same-attunement one
  assert.equal(direVariant(deep).altBind, null);
});

test('ALT_ROUTE covers every bind kind (completeness guard)', () => {
  for (const k of BIND_KINDS) {
    assert.ok(ALT_ROUTE[k], `ALT_ROUTE missing entry for bind kind: ${k}`);
  }
});

test('evolveVariant rejects stage < 2 (no ghost stage-1 duplicate)', () => {
  assert.throws(() => evolveVariant(base, 1), /stage >= 2/);
});
