import { createTargetState } from './state.mjs';

function appendLog(state, line) {
  return { ...state, log: [...state.log, line] };
}

function hasPostureSetup(structures) {
  return structures.includes('snare-line') || structures.includes('bait-stake');
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

  const target = state.currentEncounter.target;
  const matched = attunement === target.primaryAttunement;

  return finalizeEncounterAction(
    {
      ...state,
      codexHints: matched
        ? {
            ...state.codexHints,
            [target.id]: [...new Set([...(state.codexHints[target.id] ?? []), attunement])],
          }
        : state.codexHints,
      currentEncounter: {
        ...state.currentEncounter,
        target: {
          ...target,
          captureState: matched && !isTerminalCaptureState(target.captureState) ? 'probed' : target.captureState,
        },
        flags: {
          ...state.currentEncounter.flags,
          attunementMatch: state.currentEncounter.flags.attunementMatch || matched,
        },
      },
    },
    matched ? `${target.name} reacts to ${attunement}.` : `${target.name} rejects the ${attunement} probe.`
  );
}

export function applyToolAction(state, toolId) {
  if (isResolvedEncounter(state)) {
    return state;
  }

  const remaining = state.party.tools[toolId];
  if (!remaining) {
    return finalizeEncounterAction(state, `${toolId} is exhausted.`);
  }

  const structures = [...state.currentEncounter.structures, toolId];

  return finalizeEncounterAction(
    {
      ...state,
      party: {
        ...state.party,
        tools: {
          ...state.party.tools,
          [toolId]: remaining - 1,
        },
      },
      currentEncounter: {
        ...state.currentEncounter,
        structures,
        flags: {
          ...state.currentEncounter.flags,
          postureReady: state.currentEncounter.flags.postureReady || hasPostureSetup(structures),
        },
      },
    },
    `Placed ${toolId}.`
  );
}

export function applyCompanionAction(state, beastId, actionId) {
  if (isResolvedEncounter(state)) {
    return state;
  }

  const beast = state.party.beasts[beastId];
  const target = state.currentEncounter.target;

  const nextState = {
    ...state,
    party: {
      ...state.party,
      beasts: {
        ...state.party.beasts,
        [beastId]: {
          ...beast,
          fatigue: beast.fatigue + 1,
        },
      },
    },
  };

  if (beastId === 'grave-hound' && actionId === 'harry') {
    const bindable = state.currentEncounter.flags.attunementMatch && state.currentEncounter.flags.postureReady;

    return finalizeEncounterAction(
      {
        ...nextState,
        currentEncounter: {
          ...state.currentEncounter,
          target: {
            ...target,
            captureState: bindable && !isTerminalCaptureState(target.captureState) ? 'bindable' : target.captureState,
          },
        },
      },
      `${beast.name} harries ${target.name}.`
    );
  }

  if (beastId === 'mireback-tortoise' && actionId === 'brace') {
    return finalizeEncounterAction(
      {
        ...nextState,
        currentEncounter: {
          ...state.currentEncounter,
          flags: {
            ...state.currentEncounter.flags,
            braceRaised: true,
          },
        },
      },
      `${beast.name} braces the line.`
    );
  }

  return finalizeEncounterAction(nextState, `${beast.name} uses ${actionId}.`);
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
          postureReady: false,
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
