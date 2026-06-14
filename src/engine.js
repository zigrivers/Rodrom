import { createTargetState, seedEncounterKnowledge } from './state.js';
import { TARGET_BEASTS, COMPANION_ACTION_KIND, TOOL_ACTION_KIND, CAPTURED_ALLY } from './content.js';

// Consequence tuning (F4/F7/F11). Kept as named constants for easy balancing.
const ESCAPE_READS = 3; // wrong-attunement probes before the beast flees
const FRENZY_PRESSURE = 6; // pressure at which an undefended turn wounds the leader
const FRENZY_LEADER_DAMAGE = 1;
const WINDOW_GRACE = 3; // open-window turns before a bindable beast slips loose

// Deeper layers press harder: per-turn pressure rises with descent depth, so
// frenzy and failure scale with depth (run structure, t9i.3).
export function pressurePerTurn(depth) {
  return 1 + Math.floor(((depth ?? 1) - 1) / 2);
}

function appendLog(state, line) {
  return { ...state, log: [...state.log, line] };
}

// Finish a run: record the result and bank this run's captures into the
// campaign roster so captured beasts persist across runs.
function completeExpedition(state, rank) {
  const bonds = { ...state.bonds };
  for (const id of state.fielded) {
    if (CAPTURED_ALLY[id]) {
      bonds[id] = (bonds[id] ?? 0) + 1;
    }
  }
  return {
    ...state,
    expeditionComplete: true,
    result: { rank, captures: state.party.captures.length },
    roster: [...state.roster, ...state.party.captures],
    bonds,
  };
}

// Deterministically spend one use of the most-stocked tool (supply loss, F4).
function loseSupply(tools) {
  let pick = null;
  for (const [id, count] of Object.entries(tools)) {
    if (count > 0 && (pick === null || count > tools[pick])) {
      pick = id;
    }
  }
  if (pick === null) {
    return { tools, lost: null };
  }
  return { tools: { ...tools, [pick]: tools[pick] - 1 }, lost: pick };
}

function beastDef(target) {
  return TARGET_BEASTS[target.id];
}

function addHint(codexHints, targetId, attunement) {
  return {
    ...codexHints,
    [targetId]: [...new Set([...(codexHints[targetId] ?? []), attunement])],
  };
}

function isTerminalCaptureState(value) {
  return (
    value === 'defeated' || value === 'captured' || value === 'escaped' || value === 'withdrawn'
  );
}

function isTargetActive(target) {
  return !isTerminalCaptureState(target.captureState);
}

// Qualitative read of how close pressure is to a frenzy, for inferable cues (F8).
export function tensionLabel(pressure) {
  if (pressure >= FRENZY_PRESSURE) {
    return 'frenzied';
  }
  if (pressure >= FRENZY_PRESSURE - 2) {
    return 'agitated';
  }
  if (pressure > 0) {
    return 'restless';
  }
  return 'calm';
}

export function canAdvanceEncounter(state) {
  return isTerminalCaptureState(state.currentEncounter.target.captureState);
}

function isResolvedEncounter(state) {
  return canAdvanceEncounter(state);
}

// A concealed beast reads deceptively until its trigger drives it to bindPosture.
function isConcealedNow(target) {
  const def = beastDef(target);
  return Boolean(def.concealed) && target.posture !== def.bindPosture;
}

// Returns { matched, reacts }. `matched` means a true positive read that
// progresses capture; `reacts` controls the "reacts"/"rejects" log wording.
function evaluateProbe(target, attunement) {
  const def = beastDef(target);
  if (isConcealedNow(target)) {
    return { matched: false, reacts: attunement === def.falseLead };
  }
  const matched = attunement === target.primaryAttunement;
  return { matched, reacts: matched };
}

// Capture state is derived from the two requirements, never set imperatively
// (except terminal states), so a reached window can't be silently downgraded.
function deriveCaptureState(target, flags) {
  if (isTerminalCaptureState(target.captureState)) {
    return target.captureState;
  }
  const def = beastDef(target);
  const postureReady = target.posture === def.bindPosture;
  if (flags.attunementMatch && postureReady) {
    return 'bindable';
  }
  if (flags.attunementMatch || postureReady) {
    return 'probed';
  }
  return 'unreadable';
}

function consumeDefenseFlags(flags) {
  return {
    ...flags,
    guardRaised: false,
    braceRaised: false,
  };
}

