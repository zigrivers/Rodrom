// Authored beast seed dataset. The 4 shipped beasts are re-expressed in the schema (their engine
// projection must stay identical — see tests), each carrying an `expand` directive that the matrix
// generator uses to produce catalogued variants. A few Appendix-A seeds exercise other genera.
export const AUTHORED = [
  { id: 'ashwing-moth', name: 'Ashwing Moth', genus: 'Stalkers', rank: 'quarry', stratum: 'ashfields',
    primaryAttunement: 'ash', falseLead: 'flame', initialPosture: 'skittish', bindKind: 'corner', bindPosture: 'cornered',
    altBind: { attunement: 'iron', bindKind: 'stagger', bindPosture: 'staggered' },
    initialCaptureState: 'unreadable', maxHealth: 2, blurb: 'A moth of cinders; its wings scatter blinding ash.',
    expand: { evolve: [2], dire: true } },

  { id: 'chain-maw', name: 'Chain Maw', genus: 'Wardens', rank: 'quarry', stratum: 'ironhold',
    primaryAttunement: 'iron', falseLead: 'stone', initialPosture: 'charging', bindKind: 'stagger', bindPosture: 'staggered',
    altBind: { attunement: 'storm', bindKind: 'ground', bindPosture: 'grounded' },
    initialCaptureState: 'unreadable', maxHealth: 4, blurb: 'Iron-jawed and relentless — it drags its own broken chains.',
    expand: { dire: true } },

  { id: 'veil-lynx', name: 'Veil Lynx', genus: 'Stalkers', rank: 'quarry', stratum: 'veilmarsh',
    primaryAttunement: 'veil', falseLead: 'silence', initialPosture: 'hidden', bindKind: 'reveal', bindPosture: 'revealed',
    concealed: true, initialCaptureState: 'unreadable', maxHealth: 3, blurb: 'Half-seen at the edge of torchlight; gone when looked at.',
    expand: { evolve: [2] } },

  { id: 'storm-antler', name: 'Storm Antler', genus: 'Drakes', rank: 'quarry', stratum: 'stormspire',
    primaryAttunement: 'storm', falseLead: 'light', initialPosture: 'braced', bindKind: 'ground', bindPosture: 'grounded',
    altBind: { attunement: 'iron', bindKind: 'stagger', bindPosture: 'staggered' },
    initialCaptureState: 'unreadable', maxHealth: 5, blurb: 'Its antlers hum before the strike; the air tastes of lightning.',
    expand: { dire: true } },

  // Appendix-A seeds (new genera; these exercise the generator beyond the shipped four).
  { id: 'iron-jailer', name: 'Iron Jailer', genus: 'Wardens', rank: 'quarry', stratum: 'ironhold',
    primaryAttunement: 'iron', initialPosture: 'charging', bindKind: 'stagger', bindPosture: 'staggered',
    behaviorArchetype: 'tank', initialCaptureState: 'unreadable', maxHealth: 5,
    blurb: 'Tethered to a wall anchor; brace the chain first and the window doubles.',
    expand: { dire: true, regional: { ashfields: 'ash' } } },

  { id: 'aerie-cantor', name: 'Aerie Cantor', genus: 'Cantors', rank: 'quarry', stratum: 'stormspire',
    primaryAttunement: 'light', initialPosture: 'hidden', bindKind: 'reveal', bindPosture: 'revealed',
    behaviorArchetype: 'support', initialCaptureState: 'unreadable', maxHealth: 3,
    blurb: 'Broadcasts a false storm-tell over the room; bind it first to drop every mask.',
    expand: { evolve: [2] } },

  { id: 'sporecount-sexton', name: 'Sporecount Sexton', genus: 'Broods', rank: 'quarry', stratum: 'blightwarren',
    primaryAttunement: 'rot', falseLead: 'veil', initialPosture: 'braced', bindKind: 'ground', bindPosture: 'grounded',
    behaviorArchetype: 'spawner', onKillHazard: 'spawn', initialCaptureState: 'unreadable', maxHealth: 4,
    blurb: 'Six orbiting Sporelings each add a false feint; bind the anchor to collapse them.',
    expand: { dire: true } },

  // Dual-typed quarries pair ONE lead court (sharp) with ONE twin court (faint) — see my-mordor-4ei —
  // so the strong-vs-faint reaction tells the player which court is the surface and which the core.
  { id: 'stormcoil-apostate', name: 'Stormcoil Apostate', genus: 'Drakes', rank: 'quarry', stratum: 'stormspire',
    primaryAttunement: 'storm', secondaryAttunement: 'stone', initialPosture: 'charging', bindKind: 'corner', bindPosture: 'cornered',
    behaviorArchetype: 'rusher', initialCaptureState: 'unreadable', maxHealth: 4,
    blurb: 'Storm crackles sharp at the surface; a heavy stone core stirs faintly beneath. Read both courts to bind it.',
    expand: { dire: true } },

  { id: 'cinder-veilkeeper', name: 'Cinder Veilkeeper', genus: 'Stalkers', rank: 'quarry', stratum: 'veilmarsh',
    primaryAttunement: 'ash', secondaryAttunement: 'silence', initialPosture: 'skittish', bindKind: 'corner', bindPosture: 'cornered',
    behaviorArchetype: 'lurker', initialCaptureState: 'unreadable', maxHealth: 3,
    blurb: 'Embers crackle over a held hush — read the Heat sharp and the Absence faint before it bolts.',
    expand: { evolve: [2] } },

  { id: 'ironcrown-herald', name: 'Ironcrown Herald', genus: 'Cantors', rank: 'quarry', stratum: 'ironhold',
    primaryAttunement: 'iron', secondaryAttunement: 'light', initialPosture: 'hidden', bindKind: 'reveal', bindPosture: 'revealed',
    behaviorArchetype: 'support', initialCaptureState: 'unreadable', maxHealth: 4,
    blurb: 'It crowns itself in pale light; the Mass beneath answers sharp, the Sky-glow only faintly. Still both.',
    expand: { dire: true } },

  // Twin-attuned quarries (my-mordor-4ei): single-court primaries on the twin attunements
  // (flame/stone/silence; light already arrives via Aerie Cantor) so 'stirs faintly' is a common,
  // learnable read across all four courts, not a rarity seen only on concealed beasts.
  { id: 'pyre-wisp', name: 'Pyre Wisp', genus: 'Wraiths', rank: 'quarry', stratum: 'ashfields',
    primaryAttunement: 'flame', initialPosture: 'skittish', bindKind: 'corner', bindPosture: 'cornered',
    behaviorArchetype: 'fleer', initialCaptureState: 'unreadable', maxHealth: 2,
    blurb: 'Live fire with no body — it gutters out the instant you fix on it.',
    expand: { dire: true } },

  { id: 'scree-golem', name: 'Scree Golem', genus: 'Constructs', rank: 'quarry', stratum: 'ironhold',
    primaryAttunement: 'stone', initialPosture: 'braced', bindKind: 'stagger', bindPosture: 'staggered',
    behaviorArchetype: 'tank', initialCaptureState: 'unreadable', maxHealth: 6,
    blurb: 'A drift of loose stone that walks; stagger it before it settles back to rubble.',
    expand: { dire: true } },

  { id: 'hush-stalker', name: 'Hush Stalker', genus: 'Stalkers', rank: 'quarry', stratum: 'veilmarsh',
    primaryAttunement: 'silence', initialPosture: 'hidden', bindKind: 'reveal', bindPosture: 'revealed',
    behaviorArchetype: 'lurker', initialCaptureState: 'unreadable', maxHealth: 3,
    blurb: 'It eats sound; you feel the hush before you ever see the shape inside it.',
    expand: { evolve: [2] } },
];
