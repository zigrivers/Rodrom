import { createTargetState, seedEncounterKnowledge, effectiveBond } from './state.js';
import { TARGET_BEASTS, COMPANION_ACTION_KIND, TOOL_ACTION_KIND, CAPTURED_ALLY, BUILD_CATALOG } from './content.js';
import { COURT_OF, COURT_LABEL, toCourt, reactionStrength } from './courts.js';

// Consequence tuning (F4/F7/F11). Kept as named constants for easy balancing.
const ESCAPE_READS = 3; // wrong-attunement probes before the beast flees
const FRENZY_PRESSURE = 6; // pressure at which an undefended turn wounds the leader
const FRENZY_LEADER_DAMAGE = 1;
const WINDOW_GRACE = 3; // open-window turns before a bindable beast slips loose

// Capture scoring (cme.3): a capture with no wrong reads is "clean"; a capture
// bound within FAST_CAPTURE_TURNS is "fast". Each earns bonus Lore, and a clean
// capture of a new species seeds its bond so reading well makes you stronger.
const CLEAN_CAPTURE_LORE = 2;
const FAST_CAPTURE_LORE = 1;
const FAST_CAPTURE_TURNS = 4;
// Duplicate-capture payoff (cme.7): re-capturing an owned species fuses into a
// deeper bond and converts the surplus to this much Lore instead of a dead dupe.
const DUPE_CONVERT_LORE = 2;
// Elite "Dire" quarries (G3c) are worth this much bonus Lore on capture.
const ELITE_LORE = 4;
const FAILURE_DEPTH_THRESHOLD = 4; // failures at this depth or deeper also wound your beasts (ua7)
// Press-your-luck (greed): each press level banked on a capture is worth this
// much bonus Lore; a catch pressed to level 2+ also deepens that species' bond.
const PRESS_LORE = 2;
// A "bold" capture of a dual-path elite (adaptive-read) — the daring, agitating
// route — is worth this much bonus Lore and deepens that species' bond.
const BOLD_CAPTURE_LORE = 2;

// Bestiary bounties (collection goal): one-time Lore the first time each tier is
// earned. Kept one-time so the collection goal doesn't inflate the run economy.
const BESTIARY_BRONZE_LORE = 5;
const BESTIARY_SILVER_LORE = 10;
const BESTIARY_GOLD_LORE = 20;

// Deeper layers press harder: per-turn pressure rises with descent depth, so
// frenzy and failure scale with depth (run structure, t9i.3).
export function pressurePerTurn(depth) {
  return 1 + Math.floor(((depth ?? 1) - 1) / 2);
}

// Depth ambush (cme.5): deeper layers begin already under pressure, so the
// frenzy clock is ticking from the first breath and a quick, clean capture
// (or active defense / an Anchor) is the only safe line at depth.
export function startingPressure(depth) {
  return Math.floor(((depth ?? 1) - 1) / 2);
}

function appendLog(state, line) {
  return { ...state, log: [...state.log, line] };
}

