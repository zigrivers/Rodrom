import { createInitialState, buildEncounterOrder, buyUpgrade, toggleFielded } from './state.mjs';
import { OMENS } from './content.mjs';
import {
  applyHeroProbe,
  applyGuardAction,
  applyStrikeAction,
  applyToolAction,
  applyCompanionAction,
  attemptCapture,
  withdrawEncounter,
  anchorExpedition,
  advanceEncounter,
  extractExpedition,
} from './engine.mjs';
import { renderApp } from './ui.mjs';

const ROSTER_KEY = 'spiral-descent-roster';
const BONDS_KEY = 'spiral-descent-bonds';
const LORE_KEY = 'spiral-descent-lore';
const UPGRADES_KEY = 'spiral-descent-upgrades';
const COACH_KEY = 'spiral-descent-coach';

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
    localStorage.setItem(LORE_KEY, JSON.stringify(s.lore ?? 0));
    localStorage.setItem(UPGRADES_KEY, JSON.stringify(s.upgrades ?? {}));
    localStorage.setItem(COACH_KEY, JSON.stringify(s.coach ?? true));
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

const campaign = {
  roster: loadJSON(ROSTER_KEY, []),
  bonds: loadJSON(BONDS_KEY, {}),
  lore: loadJSON(LORE_KEY, 0),
  upgrades: loadJSON(UPGRADES_KEY, {}),
  coach: loadJSON(COACH_KEY, true),
};

let state = createInitialState({ started: false, ...campaign });
const app = document.querySelector('#app');

function startExpedition() {
  const firstRun = (state.roster ?? []).length === 0;
  const variant = Math.floor(Math.random() * 4);
  const omenKeys = Object.keys(OMENS);
  const omen = omenKeys[Math.floor(Math.random() * omenKeys.length)];
  return createInitialState({
    started: true,
    encounterIds: buildEncounterOrder(variant, firstRun),
    omen,
    roster: state.roster,
    bonds: state.bonds,
    lore: state.lore,
    upgrades: state.upgrades,
    fielded: state.fielded,
    coach: state.coach,
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
    case 'anchor':
      state = anchorExpedition(state);
      break;
    case 'advance':
      state = advanceEncounter(state);
      break;
    case 'extract':
      state = extractExpedition(state);
      break;
    case 'replay':
      state = createInitialState({
        started: false,
        roster: state.roster,
        bonds: state.bonds,
        lore: state.lore,
        upgrades: state.upgrades,
        fielded: state.fielded,
        coach: state.coach,
      });
      break;
    case 'toggle-coach':
      // Coach only drives guidance text, so flip it in place — never reset the run.
      state = { ...state, coach: !(state.coach ?? true) };
      break;
    default:
      if (button.dataset.action.startsWith('buy-')) {
        state = buyUpgrade(state, button.dataset.action.slice('buy-'.length));
      } else if (button.dataset.action.startsWith('companion:')) {
        const [, beastId, actionId] = button.dataset.action.split(':');
        state = applyCompanionAction(state, beastId, actionId);
      } else if (button.dataset.action.startsWith('toggle-')) {
        const beastId = button.dataset.action.slice('toggle-'.length);
        const fielded = toggleFielded(state.fielded, beastId);
        state = createInitialState({
          started: false,
          roster: state.roster,
          bonds: state.bonds,
          lore: state.lore,
          upgrades: state.upgrades,
          fielded,
          coach: state.coach,
        });
      }
      break;
  }

  saveCampaign(state);
  rerender();
});

rerender();
