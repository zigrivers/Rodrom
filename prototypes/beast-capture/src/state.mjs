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
const LEADER_BASE_HP = 6;

// Town services bought with Lore between runs (E8). Effects are read where
// relevant (e.g. infirmary raises the leader's max HP in createInitialState).
export const UPGRADES = {
  infirmary: { name: 'Infirmary', describe: '+1 Leader max HP' },
};

export function upgradeCost(key, level) {
  return 5 + (level ?? 0) * 5;
}

export function buyUpgrade(state, key) {
  if (!UPGRADES[key]) {
    return state;
  }
  const level = state.upgrades[key] ?? 0;
  const cost = upgradeCost(key, level);
  if (state.lore < cost) {
    return state;
  }
  return createInitialState({
    started: false,
    roster: state.roster,
    bonds: state.bonds,
    fielded: state.fielded,
    lore: state.lore - cost,
    upgrades: { ...state.upgrades, [key]: level + 1 },
  });
}

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

// Veilsight passive (cme.2): a fielded Veil Lynx ally reveals the target's
// attunement on arrival (even concealed ones) as a codex hint. Does not
// auto-probe — you still lock it in with a probe.
export function seedEncounterKnowledge(state) {
  const hasVeilsight = state.fielded.some((id) => CAPTURED_ALLY[id]?.passive === 'veilsight');
  if (!hasVeilsight) {
    return state;
  }
  const target = state.currentEncounter.target;
  const current = state.codexHints[target.id] ?? [];
  if (current.includes(target.primaryAttunement)) {
    return state;
  }
  return {
    ...state,
    codexHints: { ...state.codexHints, [target.id]: [...current, target.primaryAttunement] },
  };
}

export function createInitialState(options = {}) {
  const encounterIds = options.encounterIds ?? ['ashwing-moth', 'chain-maw', 'storm-antler'];
  const fielded = options.fielded ?? [...FIELDABLE];
  const upgrades = options.upgrades ?? {};
  const leaderMaxHealth = LEADER_BASE_HP + (upgrades.infirmary ?? 0);

  const base = {
    started: options.started ?? true,
    // Campaign-level roster of captured beasts, carried across runs.
    roster: options.roster ?? [],
    // Bond level per captured beast (times fielded), carried across runs.
    bonds: options.bonds ?? {},
    // Town currency and persistent upgrades, carried across runs.
    lore: options.lore ?? 0,
    upgrades,
    // Which allied beasts are fielded this run (party composition).
    fielded,
    encounterIds,
    encounterIndex: 0,
    log: ['Expedition begins.'],
    codexHints: {},
    expeditionComplete: false,
    result: null,
    party: {
      leader: { health: leaderMaxHealth, maxHealth: leaderMaxHealth },
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
