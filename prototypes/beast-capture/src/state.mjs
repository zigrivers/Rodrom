import { PLAYER_BEASTS, TARGET_BEASTS, TOOLS, CAPTURED_ALLY, OMENS, CAPTURABLE_POOL } from './content.mjs';

// Elite "Dire" quarries appear at deep layers (G3c): every 4th layer surfaces a
// tougher, richer variant, so descending introduces interest, not just bigger numbers.
export function isEliteDepth(depth) {
  return (depth ?? 1) >= 4 && (depth ?? 1) % 4 === 0;
}

export function createTargetState(targetId, depth = 1) {
  const target = TARGET_BEASTS[targetId];
  const elite = isEliteDepth(depth);
  const maxHealth = target.maxHealth + (depth - 1) + (elite ? 2 : 0);
  return {
    id: target.id,
    name: elite ? `Dire ${target.name}` : target.name,
    elite,
    primaryAttunement: target.primaryAttunement,
    falseLead: target.falseLead,
    health: maxHealth,
    maxHealth,
    posture: target.initialPosture,
    captureState: target.initialCaptureState,
    altBind: elite && !target.concealed ? target.altBind ?? null : null,
    secondaryAttunement: target.secondaryAttunement ?? null,
  };
}

// The tutorial beast leads only on the very first run; later runs rotate the
// full pool so the opener (and order) varies, and the deception beast can open
// a run once the player knows the basics (cme.6, was F12/P6).
const FULL_POOL = CAPTURABLE_POOL;

export function buildEncounterOrder(variant = 0, firstRun = false) {
  if (firstRun) {
    return ['ashwing-moth', 'chain-maw', 'storm-antler']; // gentle, concealment-free tutorial line
  }
  const n = FULL_POOL.length;
  const start = ((variant % n) + n) % n;
  return FULL_POOL.map((_, index) => FULL_POOL[(start + index) % n]);
}

// Allied beasts the player can choose to field, with their per-beast health.
const FIELDABLE = ['grave-hound', 'mireback-tortoise'];

// How many beasts you can field at once (G3a). A full roster (2 starters + 4
// captured allies) exceeds this, so composition is a real "which passives this
// run?" choice rather than fielding everything.
export const FIELD_CAP = 4;

// The Kennel town service (G3b) raises the field cap, so Lore buys more passives
// in play — a run-changing sink, not just a stat bump.
export function fieldCap(upgrades, bestiary) {
  return FIELD_CAP + (upgrades?.kennel ?? 0) + (bestiaryComplete(bestiary) ? 1 : 0);
}

// Bestiary completeness (collection goal). A species is complete when all three
// tiers (Bronze/Silver/Gold) are earned; the Bestiary is complete when all four
// capturable species are complete.
const BESTIARY_SPECIES = ['ashwing-moth', 'chain-maw', 'veil-lynx', 'storm-antler'];

export function speciesComplete(bestiary, id) {
  const t = (bestiary ?? {})[id];
  return Boolean(t && t.bronze && t.silver && t.gold);
}

// Bond level used by passives/perks: the raw bond plus the collection-goal +1 when the species'
// bestiary is complete. Single source of truth so engine.activePassives and seedEncounterKnowledge
// (veilsight) can't drift apart on how the perk is applied.
export function effectiveBond(state, id) {
  return (state.bonds?.[id] ?? 0) + (speciesComplete(state.bestiary, id) ? 1 : 0);
}

export function bestiaryComplete(bestiary) {
  return BESTIARY_SPECIES.every((id) => speciesComplete(bestiary, id));
}

export function toggleFielded(fielded, id, cap = FIELD_CAP) {
  if (fielded.includes(id)) {
    return fielded.filter((beastId) => beastId !== id);
  }
  if (fielded.length >= cap) {
    return fielded; // party full — fielding another is a no-op
  }
  return [...fielded, id];
}
const BEAST_STATS = {
  'grave-hound': { health: 4 },
  'mireback-tortoise': { health: 6 },
};
const LEADER_BASE_HP = 6;

// Town services bought with Lore between runs (E8). Effects are read where
// relevant (e.g. infirmary raises the leader's max HP in createInitialState).
export const UPGRADES = {
  infirmary: { name: 'Infirmary', describe: '+1 Leader max HP' },
  quartermaster: { name: 'Quartermaster', describe: '+1 use of each field tool per run' },
  'scouts-lantern': { name: "Scout's Lantern", describe: "Begin each run knowing the next quarries' attunements" },
  kennel: { name: 'Kennel', describe: '+1 beast you can field per run' },
};

