import { AUTHORED } from './beasts/authored.js';
import { expandRoster } from './beasts/generate.js';
import { toTargetBeast } from './beasts/adapter.js';
import { COURT_OF } from './courts.js';

const ROSTER = expandRoster(AUTHORED).map(toTargetBeast);

// Engine-facing beast definitions, keyed by id (includes catalogued variants).
export const TARGET_BEASTS = Object.fromEntries(ROSTER.map((b) => [b.id, b]));

// Species the encounter system may spawn: authored base species whose attunements are all in the
// 8 core courts (deep-attunement beasts are catalogued but not yet spawnable; variants surface via
// the depth/elite mechanic, not the pool).
const coreOnly = (b) => [b.primaryAttunement, b.secondaryAttunement].every((a) => a == null || COURT_OF[a]);
export const CAPTURABLE_POOL = AUTHORED.filter(coreOnly).map((b) => b.id);

export const PLAYER_BEASTS = {
  'grave-hound': {
    id: 'grave-hound',
    name: 'Grave Hound',
    actions: ['scent-read', 'harry', 'warning-bark'],
  },
  'mireback-tortoise': {
    id: 'mireback-tortoise',
    name: 'Mireback Tortoise',
    actions: ['brace', 'shove', 'burden-shelter'],
  },
};

// Each posture-changing action has a "kind"; a target is driven to its bind
// posture by ANY fielded beast/tool that provides the matching kind, so
// captured beasts expand your toolkit.
export const COMPANION_ACTION_KIND = {
  harry: 'corner',
  flit: 'corner',
  shove: 'stagger',
  slam: 'stagger',
  'scent-read': 'reveal',
  sense: 'reveal',
  ground: 'ground',
};

export const TOOL_ACTION_KIND = {
  'bait-stake': 'ground',
};

// A captured target beast, when fielded as an ally, contributes a signature
// action (its action kind) and a passive affinity (its attunement).
export const CAPTURED_ALLY = {
  'ashwing-moth': {
    action: 'flit',
    label: 'Flit',
    passive: 'skittish-kin',
    passiveName: 'Skittish Kin',
    passiveDesc: 'the quarry tolerates extra wrong reads before fleeing (scales with bond)',
  },
  'chain-maw': {
    action: 'slam',
    label: 'Slam',
    passive: 'iron-hold',
    passiveName: 'Iron Hold',
    passiveDesc: 'capture windows do not decay; at a deep bond (3+) the quarry also cannot flee',
  },
  'veil-lynx': {
    action: 'sense',
    label: 'Sense',
    passive: 'veilsight',
    passiveName: 'Veilsight',
    passiveDesc: 'reveals each target attunement on arrival, even concealed ones; at a deep bond (3+) reveals the next layer too',
  },
  'storm-antler': {
    action: 'ground',
    label: 'Ground',
    passive: 'grounding-aura',
    passiveName: 'Grounding Aura',
    passiveDesc: 'the quarry presses less each turn (relief scales with bond)',
  },
};

// Run omens (cme.6): a run-level condition rolled at the start of each
// expedition that changes how it plays. `still-air` is the neutral baseline;
// the rest hook existing tunable seams (starting pressure, lore, knowledge).
export const OMENS = {
  'still-air': { name: 'Still Air', desc: 'The deep is quiet. Nothing stirs to help or hinder you.' },
  'restless-deep': {
    name: 'Restless Deep',
    desc: 'Every layer presses from the first breath (+1 starting pressure).',
    startPressure: 1,
  },
  'bountiful-vein': {
    name: 'Bountiful Vein',
    desc: 'Lore runs rich here — each capture yields +2 bonus Lore.',
    lorePerCapture: 2,
  },
  'thin-veil': {
    name: 'Thin Veil',
    desc: "The opening quarry's attunement is already plain to you.",
    revealOpener: true,
  },
};

// Heavy structures (z4y.3): raised at a circuit-completion anchor for a Lore cost, each with a
// persistent run effect. Unlike light field tools, they require an anchor and last the whole run.
// One of each per run; the catalog is extensible (the vision lists more, gated on later systems).
export const BUILD_CATALOG = {
  'descent-support': {
    id: 'descent-support', name: 'Descent Support', cost: 6,
    effect: 'future descents start under less pressure',
  },
  'sanctified-camp': {
    id: 'sanctified-camp', name: 'Sanctified Camp', cost: 10,
    effect: 'anchor Recover heals more',
  },
  'watch-totem': {
    id: 'watch-totem', name: 'Watch Totem', cost: 8,
    effect: 'quarries tolerate one more wrong read before fleeing',
  },
};

export const TOOLS = {
  'torch-pylon': { id: 'torch-pylon', name: 'Torch Pylon', uses: 1 },
  'salt-marker': { id: 'salt-marker', name: 'Salt Marker', uses: 1 },
  'snare-line': { id: 'snare-line', name: 'Snare Line', uses: 2 },
  'bait-stake': { id: 'bait-stake', name: 'Bait Stake', uses: 2 },
};
