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

  { id: 'stormcoil-apostate', name: 'Stormcoil Apostate', genus: 'Drakes', rank: 'quarry', stratum: 'stormspire',
    primaryAttunement: 'storm', secondaryAttunement: 'iron', initialPosture: 'charging', bindKind: 'corner', bindPosture: 'cornered',
    behaviorArchetype: 'rusher', initialCaptureState: 'unreadable', maxHealth: 4,
    blurb: 'Its storm-tell is a feint; the iron core is the true read. Answer both to bind it.',
    expand: { dire: true } },

  { id: 'cinder-veilkeeper', name: 'Cinder Veilkeeper', genus: 'Stalkers', rank: 'quarry', stratum: 'veilmarsh',
    primaryAttunement: 'ash', secondaryAttunement: 'veil', initialPosture: 'skittish', bindKind: 'corner', bindPosture: 'cornered',
    behaviorArchetype: 'lurker', initialCaptureState: 'unreadable', maxHealth: 3,
    blurb: 'Embers under a shroud — read the Heat and the Absence both before it bolts.',
    expand: { evolve: [2] } },

  { id: 'ironcrown-herald', name: 'Ironcrown Herald', genus: 'Cantors', rank: 'quarry', stratum: 'ironhold',
    primaryAttunement: 'iron', secondaryAttunement: 'storm', initialPosture: 'hidden', bindKind: 'reveal', bindPosture: 'revealed',
    behaviorArchetype: 'support', initialCaptureState: 'unreadable', maxHealth: 4,
    blurb: 'It crowns itself in static; reveal the Mass beneath the Sky to still it.',
    expand: { dire: true } },
];
