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

// Each target's capture condition is posture-driven: the player must probe the
// correct attunement AND drive the beast into its `bindPosture` using the
// beast-specific `postureTrigger` action. `concealed` beasts read deceptively
// (the falseLead looks like a hit) until the trigger reveals them.
export const TARGET_BEASTS = {
  'ashwing-moth': {
    id: 'ashwing-moth',
    name: 'Ashwing Moth',
    primaryAttunement: 'ash',
    falseLead: 'flame',
    initialPosture: 'skittish',
    bindPosture: 'cornered',
    bindKind: 'corner',
    initialCaptureState: 'unreadable',
    maxHealth: 2,
  },
  'chain-maw': {
    id: 'chain-maw',
    name: 'Chain Maw',
    primaryAttunement: 'iron',
    falseLead: 'stone',
    initialPosture: 'charging',
    bindPosture: 'staggered',
    bindKind: 'stagger',
    initialCaptureState: 'unreadable',
    maxHealth: 4,
  },
  'veil-lynx': {
    id: 'veil-lynx',
    name: 'Veil Lynx',
    primaryAttunement: 'veil',
    falseLead: 'silence',
    initialPosture: 'hidden',
    bindPosture: 'revealed',
    bindKind: 'reveal',
    concealed: true,
    initialCaptureState: 'unreadable',
    maxHealth: 3,
  },
  'storm-antler': {
    id: 'storm-antler',
    name: 'Storm Antler',
    primaryAttunement: 'storm',
    falseLead: 'light',
    initialPosture: 'braced',
    bindPosture: 'grounded',
    bindKind: 'ground',
    initialCaptureState: 'unreadable',
    maxHealth: 5,
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

export const TOOLS = {
  'torch-pylon': { id: 'torch-pylon', name: 'Torch Pylon', uses: 1 },
  'salt-marker': { id: 'salt-marker', name: 'Salt Marker', uses: 1 },
  'snare-line': { id: 'snare-line', name: 'Snare Line', uses: 2 },
  'bait-stake': { id: 'bait-stake', name: 'Bait Stake', uses: 2 },
};
