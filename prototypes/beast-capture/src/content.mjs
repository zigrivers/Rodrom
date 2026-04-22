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

export const TARGET_BEASTS = {
  'ashwing-moth': {
    id: 'ashwing-moth',
    name: 'Ashwing Moth',
    primaryAttunement: 'ash',
    falseLead: 'flame',
    initialPosture: 'skittish',
    initialCaptureState: 'unreadable',
    maxHealth: 2,
  },
  'chain-maw': {
    id: 'chain-maw',
    name: 'Chain Maw',
    primaryAttunement: 'iron',
    falseLead: 'stone',
    initialPosture: 'charging',
    initialCaptureState: 'unreadable',
    maxHealth: 4,
  },
  'veil-lynx': {
    id: 'veil-lynx',
    name: 'Veil Lynx',
    primaryAttunement: 'veil',
    falseLead: 'silence',
    initialPosture: 'hidden',
    initialCaptureState: 'unreadable',
    maxHealth: 3,
  },
  'storm-antler': {
    id: 'storm-antler',
    name: 'Storm Antler',
    primaryAttunement: 'storm',
    falseLead: 'light',
    initialPosture: 'braced',
    initialCaptureState: 'unreadable',
    maxHealth: 5,
  },
};

export const TOOLS = {
  'torch-pylon': { id: 'torch-pylon', name: 'Torch Pylon', uses: 1 },
  'salt-marker': { id: 'salt-marker', name: 'Salt Marker', uses: 1 },
  'snare-line': { id: 'snare-line', name: 'Snare Line', uses: 1 },
  'bait-stake': { id: 'bait-stake', name: 'Bait Stake', uses: 1 },
};
