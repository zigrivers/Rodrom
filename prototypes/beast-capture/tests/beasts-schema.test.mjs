import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBeast, GENERA, ATTUNEMENTS } from '../src/beasts/schema.mjs';

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
