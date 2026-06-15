import test from 'node:test';
import assert from 'node:assert/strict';
import { expandRoster } from '../src/beasts/generate.mjs';
import { AUTHORED } from '../src/beasts/authored.mjs';
import { toTargetBeast } from '../src/beasts/adapter.mjs';
import { TARGET_BEASTS } from '../src/content.mjs';

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

test('the authored dataset expands cleanly and is engine-projectable', () => {
  const roster = expandRoster(AUTHORED); // throws if any record is invalid/duplicate
  assert.ok(roster.length >= AUTHORED.length, 'roster includes at least the authored bases');
  assert.ok(roster.length > AUTHORED.length, 'expansion produced variants');
  for (const b of roster) {
    const t = toTargetBeast(b);
    assert.ok(t.id && t.name && t.primaryAttunement && t.bindKind, `projectable: ${b.id}`);
  }
  for (const id of Object.keys(TARGET_BEASTS)) {
    const rec = roster.find((b) => b.id === id);
    assert.ok(rec, `roster contains shipped beast ${id}`);
    assert.deepEqual(toTargetBeast(rec), TARGET_BEASTS[id], `shipped beast ${id} unchanged`);
  }
});