function resolveEncounterPressure(state) {
  const enc = state.currentEncounter;
  const target = enc.target;

  if (!isTargetActive(target)) {
    return state;
  }

  const flags = enc.flags;
  const defended = flags.guardRaised || flags.braceRaised;

  let next = {
    ...state,
    currentEncounter: { ...enc, flags: consumeDefenseFlags(flags) },
  };

  if (defended) {
    next = appendLog(
      next,
      flags.guardRaised
        ? 'Guard holds and keeps the pressure off the expedition.'
        : 'Mireback Brace absorbs the counter-pressure.'
    );
  } else {
    const newPressure = enc.pressure + pressurePerTurn(enc.depth);
    next = { ...next, currentEncounter: { ...next.currentEncounter, pressure: newPressure } };

    if (newPressure >= FRENZY_PRESSURE) {
      const woundedLeader = {
        ...next.party.leader,
        health: Math.max(0, next.party.leader.health - FRENZY_LEADER_DAMAGE),
      };
      const { tools, lost } = loseSupply(next.party.tools);
      next = { ...next, party: { ...next.party, leader: woundedLeader, tools } };
      next = appendLog(
        next,
        `${target.name} frenzies! The leader is wounded${lost ? ` and a ${lost} is lost` : ''}.`
      );

      if (woundedLeader.health <= 0) {
        return appendLog(
          completeExpedition(next, 'expedition-failure'),
          'The leader falls. The expedition fails.'
        );
      }
    } else {
      next = appendLog(next, `${target.name} presses back on the expedition.`);
    }
  }

  return decayCaptureWindow(next);
}

// A reached capture window does not last forever: stalling while bindable lets
// the beast slip loose (greed, F4). The collapse is telegraphed, never silent.
function decayCaptureWindow(state) {
  const enc = state.currentEncounter;
  const target = enc.target;
  if (target.captureState !== 'bindable' || enc.flags.snared) {
    return state;
  }

  const decay = (enc.windowDecay ?? 0) + 1;
  if (decay >= WINDOW_GRACE) {
    const def = beastDef(target);
    const relaxed = { ...target, posture: def.initialPosture };
    relaxed.captureState = deriveCaptureState(relaxed, enc.flags);
    return appendLog(
      { ...state, currentEncounter: { ...enc, target: relaxed, windowDecay: 0 } },
      `${target.name} slips loose — the capture window closes.`
    );
  }

  const withDecay = { ...state, currentEncounter: { ...enc, windowDecay: decay } };
  if (decay === WINDOW_GRACE - 1) {
    return appendLog(withDecay, `${target.name} strains against the hold — the window is closing. Bind now!`);
  }
  return withDecay;
}

function finalizeEncounterAction(state, line) {
  const withActionLog = appendLog(state, line);
  const withTurn = {
    ...withActionLog,
    currentEncounter: {
      ...withActionLog.currentEncounter,
      turn: withActionLog.currentEncounter.turn + 1,
    },
  };

  return resolveEncounterPressure(withTurn);
}

export function applyHeroProbe(state, attunement) {
  if (isResolvedEncounter(state)) {
    return state;
  }

  const enc = state.currentEncounter;
  const target = enc.target;
  const { matched, reacts } = evaluateProbe(target, attunement);

  const flags = {
    ...enc.flags,
    attunementMatch: enc.flags.attunementMatch || matched,
  };
  const escapeProgress = matched ? enc.escapeProgress ?? 0 : (enc.escapeProgress ?? 0) + 1;
  const escaped = !matched && escapeProgress >= ESCAPE_READS && !enc.flags.snared;

  const updatedTarget = { ...target };
  updatedTarget.captureState = escaped ? 'escaped' : deriveCaptureState(updatedTarget, flags);

  const probeLine = reacts
    ? `${target.name} reacts to ${attunement}.`
    : `${target.name} rejects the ${attunement} probe.`;

  const baseState = {
    ...state,
    codexHints: matched ? addHint(state.codexHints, target.id, attunement) : state.codexHints,
    currentEncounter: { ...enc, target: updatedTarget, flags, escapeProgress },
  };

  if (escaped) {
    const { tools, lost } = loseSupply(baseState.party.tools);
    let fled = { ...baseState, party: { ...baseState.party, tools } };
    fled = appendLog(fled, probeLine);
    fled = appendLog(fled, `${target.name} breaks the read and escapes${lost ? `, scattering a ${lost}` : ''}.`);
    return {
      ...fled,
      currentEncounter: { ...fled.currentEncounter, turn: fled.currentEncounter.turn + 1 },
    };
  }

  return finalizeEncounterAction(baseState, probeLine);
}

