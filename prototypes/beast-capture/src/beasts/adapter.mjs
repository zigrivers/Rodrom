// Project a normalized beast record onto the engine's existing TARGET_BEASTS entry shape, so the
// new data model feeds the current capture engine with no engine changes. Conditional keys
// (altBind / concealed) are emitted only when present, matching src/content.mjs exactly.
export function toTargetBeast(b) {
  const out = {
    id: b.id,
    name: b.name,
    primaryAttunement: b.primaryAttunement,
    falseLead: b.falseLead,
    initialPosture: b.initialPosture,
    bindPosture: b.bindPosture,
    bindKind: b.bindKind,
    initialCaptureState: b.initialCaptureState,
    maxHealth: b.maxHealth,
    blurb: b.blurb,
  };
  if (b.altBind) out.altBind = b.altBind;
  if (b.concealed) out.concealed = true;
  return out;
}
