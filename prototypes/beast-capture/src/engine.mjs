import { createTargetState } from './state.mjs';

function appendLog(state, line) {
  return { ...state, log: [...state.log, line] };
}

function hasPostureSetup(structures) {
  return structures.includes('snare-line') || structures.includes('bait-stake');
}

export function applyHeroProbe(state, attunement) {
  const target = state.currentEncounter.target;
  const matched = attunement === target.primaryAttunement;

  const nextState = {
    ...state,
    codexHints: {
      ...state.codexHints,
      [target.id]: [...new Set([...(state.codexHints[target.id] ?? []), attunement])],
    },
    currentEncounter: {
      ...state.currentEncounter,
      target: {
        ...target,
        captureState: matched ? 'probed' : target.captureState,
      },
      flags: {
        ...state.currentEncounter.flags,
        attunementMatch: state.currentEncounter.flags.attunementMatch || matched,
      },
    },
  };

  return appendLog(nextState, matched ? `${target.name} reacts to ${attunement}.` : `${target.name} rejects the probe.`);
}

export function applyToolAction(state, toolId) {
  const remaining = state.party.tools[toolId];
  if (!remaining) {
    return appendLog(state, `${toolId} is exhausted.`);
  }

  const nextState = {
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
      structures: [...state.currentEncounter.structures, toolId],
      flags: {
        ...state.currentEncounter.flags,
        postureReady:
          state.currentEncounter.flags.postureReady || hasPostureSetup([...state.currentEncounter.structures, toolId]),
      },
    },
  };

  return appendLog(nextState, `Placed ${toolId}.`);
}

export function applyCompanionAction(state, beastId, actionId) {
  const target = state.currentEncounter.target;
  const bindable =
    beastId === 'grave-hound' &&
    actionId === 'harry' &&
    state.currentEncounter.flags.attunementMatch &&
    state.currentEncounter.flags.postureReady;

  const nextState = {
    ...state,
    party: {
      ...state.party,
      beasts: {
        ...state.party.beasts,
        [beastId]: {
          ...state.party.beasts[beastId],
          fatigue: state.party.beasts[beastId].fatigue + 1,
        },
      },
    },
    currentEncounter: {
      ...state.currentEncounter,
      target: {
        ...target,
        captureState: bindable ? 'bindable' : target.captureState,
      },
    },
  };

  return appendLog(nextState, `${state.party.beasts[beastId].name} uses ${actionId}.`);
}

export function applyStrikeAction(state) {
  const target = state.currentEncounter.target;
  const nextHealth = Math.max(0, target.health - 1);
  const nextState = {
    ...state,
    currentEncounter: {
      ...state.currentEncounter,
      flags: {
        ...state.currentEncounter.flags,
        guardRaised: false,
      },
      target: {
        ...target,
        health: nextHealth,
        captureState: nextHealth === 0 ? 'defeated' : target.captureState,
      },
    },
  };

  return appendLog(nextState, `${target.name} takes a strike.`);
}

export function applyGuardAction(state) {
  return appendLog(
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
  const target = state.currentEncounter.target;
  if (target.captureState !== 'bindable') {
    return appendLog(state, `${target.name} is not ready to bind.`);
  }

  const nextState = {
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
  };

  return appendLog(nextState, `${target.name} is captured.`);
}

export function advanceEncounter(state) {
  const nextIndex = state.encounterIndex + 1;
  if (nextIndex >= state.encounterIds.length) {
    return appendLog({ ...state, expeditionComplete: true }, 'Expedition complete.');
  }

  const nextState = {
    ...state,
    encounterIndex: nextIndex,
    currentEncounter: {
      target: createTargetState(state.encounterIds[nextIndex]),
      turn: 1,
      structures: [],
      flags: {
        attunementMatch: false,
        postureReady: false,
        guardRaised: false,
      },
    },
  };

  return appendLog(nextState, `Advance to encounter ${nextIndex + 1}.`);
}
