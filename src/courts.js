// The 8 attunements form 4 confusion-pair "courts": a lead (the original probeable attunement)
// and a twin (the original decoy). Probing a court reacts strongly to the lead, faintly to the twin.
// The lead/twin pairings mirror PAIR_TWIN in src/beasts/schema.js — keep the two in sync.
export const COURTS = ['heat', 'mass', 'sky', 'absence'];

export const COURT_OF = {
  ash: 'heat', flame: 'heat',
  iron: 'mass', stone: 'mass',
  storm: 'sky', light: 'sky',
  veil: 'absence', silence: 'absence',
};

export const COURT_LEAD = { heat: 'ash', mass: 'iron', sky: 'storm', absence: 'veil' };
export const COURT_LABEL = { heat: 'Heat', mass: 'Mass', sky: 'Sky', absence: 'Absence' };

// Normalize a probe input — a court name OR an exact attunement — to its court (null if neither).
export function toCourt(x) {
  if (COURTS.includes(x)) return x;
  return COURT_OF[x] ?? null;
}

// Strong if the attunement is its court's lead; faint if it's the twin; null if it's outside the
// court system (e.g. a deep attunement like rot), so callers can distinguish "twin" from "no court".
export function reactionStrength(attunement) {
  const court = COURT_OF[attunement];
  if (!court) return null;
  return COURT_LEAD[court] === attunement ? 'strong' : 'faint';
}