export function applyToolAction(state, toolId) {
  if (isResolvedEncounter(state)) {
    return state;
  }

  const enc = state.currentEncounter;
  const remaining = state.party.tools[toolId];
  if (!remaining) {
    return finalizeEncounterAction(state, `${toolId} is exhausted.`);
  }

  const target = enc.target;
  const def = beastDef(target);
  const triggersPosture = TOOL_ACTION_KIND[toolId] != null && TOOL_ACTION_KIND[toolId] === def.bindKind;

  const flags = toolId === 'snare-line' ? { ...enc.flags, snared: true } : enc.flags;
  const updatedTarget = { ...target };
  if (triggersPosture) {
    updatedTarget.posture = def.bindPosture;
  }
  updatedTarget.captureState = deriveCaptureState(updatedTarget, flags);

  const line = triggersPosture
    ? `Placed ${toolId}; ${target.name} is ${def.bindPosture}.`
    : toolId === 'snare-line'
      ? `Staked a snare-line; ${target.name} cannot flee while it holds.`
      : `Placed ${toolId}.`;

  return finalizeEncounterAction(
    {
      ...state,
      party: {
        ...state.party,
        tools: { ...state.party.tools, [toolId]: remaining - 1 },
      },
      currentEncounter: {
        ...enc,
        structures: [...enc.structures, toolId],
        target: updatedTarget,
        flags,
      },
    },
    line
  );
}

export function applyCompanionAction(state, beastId, actionId) {
  if (isResolvedEncounter(state)) {
    return state;
  }

  const beast = state.party.beasts[beastId];
  if (!beast) {
    return state; // beast not fielded this run
  }

  const enc = state.currentEncounter;
  const target = enc.target;
  const def = beastDef(target);

  const kind = COMPANION_ACTION_KIND[actionId] ?? null;
  const triggersPosture = kind != null && kind === def.bindKind;

  const updatedTarget = { ...target };
  let flags = { ...enc.flags };
  let codexHints = state.codexHints;
  let line = `${beast.name} uses ${actionId}.`;

  if (triggersPosture) {
    updatedTarget.posture = def.bindPosture;
  }

  if (kind === 'reveal') {
    // Scent Read / Sense expose the true attunement (and reveal concealed beasts).
    codexHints = addHint(codexHints, target.id, target.primaryAttunement);
    line = triggersPosture
      ? `${beast.name} flushes out ${target.name}: it responds to ${target.primaryAttunement}, now ${def.bindPosture}.`
      : `${beast.name} reads ${target.name}: it responds to ${target.primaryAttunement}.`;
  } else if (triggersPosture) {
    const verb = kind === 'corner' ? 'into a corner' : kind === 'stagger' ? 'off balance' : 'to the ground';
    line = `${beast.name} forces ${target.name} ${verb}; it is ${def.bindPosture}.`;
  } else if (actionId === 'warning-bark') {
    flags.guardRaised = true;
    line = `${beast.name} barks a warning; the expedition steadies.`;
  } else if (actionId === 'brace') {
    flags.braceRaised = true;
    line = `${beast.name} braces the line.`;
  } else if (actionId === 'burden-shelter') {
    flags.braceRaised = true;
    line = `${beast.name} shelters the supplies and steadies the line.`;
  }

  updatedTarget.captureState = deriveCaptureState(updatedTarget, flags);

  return finalizeEncounterAction(
    {
      ...state,
      codexHints,
      party: {
        ...state.party,
        beasts: {
          ...state.party.beasts,
          [beastId]: { ...beast, fatigue: beast.fatigue + 1 },
        },
      },
      currentEncounter: { ...enc, target: updatedTarget, flags },
    },
    line
  );
}

export function applyStrikeAction(state) {
  if (isResolvedEncounter(state)) {
    return state;
  }

  const target = state.currentEncounter.target;
  const nextHealth = Math.max(0, target.health - 1);

  return finalizeEncounterAction(
    {
      ...state,
      currentEncounter: {
        ...state.currentEncounter,
        target: {
          ...target,
          health: nextHealth,
          captureState: nextHealth === 0 ? 'defeated' : target.captureState,
        },
      },
    },
    `${target.name} takes a strike.`
  );
}

export function applyGuardAction(state) {
  if (isResolvedEncounter(state)) {
    return state;
  }

  return finalizeEncounterAction(
    {
      ...state,
      currentEncounter: {
        ...state.currentEncounter,
        flags: {
          ...state.currentEncounter.flags,
          guardRaised: true,
        },
      },
    },
    'The expedition takes a guarded stance.'
  );
}