// Finish a run: record the result and bank this run's captures into the
// campaign roster so captured beasts persist across runs.
function completeExpedition(state, rank) {
  const originalBonds = state.bonds ?? {};
  const bonds = { ...originalBonds };

  // Checkpoint stakes (G1): a successful extract secures the whole haul; dying
  // (expedition-failure) only banks what was secured by the last Anchor — the
  // rest of the run's captures (and their Lore) are forfeit.
  const failed = rank === 'expedition-failure';
  const totalCaptures = state.party.captures.length;
  const bankedCount = failed ? Math.min(state.securedCount ?? 0, totalCaptures) : totalCaptures;
  const bankedCaptures = state.party.captures.slice(0, bankedCount);
  const bankedGrades = (state.captureLog ?? []).slice(0, bankedCount);
  const forfeited = totalCaptures - bankedCount;

  // Failure model (ua7): consequences scale with the depth at which the leader fell. Shallow
  // failures stay gentle (you only lose the unsecured haul), so early experimentation is safe
  // (ua7.2). A DEEP failure also wounds the fielded beasts — a persistent bond setback that grows
  // the further you pushed (ua7.1). (Richer deep consequences — survivors, corruption, town
  // sabotage — wait on their systems: 6mi / b1l / vbf.)
  const failDepth = state.currentEncounter?.depth ?? 1;
  const deepFailure = failed && failDepth >= FAILURE_DEPTH_THRESHOLD;
  const bondPenalty = deepFailure ? Math.floor(failDepth / FAILURE_DEPTH_THRESHOLD) : 0;

  // 1. Fielded captured allies: surviving the run deepens their bond (+1); a deep failure instead
  //    returns them wounded, costing bond scaled by depth (floored at 0).
  for (const id of state.fielded) {
    if (CAPTURED_ALLY[id]) {
      bonds[id] = deepFailure
        ? Math.max(0, (bonds[id] ?? 0) - bondPenalty)
        : (bonds[id] ?? 0) + 1;
    }
  }

  // Which species were captured cleanly (for the cme.3 pre-bond on new species).
  const capturedClean = {};
  for (const grade of bankedGrades) {
    capturedClean[grade.id] = capturedClean[grade.id] || grade.clean;
  }

  // 2. Bank captures: a new species joins the roster (a clean one arrives
  // pre-bonded, cme.3); a species you already own fuses into a deeper bond and
  // converts the surplus to Lore instead of a dead duplicate entry (cme.7).
  const roster = [...state.roster];
  const owned = new Set(state.roster);
  let dupesFused = 0;
  for (const id of bankedCaptures) {
    if (owned.has(id)) {
      bonds[id] = (bonds[id] ?? 0) + 1; // fuse
      dupesFused += 1;
    } else {
      roster.push(id);
      owned.add(id);
      if (capturedClean[id] && originalBonds[id] === undefined) {
        bonds[id] = (bonds[id] ?? 0) + 1; // clean-capture pre-bond (cme.3)
      }
    }
  }

  // 3. Lore: base (banked captures + depth) + capture-quality bonus (cme.3) +
  // omen (cme.6) + duplicate conversion (cme.7). Forfeited captures earn nothing.
  let bonusLore = 0;
  for (const grade of bankedGrades) {
    if (grade.clean) bonusLore += CLEAN_CAPTURE_LORE;
    if (grade.fast) bonusLore += FAST_CAPTURE_LORE;
  }
  // Press-your-luck payoff (greed): bonus Lore per press level, and a perfect
  // catch (press level >= 2) deepens that species' bond.
  let pressLore = 0;
  for (let i = 0; i < bankedGrades.length; i += 1) {
    const level = bankedGrades[i].pressLevel ?? 0;
    pressLore += level * PRESS_LORE;
    if (level >= 2) {
      const id = bankedCaptures[i];
      bonds[id] = (bonds[id] ?? 0) + 1;
    }
  }
  // Bold-route capture of a dual-path elite (adaptive-read): a daring catch pays
  // bonus Lore and deepens the bond.
  let boldLore = 0;
  for (let i = 0; i < bankedGrades.length; i += 1) {
    if (bankedGrades[i].route === 'bold') {
      boldLore += BOLD_CAPTURE_LORE;
      const id = bankedCaptures[i];
      bonds[id] = (bonds[id] ?? 0) + 1;
    }
  }
  // Bestiary (collection goal): record tier milestones from banked captures and
  // pay a one-time Lore bounty for each tier newly earned this run.
  const bestiary = { ...(state.bestiary ?? {}) };
  let bestiaryBounty = 0;
  for (let i = 0; i < bankedCaptures.length; i += 1) {
    const id = bankedCaptures[i];
    const grade = bankedGrades[i];
    const before = bestiary[id] ?? { bronze: false, silver: false, gold: false };
    const after = {
      bronze: true, // any banked capture earns Bronze
      silver: before.silver || grade.clean === true,
      gold: before.gold || grade.elite === true,
    };
    if (!before.bronze && after.bronze) bestiaryBounty += BESTIARY_BRONZE_LORE;
    if (!before.silver && after.silver) bestiaryBounty += BESTIARY_SILVER_LORE;
    if (!before.gold && after.gold) bestiaryBounty += BESTIARY_GOLD_LORE;
    bestiary[id] = after;
  }
  const captures = bankedCaptures.length;
  const cleanCaptures = bankedGrades.filter((grade) => grade.clean).length;
  const eliteCaptures = bankedGrades.filter((grade) => grade.elite).length;
  const omenLore = (state.omen?.lorePerCapture ?? 0) * captures;
  const dupeLore = dupesFused * DUPE_CONVERT_LORE;
  const eliteLore = eliteCaptures * ELITE_LORE;
  const loreEarned = captures * 3 + state.currentEncounter.depth + bonusLore + omenLore + dupeLore + eliteLore + pressLore + boldLore + bestiaryBounty;
  return {
    ...state,
    expeditionComplete: true,
    result: { rank, captures, loreEarned, bonusLore, cleanCaptures, dupesFused, dupeLore, eliteCaptures, pressLore, boldLore, bestiaryBounty, forfeited, failDepth, deepFailure, bondPenalty },
    roster,
    bonds,
    bestiary,
    lore: (state.lore ?? 0) + loreEarned,
  };
}

