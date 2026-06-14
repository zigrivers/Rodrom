import { PLAYER_BEASTS, TARGET_BEASTS, TOOLS } from './content.mjs';

export function createTargetState(targetId) {
  const target = TARGET_BEASTS[targetId];
  return {
    id: target.id,
    name: target.name,
    primaryAttunement: target.primaryAttunement,
    falseLead: target.falseLead,
    health: target.maxHealth,
    maxHealth: target.maxHealth,
    posture: target.initialPosture,
    captureState: target.initialCaptureState,
  };
}

// The tutorial beast always leads; the rest of the pool varies per run so a
// fresh expedition isn't the same solved sequence every time (F12).
const ENCOUNTER_POOL = ['chain-maw', 'veil-lynx', 'storm-antler'];

export function buildEncounterOrder(variant = 0) {
  const dropIndex = ((variant % ENCOUNTER_POOL.length) + ENCOUNTER_POOL.length) % ENCOUNTER_POOL.length;
  const chosen = ENCOUNTER_POOL.filter((_, index) => index !== dropIndex);
  return ['ashwing-moth', ...chosen];
}

export function createInitialState(options = {}) {
  const encounterIds = options.encounterIds ?? ['ashwing-moth', 'chain-maw', 'storm-antler'];

  return {
    started: options.started ?? true,
    encounterIds,
    encounterIndex: 0,
    log: ['Expedition begins.'],
    codexHints: {},
    expeditionComplete: false,
    result: null,
    party: {
      leader: { health: 6, maxHealth: 6 },
      beasts: {
        'grave-hound': { ...PLAYER_BEASTS['grave-hound'], fatigue: 0, health: 4, maxHealth: 4 },
        'mireback-tortoise': {
          ...PLAYER_BEASTS['mireback-tortoise'],
          fatigue: 0,
          health: 6,
          maxHealth: 6,
        },
      },
      tools: Object.fromEntries(Object.values(TOOLS).map((tool) => [tool.id, tool.uses])),
      captures: [],
    },
    currentEncounter: {
      target: createTargetState(encounterIds[0]),
      turn: 1,
      pressure: 0,
      riskLevel: 0,
      escapeProgress: 0,
      windowDecay: 0,
      structures: [],
      flags: {
        attunementMatch: false,
        guardRaised: false,
        braceRaised: false,
        alerted: false,
      },
    },
  };
}
