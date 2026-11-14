/* Garde-fou : un test lancé sans la copie temporaire de run-all.js (donc sur le vrai data/) refuse de tourner. */
const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

const lib = JSON.stringify(path.join(__dirname, 'lib.js'));
const essai = (env) => spawnSync(process.execPath, ['-e', 'require(' + lib + ')'], { env, encoding: 'utf8' });

const sansCopie = { ...process.env }; delete sansCopie.TEST_ROOT;
assert.match(essai(sansCopie).stderr, /garde-fou des tests/, 'sans TEST_ROOT : refusé');
assert.match(essai({ ...process.env, TEST_ROOT: path.join(__dirname, '..') }).stderr, /garde-fou des tests/, 'TEST_ROOT = vrai dépôt : refusé');
assert.strictEqual(essai(process.env).status, 0, 'copie temporaire de run-all.js : accepté');
console.log('PASS — garde-donnees');
