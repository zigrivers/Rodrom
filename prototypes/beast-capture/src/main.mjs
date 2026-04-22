import { createInitialState } from './state.mjs';
import {
  applyHeroProbe,
  applyToolAction,
  applyCompanionAction,
  attemptCapture,
  advanceEncounter,
} from './engine.mjs';
import { renderApp } from './ui.mjs';

let state = createInitialState();
const app = document.querySelector('#app');

function rerender() {
  app.innerHTML = renderApp(state);
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled) return;

  switch (button.dataset.action) {
    case 'probe-ash':
      state = applyHeroProbe(state, 'ash');
      break;
    case 'probe-veil':
      state = applyHeroProbe(state, 'veil');
      break;
    case 'tool-snare-line':
      state = applyToolAction(state, 'snare-line');
      break;
    case 'tool-salt-marker':
      state = applyToolAction(state, 'salt-marker');
      break;
    case 'hound-harry':
      state = applyCompanionAction(state, 'grave-hound', 'harry');
      break;
    case 'tortoise-brace':
      state = applyCompanionAction(state, 'mireback-tortoise', 'brace');
      break;
    case 'capture':
      state = attemptCapture(state);
      break;
    case 'advance':
      state = advanceEncounter(state);
      break;
    default:
      break;
  }

  rerender();
});

rerender();
