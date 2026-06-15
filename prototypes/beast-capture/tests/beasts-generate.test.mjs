import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBeast, validateBeast } from '../src/beasts/schema.mjs';
import { direVariant } from '../src/beasts/generate.mjs';

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
