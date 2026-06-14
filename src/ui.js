import { PLAYER_BEASTS, TARGET_BEASTS, TOOLS, CAPTURED_ALLY } from './content.js';
import { canAdvanceEncounter, tensionLabel } from './engine.js';
import { upgradeCost, UPGRADES } from './state.js';

export function renderApp(state) {
  if (!state.started) {
    return `
      <section class="panel">
        <h1>Beast Capture Prototype</h1>
        <p>Lead a short expedition into the spiral. Read each beast, drive it into a
        bindable posture, and capture it — or kill it, or withdraw before it costs you.</p>
        ${renderRoster(state.roster)}
        <h3>Town</h3>
        <p>Lore: ${state.lore}</p>
        ${renderTownUpgrades(state)}
        <h3>Party — who do you field?</h3>
        <p>Each beast brings different actions, so your party decides which captures are even possible.</p>
        ${renderPartyPicker(state.fielded, state.roster, state.bonds)}
        ${renderCoachToggle(state)}
        <button data-action="start-expedition">Start Expedition</button>
      </section>
    `;
  }

  if (state.expeditionComplete) {
    return `
      <section class="panel">
        <h1>Expedition Complete</h1>
        <p>Result: ${state.result.rank}</p>
        <p>Captures this run: ${state.result.captures}</p>
        <p>Lore earned: ${state.result.loreEarned} (town total: ${state.lore})</p>
        ${
          state.result.bonusLore > 0
            ? `<p>Capture bonus: +${state.result.bonusLore} Lore from clean/fast captures${state.result.cleanCaptures > 0 ? ` (${state.result.cleanCaptures} clean — pre-bonded)` : ''}.</p>`
            : ''
        }
        ${
          state.result.dupesFused > 0
            ? `<p>Fused ${state.result.dupesFused} duplicate ${state.result.dupesFused === 1 ? 'capture' : 'captures'} into deeper bonds (+${state.result.dupeLore} Lore).</p>`
            : ''
        }
        ${renderRoster(state.roster)}
        <button data-action="replay">Return to town</button>
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
        <p class="guidance">${captureGuidance(state)}</p>
        <div class="stats">
          ${state.omen ? `<p class="omen">Omen: <strong>${state.omen.name}</strong> — ${state.omen.desc}</p>` : ''}
          <p>Layer ${state.currentEncounter.depth} (the deeper you go, the harder it presses)</p>
          <p>Turn: ${state.currentEncounter.turn}</p>
          <p>Target HP: ${target.health}/${target.maxHealth}</p>
          <p>Posture: ${target.posture}</p>
          <p>The quarry seems ${tensionLabel(state.currentEncounter.pressure)}${
            state.currentEncounter.escapeProgress > 0 ? '; wrong reads are spooking it' : ''
          }.</p>
          <p>Carryover Risk: ${state.currentEncounter.riskLevel}</p>
          <p>Advance: ${advanceAllowed ? 'Ready' : 'Locked'}</p>
        </div>
        <div class="actions">
          <button data-action="strike" ${renderDisabled(encounterResolved)}>Strike</button>
          <button data-action="guard" ${renderDisabled(encounterResolved)}>Guard</button>
          <button data-action="probe-ash" ${renderDisabled(encounterResolved)}>Probe Ash</button>
          <button data-action="probe-iron" ${renderDisabled(encounterResolved)}>Probe Iron</button>
          <button data-action="probe-storm" ${renderDisabled(encounterResolved)}>Probe Storm</button>
          <button data-action="probe-veil" ${renderDisabled(encounterResolved)}>Probe Veil</button>
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
          ${
            state.party.beasts['grave-hound']
              ? `
          <button data-action="hound-scent-read" ${renderDisabled(encounterResolved)}>Grave Hound: Scent Read</button>
          <button data-action="hound-harry" ${renderDisabled(encounterResolved)}>Grave Hound: Harry</button>
          <button data-action="hound-warning-bark" ${renderDisabled(encounterResolved)}>Grave Hound: Warning Bark</button>`
              : ''
          }
          ${
            state.party.beasts['mireback-tortoise']
              ? `
          <button data-action="mireback-brace" ${renderDisabled(encounterResolved)}>Mireback: Brace</button>
          <button data-action="mireback-shove" ${renderDisabled(encounterResolved)}>Mireback: Shove</button>
          <button data-action="mireback-burden-shelter" ${renderDisabled(encounterResolved)}>Mireback: Burden Shelter</button>`
              : ''
          }
          ${Object.keys(state.party.beasts)
            .filter((id) => CAPTURED_ALLY[id])
            .map(
              (id) =>
                `<button data-action="companion:${id}:${CAPTURED_ALLY[id].action}" ${renderDisabled(encounterResolved)}>${state.party.beasts[id].name}: ${CAPTURED_ALLY[id].label}</button>`
            )
            .join('')}
          <button data-action="capture" ${renderDisabled(encounterResolved || captureDisabled)}>Capture</button>
          <button data-action="withdraw" ${renderDisabled(encounterResolved)}>Withdraw</button>
          <button data-action="anchor" ${renderDisabled(!advanceAllowed || state.currentEncounter.anchored)}>Anchor (recover)</button>
          <button data-action="advance" ${renderDisabled(!advanceAllowed)}>Descend deeper</button>
          <button data-action="extract" ${renderDisabled(!advanceAllowed)}>Extract (keep haul)</button>
        </div>
      </section>
      <aside class="panel">
        <h3>Expedition</h3>
        <p>Leader HP: ${state.party.leader.health}/${state.party.leader.maxHealth}</p>
        ${Object.values(state.party.beasts)
          .map((beast) => `<p>${beast.name} fatigue: ${beast.fatigue}</p>`)
          .join('')}
        <p>Captures: ${renderCaptureNames(state.party.captures)}</p>
        <h3>Tool Counts</h3>
        <ul class="summary-list">${renderToolCounts(state.party.tools)}</ul>
        <h3>Placed Structures</h3>
        <ul class="summary-list">${renderStructures(state.currentEncounter.structures)}</ul>
        <h3>Learned Clues</h3>
        <ul class="summary-list">${renderHints(currentHints)}</ul>
        <h3>Codex (this run)</h3>
        ${renderClueSummary(state.codexHints)}
        <h3>Log</h3>
        <div class="log">${state.log.map((line) => `<div>${line}</div>`).join('')}</div>
      </aside>
    </div>
  `;
}

function renderDisabled(disabled) {
  return disabled ? 'disabled' : '';
}

// Coach toggle (cme.3): on = step-by-step guidance (teaches); off = oblique
// "tracker" that reflects only what you've learned, so reading is a skill.
function renderCoachToggle(state) {
  const off = state.coach === false;
  return `
    <h3>Reading style</h3>
    <p>Coach: ${off ? 'off — oblique tracker (reads are yours to make)' : 'on — step-by-step guidance'}</p>
    <button data-action="toggle-coach">${off ? 'Enable coach' : 'Switch to tracker (oblique)'}</button>
  `;
}

function renderTownUpgrades(state) {
  return Object.entries(UPGRADES)
    .map(([key, def]) => {
      const level = state.upgrades[key] ?? 0;
      const cost = upgradeCost(key, level);
      const affordable = state.lore >= cost;
      return `
        <p>${def.name} — level ${level} (${def.describe})</p>
        <button data-action="buy-${key}" ${affordable ? '' : 'disabled'}>Upgrade ${def.name} (${cost} lore)</button>
      `;
    })
    .join('');
}

function renderPartyPicker(fielded, roster, bonds = {}) {
  const ids = ['grave-hound', 'mireback-tortoise', ...new Set(roster ?? [])];
  return ids
    .map((id) => {
      const name = PLAYER_BEASTS[id]?.name ?? TARGET_BEASTS[id]?.name ?? id;
      const fieldedNow = fielded.includes(id);
      const ally = CAPTURED_ALLY[id];
      const bond = ally && (bonds[id] ?? 0) > 0 ? ` (bond ${bonds[id]})` : '';
      const power = ally ? ` — <em>${ally.passiveName}</em>: ${ally.passiveDesc}` : '';
      return `<div><button data-action="toggle-${id}">${name}${bond}: ${fieldedNow ? 'fielded' : 'benched'}</button>${power}</div>`;
    })
    .join('');
}

function renderRoster(roster) {
  if (!roster || roster.length === 0) {
    return '<p>Roster: empty — capture beasts to grow it.</p>';
  }
  const names = roster.map((id) => TARGET_BEASTS[id]?.name ?? id).join(', ');
  return `<p>Roster (${roster.length}): ${names}</p>`;
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

// Contextual coaching so a first-time player can find the capture path (F1).
function triggerHint(def) {
  switch (def.bindKind) {
    case 'corner':
      return 'corner it (Harry, or a captured Ashwing)';
    case 'stagger':
      return 'stagger it (Shove, or a captured Chain Maw)';
    case 'reveal':
      return 'reveal it (Scent Read, or a captured Veil Lynx)';
    case 'ground':
      return 'ground it (Bait Stake, or a captured Storm Antler)';
    default:
      return 'set its posture';
  }
}

// Oblique tracker mode (cme.3): reflect only what's been learned, never the
// prescribed next action, so reading the quarry stays a real skill.
function obliqueGuidance(state, target) {
  if (target.captureState === 'bindable') {
    return 'The opening is there — if you can see it.';
  }
  const learned = state.codexHints[target.id] ?? [];
  if (learned.includes(target.primaryAttunement)) {
    return `You've learned it answers to ${formatLabel(target.primaryAttunement)}. Drive it from there.`;
  }
  return 'Read the quarry yourself — watch what it reacts to and how it holds itself.';
}

function captureGuidance(state) {
  const enc = state.currentEncounter;
  const target = enc.target;
  const def = TARGET_BEASTS[target.id];

  if (state.coach === false) {
    return obliqueGuidance(state, target);
  }

  if (target.captureState === 'bindable') {
    return 'Window open — Capture now before it closes.';
  }
  if (def.concealed && target.posture !== def.bindPosture) {
    return `${target.name} masks its true nature. Use Grave Hound: Scent Read to reveal it.`;
  }
  if (!enc.flags.attunementMatch) {
    const revealed = (state.codexHints[target.id] ?? []).includes(target.primaryAttunement);
    if (revealed) {
      return `It responds to ${target.primaryAttunement} — probe ${formatLabel(target.primaryAttunement)} to lock it in.`;
    }
    return `Learn what ${target.name} responds to — probe attunements or use Grave Hound: Scent Read.`;
  }
  return `It responds to ${target.primaryAttunement}. Now ${triggerHint(def)} to make it ${def.bindPosture}.`;
}

