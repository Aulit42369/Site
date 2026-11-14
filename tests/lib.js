/* Réglages communs des tests. Les tests tournent sur une COPIE temporaire
   du dépôt (créée par run-all.js) : ils peuvent écrire dans data/ sans
   jamais toucher aux vrais fichiers. */
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
// Garde-fou (14/11) : sans copie temporaire, les tests écriraient dans le VRAI data/
// (piège du 05/11 : `node --test tests/*.test.js` depuis la racine). On refuse.
const ROOT = process.env.TEST_ROOT;
if (!ROOT || path.resolve(ROOT).toLowerCase() === path.resolve(REPO).toLowerCase()) {
  throw new Error('[garde-fou des tests] Pas de copie temporaire du dépôt : ces tests écriraient dans le vrai data/. Lancer : cd tests && node run-all.js');
}
const BASE = process.env.TEST_BASE || 'http://localhost:8930';

const launchOpts = {};
const exe = process.env.PW_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
if (exe) launchOpts.executablePath = exe;

module.exports = { REPO, ROOT, BASE, launchOpts };