// Deterministically spend one use of the most-stocked tool (supply loss, F4).
function loseSupply(tools) {
  let pick = null;
  for (const [id, count] of Object.entries(tools)) {
    if (count > 0 && (pick === null || count > tools[pick])) {
      pick = id;
    }
  }
  if (pick === null) {
    return { tools, lost: null };
  }
  return { tools: { ...tools, [pick]: tools[pick] - 1 }, lost: pick };
}

function beastDef(target) {
  return TARGET_BEASTS[target.id];
}

// Active passives from fielded captured allies (cme.2), keyed to effective bond level
// (raw bond + the collection-goal completion perk; see state.effectiveBond).
function activePassives(state) {
  const map = {};
  for (const id of Object.keys(state.party.beasts)) {
    const passive = CAPTURED_ALLY[id]?.passive;
    if (passive) {
      map[passive] = effectiveBond(state, id);
    }
  }
  return map;
}

function addHint(codexHints, targetId, attunement) {
  return {
    ...codexHints,
    [targetId]: [...new Set([...(codexHints[targetId] ?? []), attunement])],
  };
}

function isTerminalCaptureState(value) {
  return (
    value === 'defeated' || value === 'captured' || value === 'escaped' || value === 'withdrawn'
  );
}

function isTargetActive(target) {
  return !isTerminalCaptureState(target.captureState);
}

// Qualitative read of how close pressure is to a frenzy, for inferable cues (F8).
export function tensionLabel(pressure) {
  if (pressure >= FRENZY_PRESSURE) {
    return 'frenzied';
  }
  if (pressure >= FRENZY_PRESSURE - 2) {
    return 'agitated';
  }
  if (pressure > 0) {
    return 'restless';
  }
  return 'calm';
}

export function canAdvanceEncounter(state) {
  return isTerminalCaptureState(state.currentEncounter.target.captureState);
}

// The current layer's circuit is complete once its last quarry is resolved — i.e. no quarry remains
// after the active node in this layer. The anchor/regroup opportunity gates on this (t9i.4). For a
// single-node layer this is just "the encounter resolved", preserving pre-circuit anchor timing.
export function circuitComplete(state) {
  if (!canAdvanceEncounter(state)) return false;
  const layer = state.run.layers[state.layerIndex];
  return !layer.slice(state.nodeIndex + 1).some((n) => n.kind === 'quarry');
}

// Walk the run cursor forward to the next quarry, wrapping layers for the endless descent and
// collecting any salvage caches crossed on the way down (t9i.2). Returns the new cursor + the lore.
function advanceToNextQuarry(run, layerIndex, nodeIndex) {
  const { layers } = run;
  const totalNodes = layers.reduce((sum, l) => sum + l.length, 0);
  let li = layerIndex;
  let ni = nodeIndex;
  let salvageLore = 0;
  for (let step = 0; step < totalNodes; step += 1) {
    ni += 1;
    if (ni >= layers[li].length) {
      li = (li + 1) % layers.length;
      ni = 0;
    }
    const node = layers[li][ni];
    if (node.kind === 'salvage') salvageLore += node.lore ?? 0;
    else if (node.kind === 'quarry') return { layerIndex: li, nodeIndex: ni, salvageLore };
  }
  return { layerIndex: li, nodeIndex: ni, salvageLore };
}

function isResolvedEncounter(state) {
  return canAdvanceEncounter(state);
}

