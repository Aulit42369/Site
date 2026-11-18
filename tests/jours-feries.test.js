// Idée 42 : jours fériés calculés (aucun appel tiers). Lancé par run-all.js.
const test = require('node:test');
const assert = require('node:assert');
const { feries, feriesDu, ferieDe } = require('../js/jours-feries.js');

test('11 fériés par an, Pâques et ses dérivés justes (2026, 2027, 2028)', () => {
  for (const a of [2026, 2027, 2028]) assert.strictEqual(Object.keys(feries(a)).length, 11);
  assert.strictEqual(feries(2026)['2026-04-06'], 'Lundi de Pâques');
  assert.strictEqual(feries(2026)['2026-05-14'], 'Ascension');
  assert.strictEqual(feries(2026)['2026-05-25'], 'Lundi de Pentecôte');
  assert.strictEqual(feries(2027)['2027-03-29'], 'Lundi de Pâques');
  assert.strictEqual(feries(2028)['2028-04-17'], 'Lundi de Pâques');
});

test('ferieDe : Noël oui, un jour ordinaire non', () => {
  assert.strictEqual(ferieDe(new Date(2026, 11, 25, 21, 0)), 'Noël');
  assert.strictEqual(ferieDe(new Date(2026, 11, 24, 12)), '');
});

test('feriesDu : 7 jours avant Noël, passage d’année', () => {
  const l = feriesDu(new Date(2026, 11, 18, 9), 14);
  assert.deepStrictEqual(l.map((f) => [f.date, f.dans]), [['2026-12-25', 7], ['2027-01-01', 14]]);
});
