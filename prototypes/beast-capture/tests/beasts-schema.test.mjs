import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBeast, normalizeBeast, GENERA, ATTUNEMENTS } from '../src/beasts/schema.mjs';

const valid = {
  id: 'test-beast', name: 'Test Beast', genus: 'Stalkers', rank: 'quarry',
  primaryAttunement: 'ash', bindKind: 'corner', bindPosture: 'cornered',
  initialPosture: 'skittish', initialCaptureState: 'unreadable', maxHealth: 3, stratum: 'ashfields',
};

test('validateBeast accepts a well-formed record', () => {
  assert.deepEqual(validateBeast(valid), []);
});

test('validateBeast reports missing required fields', () => {
  const { maxHealth, ...missing } = valid;
  assert.ok(validateBeast(missing).some((e) => e.includes('maxHealth')));
});

test('validateBeast rejects bad enums and out-of-range health', () => {
  assert.ok(validateBeast({ ...valid, genus: 'Wombats' }).some((e) => e.includes('genus')));
  assert.ok(validateBeast({ ...valid, primaryAttunement: 'plasma' }).some((e) => e.includes('primaryAttunement')));
  assert.ok(validateBeast({ ...valid, maxHealth: 99 }).some((e) => e.includes('maxHealth')));
  assert.equal(GENERA.length, 12);
  assert.equal(ATTUNEMENTS.length, 12); // 8 core + 4 deep
});

test('normalizeBeast fills defaults and defaults falseLead to the pair-twin', () => {
  const n = normalizeBeast({
    id: 'm', name: 'M', genus: 'Drakes', primaryAttunement: 'storm',
    bindKind: 'corner', bindPosture: 'cornered', initialPosture: 'charging',
    initialCaptureState: 'unreadable', maxHealth: 4, stratum: 'stormspire',
  });
  assert.equal(n.falseLead, 'light'); // storm's confusion-pair twin
  assert.equal(n.rank, 'quarry');
  assert.equal(n.stage, 1);
  assert.equal(n.concealed, false);
  assert.equal(n.altBind, null);
  assert.equal(n.secondaryAttunement, null);
  assert.equal(n.authored, true);
  assert.equal(n.tierGold, 'dire');
});

test('normalizeBeast strips the non-schema expand directive', () => {
  const n = normalizeBeast({
    id: 'm', name: 'M', genus: 'Drakes', primaryAttunement: 'ash',
    bindKind: 'corner', bindPosture: 'cornered', initialPosture: 'skittish',
    initialCaptureState: 'unreadable', maxHealth: 2, stratum: 'ashfields',
    expand: { dire: true },
  });
  assert.equal(n.expand, undefined);
  assert.deepEqual(validateBeast(n), []);
});
