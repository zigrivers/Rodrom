import { PLAYER_BEASTS, TARGET_BEASTS, TOOLS, CAPTURED_ALLY } from './content.mjs';

export function createTargetState(targetId, depth = 1) {
  const target = TARGET_BEASTS[targetId];
  const maxHealth = target.maxHealth + (depth - 1);
  return {
    id: target.id,
    name: target.name,
    primaryAttunement: target.primaryAttunement,
    falseLead: target.falseLead,
    health: maxHealth,
    maxHealth,
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

// Allied beasts the player can choose to field, with their per-beast health.
const FIELDABLE = ['grave-hound', 'mireback-tortoise'];
const BEAST_STATS = {
  'grave-hound': { health: 4 },
  'mireback-tortoise': { health: 6 },
};

function buildBeast(id) {
  if (PLAYER_BEASTS[id]) {
    const health = BEAST_STATS[id]?.health ?? 4;
    return [id, { ...PLAYER_BEASTS[id], fatigue: 0, health, maxHealth: health }];
  }
  if (CAPTURED_ALLY[id] && TARGET_BEASTS[id]) {
    const health = 3;
    return [
      id,
      {
        id,
        name: TARGET_BEASTS[id].name,
        actions: [CAPTURED_ALLY[id].action],
        fatigue: 0,
        health,
        maxHealth: health,
      },
    ];
  }
  return null;
}

function buildPartyBeasts(fielded) {
  return Object.fromEntries(fielded.map(buildBeast).filter(Boolean));
}

// Passive affinity: a bonded captured beast (bond >= 1) recognises a target of
// its own attunement, revealing it on arrival (a codex hint). Concealed beasts
// resist it. Does not auto-probe — you still lock it in with a probe.
export function seedEncounterKnowledge(state) {
  const target = state.currentEncounter.target;
  const def = TARGET_BEASTS[target.id];
  if (def.concealed) {
    return state;
  }

  const hints = new Set(state.codexHints[target.id] ?? []);
  for (const id of state.fielded) {
    if (CAPTURED_ALLY[id] && (state.bonds[id] ?? 0) >= 1 && TARGET_BEASTS[id]?.primaryAttunement === target.primaryAttunement) {
      hints.add(target.primaryAttunement);
    }
  }

  if (hints.size === (state.codexHints[target.id] ?? []).length) {
    return state;
  }
  return { ...state, codexHints: { ...state.codexHints, [target.id]: [...hints] } };
}

export function createInitialState(options = {}) {
  const encounterIds = options.encounterIds ?? ['ashwing-moth', 'chain-maw', 'storm-antler'];
  const fielded = options.fielded ?? [...FIELDABLE];

  const base = {
    started: options.started ?? true,
    // Campaign-level roster of captured beasts, carried across runs.
    roster: options.roster ?? [],
    // Bond level per captured beast (times fielded), carried across runs.
    bonds: options.bonds ?? {},
    // Which allied beasts are fielded this run (party composition).
    fielded,
    encounterIds,
    encounterIndex: 0,
    log: ['Expedition begins.'],
    codexHints: {},
    expeditionComplete: false,
    result: null,
    party: {
      leader: { health: 6, maxHealth: 6 },
      beasts: buildPartyBeasts(fielded),
      tools: Object.fromEntries(Object.values(TOOLS).map((tool) => [tool.id, tool.uses])),
      captures: [],
    },
    currentEncounter: {
      target: createTargetState(encounterIds[0], 1),
      depth: 1,
      anchored: false,
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

  return seedEncounterKnowledge(base);
}
