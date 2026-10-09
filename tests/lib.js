/* Réglages communs des tests. Les tests tournent sur une COPIE temporaire
   du dépôt (créée par run-all.js) : ils peuvent écrire dans data/ sans
   jamais toucher aux vrais fichiers. */
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const ROOT = process.env.TEST_ROOT || REPO;
const BASE = process.env.TEST_BASE || 'http://localhost:8930';

const launchOpts = {};
const exe = process.env.PW_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
if (exe) launchOpts.executablePath = exe;

module.exports = { REPO, ROOT, BASE, launchOpts };