// A concealed beast reads deceptively until its trigger drives it to bindPosture.
function isConcealedNow(target) {
  const def = beastDef(target);
  return Boolean(def.concealed) && target.posture !== def.bindPosture;
}

// Returns { matchedPrimary, matchedSecondary, altMatched, reacts, strength }. A court-probe matches
// whichever of the beast's attunements lies in that court. `strength` is 'strong' for a court lead,
// 'faint' for its twin (the confusion-pair signal). A concealed beast reads as its twin (faint) only.
function evaluateProbe(target, court) {
  const def = beastDef(target);
  if (isConcealedNow(target)) {
    const reacts = court === COURT_OF[def.falseLead];
    return { matchedPrimary: false, matchedSecondary: false, altMatched: false, reacts, strength: reacts ? 'faint' : null };
  }
  const matchedPrimary = court != null && court === COURT_OF[target.primaryAttunement];
  const matchedSecondary =
    target.secondaryAttunement != null && court != null && court === COURT_OF[target.secondaryAttunement];
  const altMatched = Boolean(target.altBind) && court != null && court === COURT_OF[target.altBind.attunement];
  let strength = null;
  if (matchedPrimary) strength = reactionStrength(target.primaryAttunement);
  else if (matchedSecondary) strength = reactionStrength(target.secondaryAttunement);
  else if (altMatched) strength = reactionStrength(target.altBind.attunement);
  return { matchedPrimary, matchedSecondary, altMatched, reacts: matchedPrimary || matchedSecondary || altMatched, strength };
}

// Which bind route an action of `kind` serves on this target, honoring the
// active alt route on dual-path elites (adaptive-read). Returns the posture to
// drive and whether it's the 'bold' (primary) or 'patient' (alt) route, or null.
function routeForKind(target, kind) {
  if (kind == null) {
    return null;
  }
  const def = beastDef(target);
  if (kind === def.bindKind) {
    return { posture: def.bindPosture, route: 'bold' };
  }
  if (target.altBind && kind === target.altBind.bindKind) {
    return { posture: target.altBind.bindPosture, route: 'patient' };
  }
  return null;
}

// Capture state is derived from the two requirements, never set imperatively
// (except terminal states), so a reached window can't be silently downgraded.
function deriveCaptureState(target, flags) {
  if (isTerminalCaptureState(target.captureState)) {
    return target.captureState;
  }
  const def = beastDef(target);
  const dualSatisfied = target.secondaryAttunement == null || flags.secondaryAttunementMatch;
  const boldReady = flags.attunementMatch && dualSatisfied && target.posture === def.bindPosture;
  // The patient (altBind) route is independent of the dual-typing gate. No spawnable beast is both
  // dual-typed AND altBind, so this can't currently bypass a compound read; revisit if one is authored.
  const patientReady =
    Boolean(target.altBind) && flags.altAttunementMatch && target.posture === target.altBind.bindPosture;
  if (boldReady || patientReady) {
    return 'bindable';
  }
  const anyAttunement = flags.attunementMatch || flags.secondaryAttunementMatch || flags.altAttunementMatch;
  const anyPosture =
    target.posture === def.bindPosture || (target.altBind && target.posture === target.altBind.bindPosture);
  if (anyAttunement || anyPosture) {
    return 'probed';
  }
  return 'unreadable';
}

function consumeDefenseFlags(flags) {
  // Note: `agitated` (bold-route, adaptive-read) is a standing condition for the
  // rest of the encounter — intentionally NOT consumed here, unlike guard/brace.
  return {
    ...flags,
    guardRaised: false,
    braceRaised: false,
  };
}

