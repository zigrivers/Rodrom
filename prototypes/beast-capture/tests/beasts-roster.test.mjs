import test from 'node:test';
import assert from 'node:assert/strict';
import { expandRoster } from '../src/beasts/generate.mjs';

const authored = [
  { id: 'ash-wanderer', name: 'Ash Wanderer', genus: 'Stalkers', primaryAttunement: 'ash',
    bindKind: 'corner', bindPosture: 'cornered', initialPosture: 'skittish',
    initialCaptureState: 'unreadable', maxHealth: 3, stratum: 'ashfields',
    expand: { evolve: [2], dire: true, regional: { veilmarsh: 'veil' } } },
];

test('expandRoster emits base + all directed variants, validated and unique', () => {
  const roster = expandRoster(authored);
  const ids = roster.map((b) => b.id);
  assert.deepEqual(
    ids.sort(),
    ['ash-wanderer', 'ash-wanderer-dire', 'ash-wanderer-s2', 'ash-wanderer-veilmarsh'].sort(),
  );
  assert.equal(new Set(ids).size, ids.length, 'no duplicate ids');
  for (const b of roster) {
    if (b.baseSpeciesId) assert.ok(ids.includes(b.baseSpeciesId), `${b.id} resolves its base`);
  }
});

test('expandRoster throws on a duplicate authored id', () => {
  const dupes = [...authored, { ...authored[0], expand: undefined }];
  assert.throws(() => expandRoster(dupes), /duplicate beast id/);
});