// A steeper (quadratic) curve so Lore keeps its weight as the campaign grows
// (G3b). Level 0 stays cheap (5) to keep the first upgrade accessible.
export function upgradeCost(key, level) {
  const l = level ?? 0;
  return 5 * (l + 1) * (l + 1);
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
    bestiary: state.bestiary,
    fielded: state.fielded,
    coach: state.coach,
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

// Veilsight passive (cme.2): a fielded Veil Lynx ally reveals the current
// target's attunement on arrival (even concealed ones) as a codex hint. At a
// deep bond (>= 3) it also reveals the NEXT layer's attunement (G2). Does not
// auto-probe — you still lock it in with a probe.
function revealAttunement(codexHints, beastId) {
  const attunement = TARGET_BEASTS[beastId]?.primaryAttunement;
  if (!attunement) {
    return codexHints;
  }
  const current = codexHints[beastId] ?? [];
  if (current.includes(attunement)) {
    return codexHints;
  }
  return { ...codexHints, [beastId]: [...current, attunement] };
}

export function seedEncounterKnowledge(state) {
  const veilAlly = state.fielded.find((id) => CAPTURED_ALLY[id]?.passive === 'veilsight');
  if (!veilAlly) {
    return state;
  }
  const bond = effectiveBond(state, veilAlly);

  let codexHints = revealAttunement(state.codexHints, state.currentEncounter.target.id);
  if (bond >= 3) {
    const ids = state.encounterIds ?? [];
    if (ids.length) {
      const nextId = ids[(state.encounterIndex + 1) % ids.length];
      codexHints = revealAttunement(codexHints, nextId);
    }
  }
  return { ...state, codexHints };
}

export function createInitialState(options = {}) {
  const encounterIds = options.encounterIds ?? ['ashwing-moth', 'chain-maw', 'storm-antler'];
  const fielded = options.fielded ?? [...FIELDABLE];
  const upgrades = options.upgrades ?? {};
  const leaderMaxHealth = LEADER_BASE_HP + (upgrades.infirmary ?? 0);

  // Quartermaster (cme.4): +1 use of each field tool per level.
  const quartermaster = upgrades.quartermaster ?? 0;
  const tools = Object.fromEntries(Object.values(TOOLS).map((tool) => [tool.id, tool.uses]));
  tools['snare-line'] += quartermaster;
  tools['bait-stake'] += quartermaster;

  // Run omen (cme.6): resolve the omen id to its definition (unknown -> none).
  const omenDef = options.omen && OMENS[options.omen] ? { id: options.omen, ...OMENS[options.omen] } : null;

  // Scout's Lantern (cme.4): pre-reveal the first `level` quarries' attunements
  // as codex hints at run start (information sink; you still probe to lock in).
  // Thin Veil omen (cme.6) reveals the opener the same way.
  const lantern = upgrades['scouts-lantern'] ?? 0;
  const revealCount = Math.max(lantern, omenDef?.revealOpener ? 1 : 0);
  const codexHints = {};
  for (let i = 0; i < Math.min(revealCount, encounterIds.length); i += 1) {
    const id = encounterIds[i];
    const attunement = TARGET_BEASTS[id]?.primaryAttunement;
    if (attunement) {
      codexHints[id] = [attunement];
    }
  }

  const base = {
    started: options.started ?? true,
    // Coaching guidance is on by default (teaches new players); turning it off
    // demotes the coach to an oblique "tracker" so reading is a real skill (cme.3).
    coach: options.coach ?? true,
    // Per-run grades for each capture (clean/fast), scored into Lore + bond (cme.3).
    captureLog: [],
    // How many of this run's captures are secured (banked-safe). Anchoring and
    // extracting secure the haul; dying forfeits everything beyond this (G1).
    securedCount: 0,
    // Campaign-level roster of captured beasts, carried across runs.
    roster: options.roster ?? [],
    // Bond level per captured beast (times fielded), carried across runs.
    bonds: options.bonds ?? {},
    // Persistent Bestiary: per-species Bronze/Silver/Gold tiers (collection goal).
    bestiary: options.bestiary ?? {},
    // Town currency and persistent upgrades, carried across runs.
    lore: options.lore ?? 0,
    upgrades,
    // Which allied beasts are fielded this run (party composition).
    fielded,
    // Run-level omen rolled at the start of the expedition (cme.6).
    omen: omenDef,
    encounterIds,
    encounterIndex: 0,
    log: ['Expedition begins.'],
    codexHints,
    expeditionComplete: false,
    result: null,
    party: {
      leader: { health: leaderMaxHealth, maxHealth: leaderMaxHealth },
      beasts: buildPartyBeasts(fielded),
      tools,
      captures: [],
    },
    currentEncounter: {
      target: createTargetState(encounterIds[0], 1),
      depth: 1,
      anchored: false,
      turn: 1,
      pressure: omenDef?.startPressure ?? 0,
      riskLevel: 0,
      escapeProgress: 0,
      windowDecay: 0,
      pressLevel: 0,
      structures: [],
      flags: {
        attunementMatch: false,
        secondaryAttunementMatch: false,
        altAttunementMatch: false,
        guardRaised: false,
        braceRaised: false,
        alerted: false,
        agitated: false,
      },
    },
  };

  return seedEncounterKnowledge(base);
}