function resolveEncounterPressure(state) {
  const enc = state.currentEncounter;
  const target = enc.target;

  if (!isTargetActive(target)) {
    return state;
  }

  const flags = enc.flags;
  const defended = flags.guardRaised || flags.braceRaised;

  let next = {
    ...state,
    currentEncounter: { ...enc, flags: consumeDefenseFlags(flags) },
  };

  if (defended) {
    next = appendLog(
      next,
      flags.guardRaised
        ? 'Guard holds and keeps the pressure off the expedition.'
        : 'Mireback Brace absorbs the counter-pressure.'
    );
  } else {
    // Grounding Aura (cme.2) scales its relief with bond depth (G2).
    const groundingBond = activePassives(state)['grounding-aura'];
    const grounding = groundingBond === undefined ? 0 : 1 + Math.floor(groundingBond / 2);
    // The bold route on a dual-path elite leaves the quarry agitated (adaptive-read).
    const agitation = flags.agitated ? 1 : 0;
    const newPressure = enc.pressure + Math.max(0, pressurePerTurn(enc.depth) + agitation - grounding);
    next = { ...next, currentEncounter: { ...next.currentEncounter, pressure: newPressure } };

    if (newPressure >= FRENZY_PRESSURE) {
      const woundedLeader = {
        ...next.party.leader,
        health: Math.max(0, next.party.leader.health - FRENZY_LEADER_DAMAGE),
      };
      const { tools, lost } = loseSupply(next.party.tools);
      next = { ...next, party: { ...next.party, leader: woundedLeader, tools } };
      next = appendLog(
        next,
        `${target.name} frenzies! The leader is wounded${lost ? ` and a ${lost} is lost` : ''}.`
      );

      if (woundedLeader.health <= 0) {
        return appendLog(
          completeExpedition(next, 'expedition-failure'),
          'The leader falls. The expedition fails.'
        );
      }
    } else {
      next = appendLog(next, `${target.name} presses back on the expedition.`);
    }
  }

  return decayCaptureWindow(next);
}

// A reached capture window does not last forever: stalling while bindable lets
// the beast slip loose (greed, F4). The collapse is telegraphed, never silent.
function decayCaptureWindow(state) {
  const enc = state.currentEncounter;
  const target = enc.target;
  if (target.captureState !== 'bindable' || enc.flags.snared || 'iron-hold' in activePassives(state)) {
    return state;
  }

  const decay = (enc.windowDecay ?? 0) + 1;
  if (decay >= WINDOW_GRACE) {
    const def = beastDef(target);
    const relaxed = { ...target, posture: def.initialPosture };
    relaxed.captureState = deriveCaptureState(relaxed, enc.flags);
    return appendLog(
      { ...state, currentEncounter: { ...enc, target: relaxed, windowDecay: 0, pressLevel: 0 } },
      `${target.name} slips loose — the capture window closes.`
    );
  }

  const withDecay = { ...state, currentEncounter: { ...enc, windowDecay: decay } };
  if (decay === WINDOW_GRACE - 1) {
    return appendLog(withDecay, `${target.name} strains against the hold — the window is closing. Bind now!`);
  }
  return withDecay;
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

export function applyHeroProbe(state, probe) {
  if (isResolvedEncounter(state)) {
    return state;
  }

  const enc = state.currentEncounter;
  const target = enc.target;
  const court = toCourt(probe);
  const { matchedPrimary, matchedSecondary, altMatched, reacts, strength } = evaluateProbe(target, court);
  const read = matchedPrimary || matchedSecondary || altMatched;

  const flags = {
    ...enc.flags,
    attunementMatch: enc.flags.attunementMatch || matchedPrimary,
    secondaryAttunementMatch: enc.flags.secondaryAttunementMatch || matchedSecondary,
    altAttunementMatch: enc.flags.altAttunementMatch || altMatched,
  };
  const passives = activePassives(state);
  const escapeTolerance =
    ESCAPE_READS +
    ('skittish-kin' in passives ? 1 + passives['skittish-kin'] : 0) +
    (state.builds?.includes('watch-totem') ? 1 : 0); // Watch Totem (z4y.3)
  const escapeProgress = read ? enc.escapeProgress ?? 0 : (enc.escapeProgress ?? 0) + 1;
  const ironGrip = passives['iron-hold'] !== undefined && passives['iron-hold'] >= 3;
  const escaped = !read && escapeProgress >= escapeTolerance && !enc.flags.snared && !ironGrip;

  const updatedTarget = { ...target };
  updatedTarget.captureState = escaped ? 'escaped' : deriveCaptureState(updatedTarget, flags);

  const courtLabel = COURT_LABEL[court] ?? probe;
  const probeLine = reacts
    ? `${target.name} ${strength === 'strong' ? 'reacts sharply' : 'stirs faintly'} to ${courtLabel}.`
    : `${target.name} rejects the ${courtLabel} probe.`;

  const baseState = {
    ...state,
    codexHints: read ? addHint(state.codexHints, target.id, courtLabel) : state.codexHints,
    currentEncounter: { ...enc, target: updatedTarget, flags, escapeProgress },
  };

  if (escaped) {
    const { tools, lost } = loseSupply(baseState.party.tools);
    let fled = { ...baseState, party: { ...baseState.party, tools } };
    fled = appendLog(fled, probeLine);
    fled = appendLog(fled, `${target.name} breaks the read and escapes${lost ? `, scattering a ${lost}` : ''}.`);
    return {
      ...fled,
      currentEncounter: { ...fled.currentEncounter, turn: fled.currentEncounter.turn + 1 },
    };
  }

  return finalizeEncounterAction(baseState, probeLine);
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
  const drive = routeForKind(target, TOOL_ACTION_KIND[toolId]);
  const triggersPosture = drive != null;

  const flags = toolId === 'snare-line' ? { ...enc.flags, snared: true } : { ...enc.flags };
  const updatedTarget = { ...target };
  if (triggersPosture) {
    updatedTarget.posture = drive.posture;
    if (drive.route === 'bold' && target.altBind) {
      flags.agitated = true;
    }
  }
  updatedTarget.captureState = deriveCaptureState(updatedTarget, flags);

  const agitate = triggersPosture && drive.route === 'bold' && target.altBind ? ' Forcing it agitates the quarry.' : '';
  const line = triggersPosture
    ? `Placed ${toolId}; ${target.name} is ${drive.posture}.${agitate}`
    : toolId === 'snare-line'
      ? `Staked a snare-line; ${target.name} cannot flee while it holds.`
      : `Placed ${toolId}.`;

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
        flags,
      },
    },
    line
  );
}

