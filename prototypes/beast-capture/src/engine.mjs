import { createTargetState } from './state.mjs';
import { TARGET_BEASTS } from './content.mjs';

function appendLog(state, line) {
  return { ...state, log: [...state.log, line] };
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
  return value === 'defeated' || value === 'captured';
}

function isTargetActive(target) {
  return !isTerminalCaptureState(target.captureState);
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
  const { currentEncounter } = state;
  const { target, flags } = currentEncounter;

  if (!isTargetActive(target)) {
    return state;
  }

  const defended = flags.guardRaised || flags.braceRaised;
  const pressureGain = defended ? 0 : 1;
  const line = flags.guardRaised
    ? 'Guard holds and keeps the pressure off the expedition.'
    : flags.braceRaised
      ? 'Mireback Brace absorbs the counter-pressure.'
      : `${target.name} presses back on the expedition.`;

  return appendLog(
    {
      ...state,
      currentEncounter: {
        ...currentEncounter,
        pressure: currentEncounter.pressure + pressureGain,
        flags: consumeDefenseFlags(flags),
      },
    },
    line
  );
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
  const updatedTarget = { ...target };
  updatedTarget.captureState = deriveCaptureState(updatedTarget, flags);

  return finalizeEncounterAction(
    {
      ...state,
      codexHints: matched ? addHint(state.codexHints, target.id, attunement) : state.codexHints,
      currentEncounter: { ...enc, target: updatedTarget, flags },
    },
    reacts ? `${target.name} reacts to ${attunement}.` : `${target.name} rejects the ${attunement} probe.`
  );
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

  return appendLog(
    {
      ...state,
      encounterIndex: nextIndex,
      currentEncounter: {
        target: createTargetState(state.encounterIds[nextIndex]),
        turn: 1,
        pressure: 0,
        riskLevel: carryoverPressure,
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
        leader: {
          ...state.party.leader,
          health: carryoverPressure > 0 ? Math.max(0, state.party.leader.health - 1) : state.party.leader.health,
        },
      },
    },
    `Advance to encounter ${nextIndex + 1}.`
  );
}
