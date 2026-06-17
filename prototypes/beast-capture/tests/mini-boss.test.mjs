import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, createTargetState, buildRun } from '../src/state.mjs';
import { applyHeroProbe, applyCompanionAction, attemptCapture, advanceEncounter } from '../src/engine.mjs';
import { renderApp } from '../src/ui.mjs';

const captureChainMaw = (s) =>
  attemptCapture(applyCompanionAction(applyHeroProbe(s, 'mass'), 'mireback-tortoise', 'shove'));

test('a mini-boss target is an elite-grade Alpha with extra health', () => {
  const boss = createTargetState('chain-maw', 1, { miniboss: true });
  assert.equal(boss.miniboss, true);
  assert.equal(boss.elite, true, 'a mini-boss is elite-grade regardless of depth');
  assert.match(boss.name, /^Alpha /);
  const ordinary = createTargetState('chain-maw', 1);
  assert.ok(boss.maxHealth > ordinary.maxHealth, 'tougher than the ordinary quarry');
});

test('later runs seed periodic mini-boss capstones (loh.1)', () => {
  const { layers } = buildRun(0, false);
  const lastQuarry = (layer) => [...layer].reverse().find((n) => n.kind === 'quarry');
  assert.equal(lastQuarry(layers[2]).miniboss, true, 'the 3rd circuit caps with a mini-boss');
  assert.notEqual(lastQuarry(layers[0]).miniboss, true, 'an ordinary circuit does not');
});

test('advancing onto a mini-boss capstone spawns the Alpha', () => {
  const run = { layers: [[
    { kind: 'quarry', beastId: 'chain-maw' },
    { kind: 'quarry', beastId: 'storm-antler', miniboss: true },
  ]] };
  let s = createInitialState({ run, fielded: ['mireback-tortoise'] });
  s = captureChainMaw(s);
  s = advanceEncounter(s);
  assert.equal(s.currentEncounter.target.miniboss, true);
  assert.equal(s.currentEncounter.target.elite, true);
});

test('the encounter view telegraphs a mini-boss', () => {
  const run = { layers: [[
    { kind: 'quarry', beastId: 'chain-maw' },
    { kind: 'quarry', beastId: 'storm-antler', miniboss: true },
  ]] };
  let s = createInitialState({ run, fielded: ['mireback-tortoise'] });
  s = advanceEncounter(captureChainMaw(s));
  assert.match(renderApp(s), /MINI-BOSS/);
});