export function applyCompanionAction(state, beastId, actionId) {
  if (isResolvedEncounter(state)) {
    return state;
  }

  const beast = state.party.beasts[beastId];
  if (!beast) {
    return state; // beast not fielded this run
  }

  const enc = state.currentEncounter;
  const target = enc.target;

  const kind = COMPANION_ACTION_KIND[actionId] ?? null;
  const drive = routeForKind(target, kind);
  const triggersPosture = drive != null;

  const updatedTarget = { ...target };
  let flags = { ...enc.flags };
  let codexHints = state.codexHints;
  let line = `${beast.name} uses ${actionId}.`;

  if (triggersPosture) {
    updatedTarget.posture = drive.posture;
    if (drive.route === 'bold' && target.altBind) {
      flags.agitated = true;
    }
  }

  if (kind === 'reveal') {
    // Scent Read / Sense expose the true attunement (and reveal concealed beasts).
    codexHints = addHint(codexHints, target.id, target.primaryAttunement);
    line = triggersPosture
      ? `${beast.name} flushes out ${target.name}: it responds to ${target.primaryAttunement}, now ${drive.posture}.`
      : `${beast.name} reads ${target.name}: it responds to ${target.primaryAttunement}.`;
  } else if (triggersPosture) {
    const verb = drive.posture === 'cornered' ? 'into a corner' : drive.posture === 'staggered' ? 'off balance' : 'to the ground';
    const agitate = drive.route === 'bold' && target.altBind ? ' Forcing it agitates the quarry.' : '';
    line = `${beast.name} forces ${target.name} ${verb}; it is ${drive.posture}.${agitate}`;
  } else if (actionId === 'warning-bark') {
    flags.guardRaised = true;
    line = `${beast.name} barks a warning; the expedition steadies.`;
  } else if (actionId === 'brace') {
    flags.braceRaised = true;
    line = `${beast.name} braces the line.`;
  } else if (actionId === 'burden-shelter') {
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

// Press-your-luck (greed): hold the open window one more turn for a richer
// catch. The turn resolves normally, so window-decay (may slip) and pressure
// (may frenzy) both apply. The reward is banked when you finally bind.
export function pressCapture(state) {
  if (isResolvedEncounter(state)) {
    return state;
  }
  const enc = state.currentEncounter;
  if (enc.target.captureState !== 'bindable') {
    return finalizeEncounterAction(state, `${enc.target.name} is not ready to bind.`);
  }
  const pressed = {
    ...state,
    currentEncounter: { ...enc, pressLevel: (enc.pressLevel ?? 0) + 1 },
  };
  return finalizeEncounterAction(pressed, `You press the hold on ${enc.target.name}, risking more for a richer catch.`);
}

export function attemptCapture(state) {
  if (isResolvedEncounter(state)) {
    return state;
  }

  const enc = state.currentEncounter;
  const target = enc.target;
  if (target.captureState !== 'bindable') {
    return finalizeEncounterAction(state, `${target.name} is not ready to bind.`);
  }

  // Grade the capture (cme.3): no wrong reads is clean; a quick bind is fast.
  const clean = (enc.escapeProgress ?? 0) === 0;
  const fast = enc.turn <= FAST_CAPTURE_TURNS;
  const flourish = clean && fast ? ' — a clean, swift bind.' : clean ? ' — cleanly bound.' : fast ? ' — a swift bind.' : '.';

  const def = beastDef(target);
  let route = null;
  if (target.altBind) {
    route = enc.flags.attunementMatch && target.posture === def.bindPosture ? 'bold' : 'patient';
  }

  return finalizeEncounterAction(
    {
      ...state,
      captureLog: [...(state.captureLog ?? []), { id: target.id, clean, fast, elite: target.elite === true, pressLevel: enc.pressLevel ?? 0, route }],
      party: {
        ...state.party,
        captures: [...state.party.captures, target.id],
      },
      currentEncounter: {
        ...enc,
        target: {
          ...target,
          captureState: 'captured',
        },
      },
    },
    `${target.name} is captured${flourish}`
  );
}

// Withdraw is a clean exit (kill / capture / withdraw decision, F6): it resolves
// the encounter with no capture and no retaliation, preserving the expedition.
export function withdrawEncounter(state) {
  if (isResolvedEncounter(state)) {
    return state;
  }

  const enc = state.currentEncounter;
  const target = enc.target;

  return appendLog(
    {
      ...state,
      currentEncounter: {
        ...enc,
        target: { ...target, captureState: 'withdrawn' },
      },
    },
    `The expedition withdraws from ${target.name}, keeping what it has earned.`
  );
}

// Anchor recovery thins with depth so anchors are never a full reset (z4y.4).
export function anchorHeal(depth) {
  return Math.max(1, 4 - (depth ?? 1));
}

// Anchor — Secure (greed): lock in the haul without healing. Consumes the
// layer's single anchor. Dying still forfeits captures made after this.
export function secureHaul(state) {
  if (state.expeditionComplete || !circuitComplete(state) || state.currentEncounter.anchored) {
    return state;
  }
  const secured = state.party.captures.length;
  const newlySecured = secured - (state.securedCount ?? 0);
  return appendLog(
    {
      ...state,
      securedCount: secured,
      currentEncounter: { ...state.currentEncounter, anchored: true },
    },
    `The expedition secures its haul at layer ${state.currentEncounter.depth}${
      newlySecured > 0 ? ` (${newlySecured} capture${newlySecured === 1 ? '' : 's'} locked in)` : ''
    }.`
  );
}

// Anchor — Recover (greed): heal the leader and shed beast fatigue WITHOUT
// securing the haul. Consumes the layer's single anchor; recovery thins with depth.
export function recoverAtLayer(state) {
  if (state.expeditionComplete || !circuitComplete(state) || state.currentEncounter.anchored) {
    return state;
  }
  const campBonus = state.builds?.includes('sanctified-camp') ? 2 : 0; // Sanctified Camp (z4y.3)
  const heal = anchorHeal(state.currentEncounter.depth) + campBonus;
  const leader = {
    ...state.party.leader,
    health: Math.min(state.party.leader.maxHealth, state.party.leader.health + heal),
  };
  const beasts = Object.fromEntries(
    Object.entries(state.party.beasts).map(([id, beast]) => [
      id,
      { ...beast, fatigue: Math.max(0, beast.fatigue - 2) },
    ])
  );
  return appendLog(
    {
      ...state,
      party: { ...state.party, leader, beasts },
      currentEncounter: { ...state.currentEncounter, anchored: true },
    },
    `The expedition makes camp at layer ${state.currentEncounter.depth}: it heals and steadies (recovery thins deeper down).`
  );
}

// Raise a heavy structure at a circuit-completion anchor (z4y.3): requires the circuit complete,
// enough Lore, and that the structure isn't already built this run. Its effect lasts the whole run.
export function buildStructure(state, id) {
  const def = BUILD_CATALOG[id];
  if (!def || state.expeditionComplete || !circuitComplete(state)) {
    return state;
  }
  if ((state.builds ?? []).includes(id) || (state.lore ?? 0) < def.cost) {
    return state;
  }
  return appendLog(
    { ...state, lore: state.lore - def.cost, builds: [...(state.builds ?? []), id] },
    `The expedition raises a ${def.name} at the anchor (−${def.cost} Lore): ${def.effect}.`
  );
}

// Extract or Commit (E2): once a layer is resolved, end the run now and bank the
// haul (safe), instead of descending deeper into harder layers.
export function extractExpedition(state) {
  if (state.expeditionComplete || !canAdvanceEncounter(state)) {
    return state;
  }
  const captures = state.party.captures.length;
  const rank = captures >= 2 ? 'strong-success' : captures >= 1 ? 'success' : 'partial-failure';
  return appendLog(
    completeExpedition(state, rank),
    `The expedition extracts from layer ${state.currentEncounter.depth} with its haul.`
  );
}

// The descent is endless (cme.1): descending always generates the next, deeper
// layer (cycling the beast pool). A run ends only by extracting or by losing the
// leader, so "push deeper vs. extract" is a real greed gamble.
export function advanceEncounter(state) {
  if (!canAdvanceEncounter(state)) {
    return appendLog(state, 'The encounter is still active. You cannot descend yet.');
  }

  const nextIndex = state.encounterIndex + 1;
  const carryoverPressure =
    state.currentEncounter.pressure +
    Object.values(state.party.beasts).reduce((total, beast) => total + beast.fatigue, 0);

  const carriedLeaderHealth =
    carryoverPressure > 0 ? Math.max(0, state.party.leader.health - 1) : state.party.leader.health;

  if (carriedLeaderHealth <= 0) {
    return appendLog(
      completeExpedition(
        { ...state, party: { ...state.party, leader: { ...state.party.leader, health: 0 } } },
        'expedition-failure'
      ),
      'The leader does not recover from the descent. The expedition fails.'
    );
  }

  const cursor = advanceToNextQuarry(state.run, state.layerIndex, state.nodeIndex);
  const depth = nextIndex + 1;
  const beastId = state.run.layers[cursor.layerIndex][cursor.nodeIndex].beastId;
  const descentRelief = state.builds?.includes('descent-support') ? 1 : 0; // Descent Support (z4y.3)
  const layerPressure = Math.max(
    0,
    startingPressure(depth) + (state.omen?.startPressure ?? 0) - descentRelief // Restless Deep (cme.6)
  );
  const advanced = seedEncounterKnowledge({
    ...state,
    encounterIndex: nextIndex,
    layerIndex: cursor.layerIndex,
    nodeIndex: cursor.nodeIndex,
    lore: (state.lore ?? 0) + cursor.salvageLore,
    currentEncounter: {
      target: createTargetState(beastId, depth),
      depth,
      anchored: false,
      turn: 1,
      pressure: layerPressure,
      riskLevel: carryoverPressure,
      escapeProgress: 0,
      windowDecay: 0,
      pressLevel: 0,
      structures: [],
      flags: {
        attunementMatch: false,
        secondaryAttunementMatch: false,
        altAttunementMatch: false,
        guardRaised: false,
        braceRaised: false,
        alerted: carryoverPressure > 0,
        agitated: false,
      },
    },
    party: {
      ...state.party,
      leader: { ...state.party.leader, health: carriedLeaderHealth },
    },
  });

  let descended = advanced;
  if (cursor.salvageLore > 0) {
    descended = appendLog(
      descended,
      `The expedition recovers a salvage cache on the way down (+${cursor.salvageLore} Lore).`
    );
  }
  descended = appendLog(descended, `The expedition descends to layer ${depth}.`);
  if (startingPressure(depth) > 0) {
    descended = appendLog(
      descended,
      'The deep presses from the first breath — the quarry is already restless.'
    );
  }
  return descended;
}
