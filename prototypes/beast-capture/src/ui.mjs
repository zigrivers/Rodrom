import { TARGET_BEASTS, TOOLS } from './content.mjs';
import { canAdvanceEncounter } from './engine.mjs';

export function renderApp(state) {
  if (state.expeditionComplete) {
    return `
      <section class="panel">
        <h1>Expedition Complete</h1>
        <p>Result: ${state.result.rank}</p>
        <p>Captures: ${state.result.captures}</p>
        <button data-action="replay">Run Again</button>
        <h3>Learned Clue Summary</h3>
        ${renderClueSummary(state.codexHints)}
        <h3>Log</h3>
        <div class="log">${state.log.map((line) => `<div>${line}</div>`).join('')}</div>
      </section>
    `;
  }

  const target = state.currentEncounter.target;
  const currentHints = state.codexHints[target.id] ?? [];
  const encounterResolved = canAdvanceEncounter(state);
  const captureDisabled = target.captureState !== 'bindable';
  const advanceAllowed = encounterResolved;

  return `
    <div class="layout">
      <section class="panel">
        <h1>Beast Capture Prototype</h1>
        <h2>${target.name}</h2>
        <div class="stats">
          <p>Turn: ${state.currentEncounter.turn}</p>
          <p>Target HP: ${target.health}/${target.maxHealth}</p>
          <p>Posture: ${target.posture}</p>
          <p>Capture state: ${describeCaptureState(target.captureState)}</p>
          <p>Pressure: ${state.currentEncounter.pressure}</p>
          <p>Carryover Risk: ${state.currentEncounter.riskLevel}</p>
          <p>Advance: ${advanceAllowed ? 'Ready' : 'Locked'}</p>
        </div>
        <div class="actions">
          <button data-action="strike" ${renderDisabled(encounterResolved)}>Strike</button>
          <button data-action="guard" ${renderDisabled(encounterResolved)}>Guard</button>
          <button data-action="probe-ash" ${renderDisabled(encounterResolved)}>Probe Ash</button>
          <button data-action="probe-iron" ${renderDisabled(encounterResolved)}>Probe Iron</button>
          <button data-action="probe-storm" ${renderDisabled(encounterResolved)}>Probe Storm</button>
          <button
            data-action="tool-snare-line"
            ${renderDisabled(encounterResolved || state.party.tools['snare-line'] === 0)}
          >
            Snare Line
          </button>
          <button
            data-action="tool-bait-stake"
            ${renderDisabled(encounterResolved || state.party.tools['bait-stake'] === 0)}
          >
            Bait Stake
          </button>
          <button data-action="hound-scent-read" ${renderDisabled(encounterResolved)}>Grave Hound: Scent Read</button>
          <button data-action="hound-harry" ${renderDisabled(encounterResolved)}>Grave Hound: Harry</button>
          <button data-action="hound-warning-bark" ${renderDisabled(encounterResolved)}>Grave Hound: Warning Bark</button>
          <button data-action="mireback-brace" ${renderDisabled(encounterResolved)}>Mireback: Brace</button>
          <button data-action="mireback-shove" ${renderDisabled(encounterResolved)}>Mireback: Shove</button>
          <button data-action="mireback-burden-shelter" ${renderDisabled(encounterResolved)}>Mireback: Burden Shelter</button>
          <button data-action="capture" ${renderDisabled(encounterResolved || captureDisabled)}>Capture</button>
          <button data-action="advance" ${renderDisabled(!advanceAllowed)}>Advance</button>
        </div>
      </section>
      <aside class="panel">
        <h3>Expedition</h3>
        <p>Leader HP: ${state.party.leader.health}/${state.party.leader.maxHealth}</p>
        <p>Grave Hound fatigue: ${state.party.beasts['grave-hound'].fatigue}</p>
        <p>Mireback fatigue: ${state.party.beasts['mireback-tortoise'].fatigue}</p>
        <p>Captures: ${renderCaptureNames(state.party.captures)}</p>
        <h3>Tool Counts</h3>
        <ul class="summary-list">${renderToolCounts(state.party.tools)}</ul>
        <h3>Placed Structures</h3>
        <ul class="summary-list">${renderStructures(state.currentEncounter.structures)}</ul>
        <h3>Learned Clues</h3>
        <ul class="summary-list">${renderHints(currentHints)}</ul>
        <h3>Log</h3>
        <div class="log">${state.log.map((line) => `<div>${line}</div>`).join('')}</div>
      </aside>
    </div>
  `;
}

function renderDisabled(disabled) {
  return disabled ? 'disabled' : '';
}

function renderCaptureNames(captures) {
  return captures.map((targetId) => TARGET_BEASTS[targetId]?.name ?? targetId).join(', ') || 'none';
}

function renderToolCounts(tools) {
  return ['snare-line', 'bait-stake']
    .map((toolId) => `<li>${TOOLS[toolId].name}: ${tools[toolId]}</li>`)
    .join('');
}

function renderStructures(structures) {
  if (structures.length === 0) {
    return '<li>None placed</li>';
  }

  return structures.map((toolId) => `<li>${TOOLS[toolId]?.name ?? toolId}</li>`).join('');
}

function renderHints(hints) {
  if (hints.length === 0) {
    return '<li>No clues learned yet</li>';
  }

  return hints.map((hint) => `<li>${formatLabel(hint)}</li>`).join('');
}

function renderClueSummary(codexHints) {
  const entries = Object.entries(codexHints);
  if (entries.length === 0) {
    return '<p>No clues recorded.</p>';
  }

  return `
    <ul class="summary-list">
      ${entries
        .map(
          ([targetId, hints]) =>
            `<li>${TARGET_BEASTS[targetId]?.name ?? targetId}: ${hints.map((hint) => formatLabel(hint)).join(', ')}</li>`
        )
        .join('')}
    </ul>
  `;
}

function formatLabel(value) {
  return value
    .split('-')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function describeCaptureState(value) {
  const map = {
    unreadable: 'Unreadable',
    probed: 'Disturbed',
    bindable: 'Bindable',
    defeated: 'Defeated',
    captured: 'Captured',
  };

  return map[value] ?? value;
}
