// Canonical beast schema for the Bestiary data model. Pure data + validation; no engine deps.

// 8 core attunements as 4 confusion-pairs (see brainstorm §1); 4 deep-stratum attunements.
export const CORE_ATTUNEMENTS = ['ash', 'flame', 'iron', 'stone', 'storm', 'light', 'veil', 'silence'];
export const DEEP_ATTUNEMENTS = ['rot', 'bone', 'glass', 'tide'];
export const ATTUNEMENTS = [...CORE_ATTUNEMENTS, ...DEEP_ATTUNEMENTS];

// A beast's default false lead is its attunement's confusion-pair twin.
export const PAIR_TWIN = {
  ash: 'flame', flame: 'ash', iron: 'stone', stone: 'iron',
  storm: 'light', light: 'storm', veil: 'silence', silence: 'veil',
};

export const GENERA = [
  'Wraiths', 'Wardens', 'Stalkers', 'Broods', 'Blighted', 'Constructs',
  'Cantors', 'Drakes', 'Hollow', 'Tideborn', 'Glasskin', 'Nameless',
];
export const RANKS = ['quarry', 'dire', 'pariah', 'apex'];
export const BIND_KINDS = ['corner', 'stagger', 'reveal', 'ground'];
export const POSTURES = ['skittish', 'charging', 'braced', 'hidden', 'cornered', 'staggered', 'revealed', 'grounded'];
export const BEHAVIORS = ['rusher', 'lurker', 'caster', 'spawner', 'tank', 'deceiver', 'support', 'fleer', 'controller'];
export const HAZARDS = ['none', 'detonate', 'spawn', 'dread', 'empower-neighbors'];
export const STRATA = ['ashfields', 'ironhold', 'stormspire', 'veilmarsh', 'blightwarren', 'drowned', 'glass-spiral'];

const REQUIRED = [
  'id', 'name', 'genus', 'rank', 'primaryAttunement', 'bindKind',
  'bindPosture', 'initialPosture', 'initialCaptureState', 'maxHealth', 'stratum',
];

// Returns an array of human-readable error strings; empty array means valid.
export function validateBeast(b) {
  const errs = [];
  for (const f of REQUIRED) {
    if (b[f] === undefined || b[f] === null) errs.push(`missing ${f}`);
  }
  if (b.genus && !GENERA.includes(b.genus)) errs.push(`bad genus: ${b.genus}`);
  if (b.rank && !RANKS.includes(b.rank)) errs.push(`bad rank: ${b.rank}`);
  if (b.primaryAttunement && !ATTUNEMENTS.includes(b.primaryAttunement)) errs.push(`bad primaryAttunement: ${b.primaryAttunement}`);
  if (b.secondaryAttunement != null && !ATTUNEMENTS.includes(b.secondaryAttunement)) errs.push(`bad secondaryAttunement: ${b.secondaryAttunement}`);
  if (b.falseLead != null && !ATTUNEMENTS.includes(b.falseLead)) errs.push(`bad falseLead: ${b.falseLead}`);
  if (b.bindKind && !BIND_KINDS.includes(b.bindKind)) errs.push(`bad bindKind: ${b.bindKind}`);
  if (b.stratum && !STRATA.includes(b.stratum)) errs.push(`bad stratum: ${b.stratum}`);
  if (typeof b.maxHealth === 'number' && (b.maxHealth < 1 || b.maxHealth > 30)) errs.push(`maxHealth out of range: ${b.maxHealth}`);
  return errs;
}
