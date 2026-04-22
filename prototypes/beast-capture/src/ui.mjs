import { canCapture } from './engine.mjs';

export function renderApp(state) {
  const target = state.currentEncounter.target;
  const captureDisabled = !canCapture(state);

  return `
    <div class="layout">
      <section class="panel">
        <h1>Beast Capture Prototype</h1>
        <h2>${target.name}</h2>
        <p>Posture: ${target.posture}</p>
        <p>Capture state: ${describeCaptureState(target.captureState)}</p>
        <div class="actions">
          <button data-action="strike">Strike</button>
          <button data-action="guard">Guard</button>
          <button data-action="probe-ash">Probe Ash</button>
          <button data-action="probe-veil">Probe Veil</button>
          <button data-action="tool-snare-line">Snare Line</button>
          <button data-action="tool-salt-marker">Salt Marker</button>
          <button data-action="hound-harry">Grave Hound: Harry</button>
          <button data-action="tortoise-brace">Mireback: Brace</button>
          <button data-action="capture" ${captureDisabled ? 'disabled' : ''}>Capture</button>
          <button data-action="advance">Advance</button>
        </div>
      </section>
      <aside class="panel">
        <h3>Expedition</h3>
        <p>Leader HP: ${state.party.leader.health}/${state.party.leader.maxHealth}</p>
        <p>Grave Hound fatigue: ${state.party.beasts['grave-hound'].fatigue}</p>
        <p>Mireback fatigue: ${state.party.beasts['mireback-tortoise'].fatigue}</p>
        <p>Captures: ${state.party.captures.join(', ') || 'none'}</p>
        <h3>Log</h3>
        <div class="log">${state.log.map((line) => `<div>${line}</div>`).join('')}</div>
      </aside>
    </div>
  `;
}

function describeCaptureState(value) {
  const map = {
    unreadable: 'Unreadable',
    probed: 'Disturbed',
    bindable: 'Bindable',
    captured: 'Captured',
  };

  return map[value] ?? value;
}
