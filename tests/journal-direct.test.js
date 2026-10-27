/* Journal de direct : format d'une ligne et fichier du mois (sans navigateur). */
const assert = require('assert');
const path = require('path');
const { releve, fichierDuMois } = require('../scripts/journal-direct');

const t = new Date('2026-10-31T23:30:00Z'); // 00:30 le 1er novembre à Paris
assert.strictEqual(releve(null, t), null, 'hors ligne : aucune ligne');
assert.deepStrictEqual(
  releve({ title: 'Soirée', game_name: 'Valorant', viewer_count: 42 }, t),
  { t: '2026-10-31T23:30:00.000Z', titre: 'Soirée', jeu: 'Valorant', spectateurs: 42 }
);
assert.deepStrictEqual(releve({}, t), { t: t.toISOString(), titre: '', jeu: '', spectateurs: 0 }, 'champs manquants');
assert.strictEqual(path.basename(fichierDuMois('j', t)), '2026-11.jsonl', 'mois civil à Paris');
console.log('PASS — journal-direct');
