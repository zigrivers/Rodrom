import { createTargetState } from './state.mjs';
import { TARGET_BEASTS } from './content.mjs';

// Consequence tuning (F4/F7/F11). Kept as named constants for easy balancing.
const ESCAPE_READS = 3; // wrong-attunement probes before the beast flees
const FRENZY_PRESSURE = 6; // pressure at which an undefended turn wounds the leader
const FRENZY_LEADER_DAMAGE = 1;
const WINDOW_GRACE = 3; // open-window turns before a bindable beast slips loose

function appendLog(state, line) {
  return { ...state, log: [...state.log, line] };
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
  return value === 'defeated' || value === 'captured' || value === 'escaped';
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
    const newPressure = enc.pressure + 1;
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
          {
            ...next,
            expeditionComplete: true,
            result: { rank: 'expedition-failure', captures: next.party.captures.length },
          },
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
  if (target.captureState !== 'bindable') {
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
  const escaped = !matched && escapeProgress >= ESCAPE_READS;

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
  const triggersPosture = def.postureTrigger.type === 'tool' && def.postureTrigger.toolId === toolId;

  const updatedTarget = { ...target };
  if (triggersPosture) {
    updatedTarget.posture = def.bindPosture;
  }
  updatedTarget.captureState = deriveCaptureState(updatedTarget, enc.flags);

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
      },
    },
    triggersPosture ? `Placed ${toolId}; ${target.name} is ${def.bindPosture}.` : `Placed ${toolId}.`
  );
}

export function applyCompanionAction(state, beastId, actionId) {
  if (isResolvedEncounter(state)) {
    return state;
  }

  const enc = state.currentEncounter;
  const beast = state.party.beasts[beastId];
  const target = enc.target;
  const def = beastDef(target);

  const triggersPosture =
    def.postureTrigger.type === 'companion' &&
    def.postureTrigger.beastId === beastId &&
    def.postureTrigger.actionId === actionId;

  const updatedTarget = { ...target };
  let flags = { ...enc.flags };
  let codexHints = state.codexHints;
  let line = `${beast.name} uses ${actionId}.`;

  if (triggersPosture) {
    updatedTarget.posture = def.bindPosture;
  }

  if (beastId === 'grave-hound' && actionId === 'scent-read') {
    codexHints = addHint(codexHints, target.id, target.primaryAttunement);
    line = triggersPosture
      ? `${beast.name} scents ${target.name}: it responds to ${target.primaryAttunement}, and slips into the open.`
      : `${beast.name} scents ${target.name}: it responds to ${target.primaryAttunement}.`;
  } else if (triggersPosture) {
    line = `${beast.name} forces ${target.name} ${actionId === 'harry' ? 'into a corner' : 'off balance'}; it is ${def.bindPosture}.`;
  } else if (beastId === 'grave-hound' && actionId === 'warning-bark') {
    flags.guardRaised = true;
    line = `${beast.name} barks a warning; the expedition steadies.`;
  } else if (beastId === 'mireback-tortoise' && actionId === 'brace') {
    flags.braceRaised = true;
    line = `${beast.name} braces the line.`;
  } else if (beastId === 'mireback-tortoise' && actionId === 'burden-shelter') {
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
      {
        ...state,
        expeditionComplete: true,
        result: {
          rank: captures >= 2 ? 'strong-success' : captures >= 1 ? 'success' : 'partial-failure',
          captures,
        },
      },
      'Expedition complete.'
    );
  }

  const carriedLeaderHealth =
    carryoverPressure > 0 ? Math.max(0, state.party.leader.health - 1) : state.party.leader.health;

  if (carriedLeaderHealth <= 0) {
    return appendLog(
      {
        ...state,
        expeditionComplete: true,
        result: { rank: 'expedition-failure', captures },
        party: { ...state.party, leader: { ...state.party.leader, health: 0 } },
      },
      'The leader does not recover from the descent. The expedition fails.'
    );
  }

  return appendLog(
    {
      ...state,
      encounterIndex: nextIndex,
      currentEncounter: {
        target: createTargetState(state.encounterIds[nextIndex]),
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
    },
    `Advance to encounter ${nextIndex + 1}.`
  );
}
