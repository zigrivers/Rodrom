import { normalizeBeast, PAIR_TWIN, validateBeast, BIND_KINDS } from './schema.mjs';

// Deterministic alternate route for a Dire's second capture path: each bind kind maps to a
// distinct fallback kind + its posture, so a derived dual-route is stable and test-friendly.
export const ALT_ROUTE = {
  corner: { bindKind: 'stagger', bindPosture: 'staggered' },
  stagger: { bindKind: 'ground', bindPosture: 'grounded' },
  reveal: { bindKind: 'corner', bindPosture: 'cornered' },
  ground: { bindKind: 'reveal', bindPosture: 'revealed' },
};

// Fail loudly at import time if a bind kind has no alt route — otherwise deriveAltBind would
// throw an opaque TypeError on the first beast that uses the unmapped kind.
for (const k of BIND_KINDS) {
  if (!ALT_ROUTE[k]) throw new Error(`ALT_ROUTE missing entry for bind kind: ${k}`);
}

// Derive a second capture route for a beast that has no authored altBind. The alt attunement is
// the beast's secondary if set, else its confusion-pair twin. Returns null when there is no
// distinct second read (e.g. a deep-attunement primary with no twin and no secondary) — a route
// reading the same attunement as the primary is not a genuine second path.
export function deriveAltBind(base) {
  const attunement = base.secondaryAttunement ?? PAIR_TWIN[base.primaryAttunement] ?? null;
  if (attunement == null || attunement === base.primaryAttunement) return null;
  const route = ALT_ROUTE[base.bindKind];
  return { attunement, bindKind: route.bindKind, bindPosture: route.bindPosture };
}

// Dire elite: tougher, dual-route, gold-tier. Mirrors the engine's existing elite treatment
// (deeper HP + a second bind route). Keeps an authored altBind if one exists.
export function direVariant(base) {
  return normalizeBeast({
    ...base,
    id: `${base.id}-dire`,
    name: `Dire ${base.name}`,
    rank: 'dire',
    baseSpeciesId: base.baseSpeciesId ?? base.id, // root id survives variant chaining
    authored: false,
    maxHealth: base.maxHealth + 2,
    altBind: base.altBind ?? deriveAltBind(base),
    tierGold: 'dire',
  });
}

const STAGE_EPITHET = { 2: 'Risen', 3: 'Elder' };

// Evolution / depth-form: tougher, harder to read. Stage 3 gains concealment.
// Stage 1 is the base itself; evolving to stage 1 would mint a near-duplicate ghost entry.
export function evolveVariant(base, stage) {
  if (stage < 2) throw new Error(`evolveVariant requires stage >= 2, got ${stage}`);
  const epithet = STAGE_EPITHET[stage];
  return normalizeBeast({
    ...base,
    id: `${base.id}-s${stage}`,
    name: epithet ? `${base.name} (${epithet})` : base.name,
    stage,
    baseSpeciesId: base.baseSpeciesId ?? base.id, // root id survives variant chaining
    authored: false,
    maxHealth: base.maxHealth + (stage - 1),
    concealed: stage >= 3 ? true : base.concealed,
  });
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Expand an authored list into the full catalogued roster. Each authored record may carry an
// `expand` directive: { evolve: [2,3], dire: true, regional: { stratum: attunement } }.
// Deterministic, deduped, and fully validated — throws on a duplicate id, an orphan variant,
// or an invalid record so a bad dataset fails loudly at build time.
export function expandRoster(authored) {
  const out = [];
  const seen = new Set();
  const push = (rec) => {
    if (seen.has(rec.id)) throw new Error(`duplicate beast id: ${rec.id}`);
    seen.add(rec.id);
    out.push(rec);
  };
  for (const raw of authored) {
    const base = normalizeBeast(raw);
    push(base);
    const ex = raw.expand ?? {};
    for (const stage of ex.evolve ?? []) push(evolveVariant(base, stage));
    if (ex.dire) push(direVariant(base));
    for (const [stratum, attunement] of Object.entries(ex.regional ?? {})) {
      push(regionalVariant(base, stratum, attunement));
    }
  }
  for (const rec of out) {
    if (rec.baseSpeciesId && !seen.has(rec.baseSpeciesId)) {
      throw new Error(`orphan variant: ${rec.id} -> ${rec.baseSpeciesId}`);
    }
    const errs = validateBeast(rec);
    if (errs.length) throw new Error(`invalid beast ${rec.id}: ${errs.join('; ')}`);
  }
  return out;
}

// Regional re-skin: same archetype, a different stratum's attunement (false lead re-pairs).
// Swapping the primary makes the base's secondaryAttunement and altBind stale (they were paired
// to the old attunement), so both are cleared — a Dire of this re-skin re-derives its own route.
export function regionalVariant(base, stratum, newAttunement) {
  return normalizeBeast({
    ...base,
    id: `${base.id}-${stratum}`,
    name: `${cap(newAttunement)}-touched ${base.name}`,
    stratum,
    primaryAttunement: newAttunement,
    falseLead: PAIR_TWIN[newAttunement] ?? null,
    secondaryAttunement: null,
    altBind: null,
    baseSpeciesId: base.baseSpeciesId ?? base.id, // root id survives variant chaining
    authored: false,
  });
}
