import { createInitialState, buildEncounterOrder } from './state.mjs';
import {
  applyHeroProbe,
  applyGuardAction,
  applyStrikeAction,
  applyToolAction,
  applyCompanionAction,
  attemptCapture,
  withdrawEncounter,
  advanceEncounter,
} from './engine.mjs';
import { renderApp } from './ui.mjs';

const ROSTER_KEY = 'spiral-descent-roster';
const BONDS_KEY = 'spiral-descent-bonds';

function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveCampaign(s) {
  try {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(s.roster ?? []));
    localStorage.setItem(BONDS_KEY, JSON.stringify(s.bonds ?? {}));
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

let state = createInitialState({
  started: false,
  roster: loadJSON(ROSTER_KEY, []),
  bonds: loadJSON(BONDS_KEY, {}),
});
const app = document.querySelector('#app');

function startExpedition() {
  const variant = Math.floor(Math.random() * 3);
  return createInitialState({
    started: true,
    encounterIds: buildEncounterOrder(variant),
    roster: state.roster,
    bonds: state.bonds,
    fielded: state.fielded,
  });
}

function rerender() {
  app.innerHTML = renderApp(state);
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled) return;

  switch (button.dataset.action) {
    case 'start-expedition':
      state = startExpedition();
      break;
    case 'strike':
      state = applyStrikeAction(state);
      break;
    case 'guard':
      state = applyGuardAction(state);
      break;
    case 'probe-ash':
      state = applyHeroProbe(state, 'ash');
      break;
    case 'probe-iron':
      state = applyHeroProbe(state, 'iron');
      break;
    case 'probe-storm':
      state = applyHeroProbe(state, 'storm');
      break;
    case 'probe-veil':
      state = applyHeroProbe(state, 'veil');
      break;
    case 'tool-snare-line':
      state = applyToolAction(state, 'snare-line');
      break;
    case 'tool-bait-stake':
      state = applyToolAction(state, 'bait-stake');
      break;
    case 'hound-scent-read':
      state = applyCompanionAction(state, 'grave-hound', 'scent-read');
      break;
    case 'hound-harry':
      state = applyCompanionAction(state, 'grave-hound', 'harry');
      break;
    case 'hound-warning-bark':
      state = applyCompanionAction(state, 'grave-hound', 'warning-bark');
      break;
    case 'mireback-brace':
      state = applyCompanionAction(state, 'mireback-tortoise', 'brace');
      break;
    case 'mireback-shove':
      state = applyCompanionAction(state, 'mireback-tortoise', 'shove');
      break;
    case 'mireback-burden-shelter':
      state = applyCompanionAction(state, 'mireback-tortoise', 'burden-shelter');
      break;
    case 'capture':
      state = attemptCapture(state);
      break;
    case 'withdraw':
      state = withdrawEncounter(state);
      break;
    case 'advance':
      state = advanceEncounter(state);
      break;
    case 'replay':
      state = createInitialState({ started: false, roster: state.roster, bonds: state.bonds });
      break;
    default:
      if (button.dataset.action.startsWith('companion:')) {
        const [, beastId, actionId] = button.dataset.action.split(':');
        state = applyCompanionAction(state, beastId, actionId);
      } else if (button.dataset.action.startsWith('toggle-')) {
        const beastId = button.dataset.action.slice('toggle-'.length);
        const fielded = state.fielded.includes(beastId)
          ? state.fielded.filter((id) => id !== beastId)
          : [...state.fielded, beastId];
        state = createInitialState({
          started: false,
          roster: state.roster,
          bonds: state.bonds,
          fielded,
        });
      }
      break;
  }

  saveCampaign(state);
  rerender();
});

rerender();
