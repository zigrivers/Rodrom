import test from 'node:test';
import assert from 'node:assert/strict';
import { TARGET_BEASTS, CAPTURABLE_POOL } from '../src/content.mjs';
import { COURT_OF } from '../src/courts.mjs';

test('TARGET_BEASTS is built from the generated roster (includes variants)', () => {
  assert.ok(TARGET_BEASTS['ashwing-moth'], 'shipped beast present');
  assert.ok(TARGET_BEASTS['ashwing-moth-dire'], 'a generated variant present');
  assert.ok(Object.keys(TARGET_BEASTS).length >= 16);
});

test('the 4 shipped beasts keep their exact engine fields', () => {
  assert.equal(TARGET_BEASTS['ashwing-moth'].primaryAttunement, 'ash');
  assert.deepEqual(TARGET_BEASTS['ashwing-moth'].altBind, { attunement: 'iron', bindKind: 'stagger', bindPosture: 'staggered' });
  assert.equal(TARGET_BEASTS['veil-lynx'].concealed, true);
  assert.equal('altBind' in TARGET_BEASTS['veil-lynx'], false);
});

test('CAPTURABLE_POOL is core-court base species only (no deep attunement, no variants)', () => {
  assert.ok(CAPTURABLE_POOL.includes('ashwing-moth'));
  assert.ok(!CAPTURABLE_POOL.includes('sporecount-sexton'), 'rot is a deep attunement -> excluded');
  assert.ok(
    !CAPTURABLE_POOL.some((id) => /-(dire|s\d+|ashfields|ironhold|stormspire|veilmarsh|blightwarren|drowned|glass-spiral)$/.test(id)),
    'base species only, no generated variants',
  );
});

test('dual-typed authored beasts are spawnable and span two courts', () => {
  const duals = ['stormcoil-apostate', 'cinder-veilkeeper', 'ironcrown-herald'];
  for (const id of duals) {
    const b = TARGET_BEASTS[id];
    assert.ok(b, `${id} present`);
    assert.ok(b.secondaryAttunement, `${id} is dual-typed`);
    assert.notEqual(COURT_OF[b.primaryAttunement], COURT_OF[b.secondaryAttunement], `${id} spans two courts`);
    assert.ok(CAPTURABLE_POOL.includes(id), `${id} is spawnable`);
  }
});
