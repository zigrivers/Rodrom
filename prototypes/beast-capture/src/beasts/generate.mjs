import { normalizeBeast, PAIR_TWIN } from './schema.mjs';

// Deterministic alternate route for a Dire's second capture path: each bind kind maps to a
// distinct fallback kind + its posture, so a derived dual-route is stable and test-friendly.
export const ALT_ROUTE = {
  corner: { bindKind: 'stagger', bindPosture: 'staggered' },
  stagger: { bindKind: 'ground', bindPosture: 'grounded' },
  reveal: { bindKind: 'corner', bindPosture: 'cornered' },
  ground: { bindKind: 'reveal', bindPosture: 'revealed' },
};

// Derive a second capture route for a beast that has no authored altBind. The alt attunement is
// the beast's secondary if set, else its confusion-pair twin.
export function deriveAltBind(base) {
  const route = ALT_ROUTE[base.bindKind];
  const attunement = base.secondaryAttunement ?? PAIR_TWIN[base.primaryAttunement] ?? base.primaryAttunement;
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
    baseSpeciesId: base.id,
    authored: false,
    maxHealth: base.maxHealth + 2,
    altBind: base.altBind ?? deriveAltBind(base),
    tierGold: 'dire',
  });
}
