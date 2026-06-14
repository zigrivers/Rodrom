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
  'ashwing-moth': { action: 'flit', label: 'Flit' },
  'chain-maw': { action: 'slam', label: 'Slam' },
  'veil-lynx': { action: 'sense', label: 'Sense' },
  'storm-antler': { action: 'ground', label: 'Ground' },
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

export const TOOLS = {
  'torch-pylon': { id: 'torch-pylon', name: 'Torch Pylon', uses: 1 },
  'salt-marker': { id: 'salt-marker', name: 'Salt Marker', uses: 1 },
  'snare-line': { id: 'snare-line', name: 'Snare Line', uses: 2 },
  'bait-stake': { id: 'bait-stake', name: 'Bait Stake', uses: 2 },
};