export function attemptCapture(state) {
  if (isResolvedEncounter(state)) {
    return state;
  }

  const target = state.currentEncounter.target;
  if (target.captureState !== 'bindable') {
    return finalizeEncounterAction(state, `${target.name} is not ready to bind.`);
  }

  return finalizeEncounterAction(
    {
      ...state,
      party: {
        ...state.party,
        captures: [...state.party.captures, target.id],
      },
      currentEncounter: {
        ...state.currentEncounter,
        target: {
          ...target,
          captureState: 'captured',
        },
      },
    },
    `${target.name} is captured.`
  );
}

// Withdraw is a clean exit (kill / capture / withdraw decision, F6): it resolves
// the encounter with no capture and no retaliation, preserving the expedition.
export function withdrawEncounter(state) {
  if (isResolvedEncounter(state)) {
    return state;
  }

  const enc = state.currentEncounter;
  const target = enc.target;

  return appendLog(
    {
      ...state,
      currentEncounter: {
        ...enc,
        target: { ...target, captureState: 'withdrawn' },
      },
    },
    `The expedition withdraws from ${target.name}, keeping what it has earned.`
  );
}

// Anchor recovery thins with depth so anchors are never a full reset (z4y.4).
export function anchorHeal(depth) {
  return Math.max(1, 4 - (depth ?? 1));
}

// Anchors (E3): a recovery checkpoint between layers. Once a layer is resolved,
// the expedition can anchor to heal the leader and shed beast fatigue before
// deciding to descend or extract. Available once per layer.
export function anchorExpedition(state) {
  if (state.expeditionComplete || !canAdvanceEncounter(state) || state.currentEncounter.anchored) {
    return state;
  }

  const heal = anchorHeal(state.currentEncounter.depth);
  const leader = {
    ...state.party.leader,
    health: Math.min(state.party.leader.maxHealth, state.party.leader.health + heal),
  };
  const beasts = Object.fromEntries(
    Object.entries(state.party.beasts).map(([id, beast]) => [
      id,
      { ...beast, fatigue: Math.max(0, beast.fatigue - 2) },
    ])
  );

  return appendLog(
    {
      ...state,
      party: { ...state.party, leader, beasts },
      currentEncounter: { ...state.currentEncounter, anchored: true },
    },
    `The expedition anchors at layer ${state.currentEncounter.depth}: it heals and steadies (recovery thins deeper down).`
  );
}

// Extract or Commit (E2): once a layer is resolved, end the run now and bank the
// haul (safe), instead of descending deeper into harder layers.
export function extractExpedition(state) {
  if (state.expeditionComplete || !canAdvanceEncounter(state)) {
    return state;
  }
  const captures = state.party.captures.length;
  const rank = captures >= 2 ? 'strong-success' : captures >= 1 ? 'success' : 'partial-failure';
  return appendLog(
    completeExpedition(state, rank),
    `The expedition extracts from layer ${state.currentEncounter.depth} with its haul.`
  );
}

export function advanceEncounter(state) {
  if (!canAdvanceEncounter(state)) {
    return appendLog(state, 'The encounter is still active. You cannot advance yet.');
  }

  const nextIndex = state.encounterIndex + 1;
  const captures = state.party.captures.length;
  const carryoverPressure =
    state.currentEncounter.pressure +
    Object.values(state.party.beasts).reduce((total, beast) => total + beast.fatigue, 0);

  if (nextIndex >= state.encounterIds.length) {
    return appendLog(
      completeExpedition(
        state,
        captures >= 2 ? 'strong-success' : captures >= 1 ? 'success' : 'partial-failure'
      ),
      'Expedition complete.'
    );
  }

  const carriedLeaderHealth =
    carryoverPressure > 0 ? Math.max(0, state.party.leader.health - 1) : state.party.leader.health;

  if (carriedLeaderHealth <= 0) {
    return appendLog(
      completeExpedition(
        { ...state, party: { ...state.party, leader: { ...state.party.leader, health: 0 } } },
        'expedition-failure'
      ),
      'The leader does not recover from the descent. The expedition fails.'
    );
  }

  const advanced = seedEncounterKnowledge({
    ...state,
    encounterIndex: nextIndex,
    currentEncounter: {
      target: createTargetState(state.encounterIds[nextIndex], nextIndex + 1),
      depth: nextIndex + 1,
      anchored: false,
      turn: 1,
      pressure: 0,
      riskLevel: carryoverPressure,
      escapeProgress: 0,
      windowDecay: 0,
      structures: [],
      flags: {
        attunementMatch: false,
        guardRaised: false,
        braceRaised: false,
        alerted: carryoverPressure > 0,
      },
    },
    party: {
      ...state.party,
      leader: { ...state.party.leader, health: carriedLeaderHealth },
    },
  });

  return appendLog(advanced, `Advance to encounter ${nextIndex + 1}.`);
}
