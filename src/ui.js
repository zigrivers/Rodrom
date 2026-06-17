import { PLAYER_BEASTS, TARGET_BEASTS, TOOLS, CAPTURED_ALLY, BUILD_CATALOG } from './content.js';
import { canAdvanceEncounter, tensionLabel, circuitComplete } from './engine.js';
import { upgradeCost, UPGRADES, fieldCap, bestiaryComplete, BESTIARY_SPECIES } from './state.js';
import { COURT_OF, COURT_LABEL } from './courts.js';

export function renderApp(state) {
  if (!state.started) {
    return `
      <section class="panel">
        <h1>Spiral Descent</h1>
        <p>Descend the spiral one layer at a time. Read each beast and bind it to grow your
        roster — then choose how deep to push before you extract. Between runs, your town
        spends the Lore you earn and your captured allies deepen their bonds.</p>
        ${renderRoster(state.roster)}
        <h3>Bestiary</h3>
        ${renderBestiary(state.bestiary)}
        <h3>Town</h3>
        <p>Lore: ${state.lore}</p>
        ${renderTownUpgrades(state)}
        <h3>Party — who do you field?</h3>
        <p>Each beast brings different actions, so your party decides which captures are even possible.</p>
        ${renderPartyPicker(state.fielded, state.roster, state.bonds, fieldCap(state.upgrades, state.bestiary))}
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
        ${
          state.result.forfeited > 0
            ? `<p class="at-risk">The leader fell — ${state.result.forfeited} unsecured capture${state.result.forfeited === 1 ? '' : 's'} lost to the deep. Only your anchored haul was saved.</p>`
            : ''
        }
        ${
          state.result.deepFailure
            ? `<p class="at-risk">Falling at layer ${state.result.failDepth} left your fielded beasts wounded — each lost ${state.result.bondPenalty} bond. (Shallow falls spare them.)</p>`
            : ''
        }
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
  // The anchor/regroup opportunity unlocks only when the layer's circuit is complete (t9i.4).
  const layerComplete = circuitComplete(state);
  const layerNodes = state.run.layers[state.layerIndex];
  const quarriesInLayer = layerNodes.filter((n) => n.kind === 'quarry').length;
  const quarryPos = layerNodes.slice(0, state.nodeIndex + 1).filter((n) => n.kind === 'quarry').length;
  const pressLevel = state.currentEncounter.pressLevel ?? 0;

  return `
    <div class="layout">
      <section class="panel">
        <h1>Spiral Descent</h1>
        <h2>${target.name}${target.elite ? ' <span class="elite-badge">ELITE</span>' : ''}</h2>
        <p class="guidance">${captureGuidance(state)}</p>
        <div class="stats">
          ${state.omen ? `<p class="omen">Omen: <strong>${state.omen.name}</strong> — ${state.omen.desc}</p>` : ''}
          <p>Layer ${state.currentEncounter.depth} (the deeper you go, the harder it presses)</p>
          ${quarriesInLayer > 1 ? `<p>Circuit: quarry ${quarryPos} of ${quarriesInLayer}${layerComplete ? ' — circuit clear, regroup or descend' : ''}</p>` : ''}
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
          <div class="action-group">
            <h4>Reads</h4>
            <button data-action="probe-heat" ${renderDisabled(encounterResolved)}>Probe Heat</button>
            <button data-action="probe-mass" ${renderDisabled(encounterResolved)}>Probe Mass</button>
            <button data-action="probe-sky" ${renderDisabled(encounterResolved)}>Probe Sky</button>
            <button data-action="probe-absence" ${renderDisabled(encounterResolved)}>Probe Absence</button>
          </div>
          <div class="action-group">
            <h4>Force &amp; Defense</h4>
            <button data-action="strike" ${renderDisabled(encounterResolved)}>Strike</button>
            <button data-action="guard" ${renderDisabled(encounterResolved)}>Guard</button>
          </div>
          <div class="action-group">
            <h4>Tools</h4>
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
          </div>
          <div class="action-group">
            <h4>Allies</h4>
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
          </div>
          <div class="action-group">
            <h4>Resolve</h4>
            <button data-action="capture" ${renderDisabled(encounterResolved || captureDisabled)}>Bind now${pressLevel > 0 ? ` (pressed ×${pressLevel})` : ''}</button>
            <button data-action="press" ${renderDisabled(encounterResolved || captureDisabled)}>Press (risk for more)</button>
            <button data-action="withdraw" ${renderDisabled(encounterResolved)}>Withdraw</button>
          </div>
          <div class="action-group">
            <h4>Between layers</h4>
            <button data-action="anchor-recover" ${renderDisabled(!layerComplete || state.currentEncounter.anchored)}>Anchor: Recover (heal)</button>
            <button data-action="anchor-secure" ${renderDisabled(!layerComplete || state.currentEncounter.anchored || (state.securedCount ?? 0) >= state.party.captures.length)}>Anchor: Secure (bank haul)</button>
            <button data-action="advance" ${renderDisabled(!advanceAllowed)}>Descend deeper</button>
            <button data-action="extract" ${renderDisabled(!advanceAllowed)}>Extract (keep haul)</button>
          </div>
          <div class="action-group">
            <h4>Build (anchor)</h4>
            ${Object.values(BUILD_CATALOG)
              .map((b) => {
                const built = (state.builds ?? []).includes(b.id);
                const disabled = !layerComplete || built || (state.lore ?? 0) < b.cost;
                return `<button data-action="build-${b.id}" ${renderDisabled(disabled)}>${
                  built ? `${b.name} ✓` : `${b.name} (${b.cost} Lore) — ${b.effect}`
                }</button>`;
              })
              .join('')}
          </div>
        </div>
      </section>
      <aside class="panel">
        <h3>Expedition</h3>
        <p>Leader HP: ${state.party.leader.health}/${state.party.leader.maxHealth}</p>
        ${Object.values(state.party.beasts)
          .map((beast) => `<p>${beast.name} fatigue: ${beast.fatigue}</p>`)
          .join('')}
        <p>Captures: ${renderCaptureNames(state.party.captures)}</p>
        ${renderHaulRisk(state)}
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

// Checkpoint stakes (G1): show how much of the haul would be lost on a death,
// so the Anchor/Extract decision carries real weight.
function renderHaulRisk(state) {
  const atRisk = state.party.captures.length - (state.securedCount ?? 0);
  if (atRisk <= 0) {
    return state.party.captures.length > 0 ? '<p>Haul: all secured.</p>' : '';
  }
  return `<p class="at-risk">Haul at risk: ${atRisk} unsecured capture${atRisk === 1 ? '' : 's'} — Secure or Extract to keep ${atRisk === 1 ? 'it' : 'them'}.</p>`;
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

function renderPartyPicker(fielded, roster, bonds = {}, cap = 4) {
  const ids = ['grave-hound', 'mireback-tortoise', ...new Set(roster ?? [])];
  const full = fielded.length >= cap;
  const header = `<p>Party: ${fielded.length}/${cap} fielded${full ? ' — full (bench one to swap)' : ''}</p>`;
  const rows = ids
    .map((id) => {
      const name = PLAYER_BEASTS[id]?.name ?? TARGET_BEASTS[id]?.name ?? id;
      const fieldedNow = fielded.includes(id);
      const ally = CAPTURED_ALLY[id];
      const bond = ally && (bonds[id] ?? 0) > 0 ? ` (bond ${bonds[id]})` : '';
      const power = ally ? ` — <em>${ally.passiveName}</em>: ${ally.passiveDesc}` : '';
      // At the cap, benched beasts can't be fielded until you bench another.
      const blocked = full && !fieldedNow;
      return `<div><button data-action="toggle-${id}" ${renderDisabled(blocked)}>${name}${bond}: ${fieldedNow ? 'fielded' : 'benched'}</button>${power}</div>`;
    })
    .join('');
  return `${header}${rows}`;
}

function renderBestiary(bestiary) {
  const b = bestiary ?? {};
  const ids = BESTIARY_SPECIES;
  const maxStars = ids.length * 3; // bronze + silver + gold per species
  let earned = 0;
  const rows = ids
    .map((id) => {
      const t = b[id] ?? { bronze: false, silver: false, gold: false };
      const cells = [t.bronze, t.silver, t.gold];
      earned += cells.filter(Boolean).length;
      const rank = cells.map((s) => (s ? '★' : '☆')).join('');
      const name = TARGET_BEASTS[id]?.name ?? id;
      const blurb = TARGET_BEASTS[id]?.blurb ?? '';
      return `<div><strong>${name}</strong> ${rank} — <em>${blurb}</em><br><small>Bronze ${t.bronze ? '✓' : '·'} caught · Silver ${t.silver ? '✓' : '·'} clean · Gold ${t.gold ? '✓' : '·'} Dire</small></div>`;
    })
    .join('');
  const badge = bestiaryComplete(b) ? ' — <strong>Master Tamer</strong>' : '';
  return `<p>Bestiary: ${earned}/${maxStars} ★${badge}</p>${rows}`;
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

function courtLabelFor(attunement) {
  return COURT_LABEL[COURT_OF[attunement]] ?? attunement;
}

// Oblique tracker mode (cme.3): reflect only what's been learned, never the
// prescribed next action, so reading the quarry stays a real skill.
function obliqueGuidance(state, target) {
  if (target.captureState === 'bindable') {
    return 'The opening is there — if you can see it.';
  }
  if (target.altBind) {
    return 'A Dire quarry — it answers two ways. Find them.';
  }
  if (target.secondaryAttunement) {
    // Forward telegraph (my-mordor-4ei): warn that two courts must be read before the bind
    // locks, so a coach-off player isn't blindsided mid-frenzy by a half-read dual.
    return 'Two natures stir in this one — a sharp lead over a faint twin. Read both.';
  }
  const learned = state.codexHints[target.id] ?? [];
  if (learned.length) {
    return `You've felt which court answers. Drive it from there.`;
  }
  return 'Read the quarry yourself — watch which court it answers to, sharply or faintly.';
}

function captureGuidance(state) {
  const enc = state.currentEncounter;
  const target = enc.target;
  const def = TARGET_BEASTS[target.id];

  if (state.coach === false) {
    return obliqueGuidance(state, target);
  }

  if (target.captureState === 'bindable') {
    return 'Window open — Bind now before it closes.';
  }
  if (target.altBind) {
    const bold = `${formatLabel(target.primaryAttunement)}→${def.bindPosture}`;
    const patient = `${formatLabel(target.altBind.attunement)}→${target.altBind.bindPosture}`;
    return `A Dire quarry — two ways in: ${bold} (bold: agitates it, richer) or ${patient} (patient: calm). Read which your party can do.`;
  }
  if (def.concealed && target.posture !== def.bindPosture) {
    return `${target.name} masks its true nature. Use Grave Hound: Scent Read to reveal it.`;
  }
  if (!enc.flags.attunementMatch || (target.secondaryAttunement && !enc.flags.secondaryAttunementMatch)) {
    const courts = [courtLabelFor(target.primaryAttunement)];
    if (target.secondaryAttunement) courts.push(courtLabelFor(target.secondaryAttunement));
    return `Read its ${courts.length > 1 ? 'courts' : 'court'} — probe ${courts.join(' and ')}${
      target.secondaryAttunement
        ? ' (it answers two ways — read both). A sharp reaction is the lead; a faint one is its twin.'
        : '.'
    }`;
  }
  return `Read in. Now ${triggerHint(def)} to make it ${def.bindPosture}.`;
}

