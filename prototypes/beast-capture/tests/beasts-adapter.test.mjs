import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBeast } from '../src/beasts/schema.mjs';
import { toTargetBeast } from '../src/beasts/adapter.mjs';
import { TARGET_BEASTS } from '../src/content.mjs';

// The 4 shipped beasts, re-expressed in the new schema (engine fields must match content.mjs).
const SHIPPED = [
  { id: 'ashwing-moth', name: 'Ashwing Moth', genus: 'Stalkers', rank: 'quarry', stratum: 'ashfields',
    primaryAttunement: 'ash', falseLead: 'flame', initialPosture: 'skittish', bindKind: 'corner', bindPosture: 'cornered',
    altBind: { attunement: 'iron', bindKind: 'stagger', bindPosture: 'staggered' },
    initialCaptureState: 'unreadable', maxHealth: 2, blurb: 'A moth of cinders; its wings scatter blinding ash.' },
  { id: 'chain-maw', name: 'Chain Maw', genus: 'Wardens', rank: 'quarry', stratum: 'ironhold',
    primaryAttunement: 'iron', falseLead: 'stone', initialPosture: 'charging', bindKind: 'stagger', bindPosture: 'staggered',
    altBind: { attunement: 'storm', bindKind: 'ground', bindPosture: 'grounded' },
    initialCaptureState: 'unreadable', maxHealth: 4, blurb: 'Iron-jawed and relentless — it drags its own broken chains.' },
  { id: 'veil-lynx', name: 'Veil Lynx', genus: 'Stalkers', rank: 'quarry', stratum: 'veilmarsh',
    primaryAttunement: 'veil', falseLead: 'silence', initialPosture: 'hidden', bindKind: 'reveal', bindPosture: 'revealed',
    concealed: true, initialCaptureState: 'unreadable', maxHealth: 3, blurb: 'Half-seen at the edge of torchlight; gone when looked at.' },
  { id: 'storm-antler', name: 'Storm Antler', genus: 'Drakes', rank: 'quarry', stratum: 'stormspire',
    primaryAttunement: 'storm', falseLead: 'light', initialPosture: 'braced', bindKind: 'ground', bindPosture: 'grounded',
    altBind: { attunement: 'iron', bindKind: 'stagger', bindPosture: 'staggered' },
    initialCaptureState: 'unreadable', maxHealth: 5, blurb: 'Its antlers hum before the strike; the air tastes of lightning.' },
];

test('toTargetBeast round-trips each shipped beast to its exact TARGET_BEASTS entry', () => {
  for (const raw of SHIPPED) {
    const projected = toTargetBeast(normalizeBeast(raw));
    assert.deepEqual(projected, TARGET_BEASTS[raw.id], `mismatch for ${raw.id}`);
  }
});

test('toTargetBeast carries secondaryAttunement only when present', () => {
  const single = toTargetBeast(normalizeBeast({
    id: 's', name: 'S', genus: 'Drakes', primaryAttunement: 'ash',
    bindKind: 'corner', bindPosture: 'cornered', initialPosture: 'skittish',
    initialCaptureState: 'unreadable', maxHealth: 3, stratum: 'ashfields',
  }));
  assert.equal('secondaryAttunement' in single, false, 'omitted when null');

  const dual = toTargetBeast(normalizeBeast({
    id: 'd', name: 'D', genus: 'Drakes', primaryAttunement: 'storm', secondaryAttunement: 'iron',
    bindKind: 'corner', bindPosture: 'cornered', initialPosture: 'charging',
    initialCaptureState: 'unreadable', maxHealth: 4, stratum: 'stormspire',
  }));
  assert.equal(dual.secondaryAttunement, 'iron');
});
