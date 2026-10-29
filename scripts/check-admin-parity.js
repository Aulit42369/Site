/* ================================================================
   « Parité admin » : vérifie que tout ce que le site sait lire est
   modifiable (ou au moins signalé) dans l'admin.

     node scripts/check-admin-parity.js

   Échoue si :
   - une page a des textes éditables (data-edit) mais n'est pas dans
     TEXT_PAGES de admin.js ;
   - le site lit un fichier data/*.json que l'admin ne gère pas (et qui
     n'est pas écrit par une automatisation) ;
   - une clé data-edit est en double sur une page ;
   - un fichier d'admin est absent de l'historique.
   Pour ajouter un fichier géré uniquement par automatisation,
   l'inscrire dans AUTOMATED ci-dessous.
   ================================================================ */
const fs = require('fs');
const path = require('path');
const { ROOT, loadCorePages } = require('./registry');

const AUTOMATED = ['twitch-status', 'broken-links', 'recent-games'];
const errors = [];
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
// l'admin est découpé : admin.js + admin/*.js ; les scripts des pages sont dans js/*.js
const jsIn = (dir) => (fs.existsSync(path.join(ROOT, dir)) ? fs.readdirSync(path.join(ROOT, dir)).filter((x) => x.endsWith('.js')).map((x) => dir + '/' + x) : []);
const admin = ['admin.js', ...jsIn('admin')].map(read).join('\n');

const textPages = new Set([...admin.matchAll(/\['([a-z0-9-]+\.html)',\s*'[^']*'\]/g)].map((m) => m[1]));
for (const p of loadCorePages()) {
  if (!fs.existsSync(path.join(ROOT, p.file))) { errors.push(`${p.file} est dans CORE_PAGES mais n'existe pas`); continue; }
  const html = read(p.file);
  const keys = [...html.matchAll(/data-edit="([^"]+)"/g)].map((m) => m[1]);
  if (keys.length && !textPages.has(p.file)) errors.push(`${p.file} a ${keys.length} texte(s) éditable(s) mais n'est pas dans TEXT_PAGES (admin.js)`);
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dup.length) errors.push(`${p.file} : clés data-edit en double : ${[...new Set(dup)].join(', ')}`);
  if (!keys.length && !p.generic && !['404.html'].includes(p.file) && !/data-no-edit/.test(html)) {
    errors.push(`${p.file} n'a aucun texte éditable (ajoute des data-edit ou la mention data-no-edit sur <body> pour l'exclure volontairement)`);
  }
}
for (const f of textPages) if (!fs.existsSync(path.join(ROOT, f))) errors.push(`TEXT_PAGES référence ${f} qui n'existe pas`);

const used = new Set();
for (const f of [...fs.readdirSync(ROOT).filter((x) => x.endsWith('.html') || x === 'main.js'), ...jsIn('js')]) {
  for (const m of read(f).matchAll(/data\/([a-z0-9-]+)\.json/g)) used.add(m[1]);
}
for (const name of used) {
  if (AUTOMATED.includes(name)) continue;
  if (!admin.includes(`data/${name}.json`) && !admin.includes(`Collection('${name}'`)) errors.push(`Le site lit data/${name}.json mais l'admin ne le gère pas`);
}
const hist = (admin.match(/const HIST_FILES = \[([\s\S]*?)\];/) || [])[1] || '';
for (const name of used) {
  if (AUTOMATED.includes(name)) continue;
  if (!hist.includes(`'${name}'`)) errors.push(`data/${name}.json n'est pas dans HIST_FILES (onglet Historique)`);
}

// la liste de jeux par défaut de js/jeux.js et celle de l'admin doivent rester identiques
{
  const grab = (src) => { const m = src.match(/const DEFAULT_GAMES = (\[[\s\S]*?\n\]);/); return m ? JSON.stringify(new Function('return ' + m[1])()) : null; };
  const a = grab(read('js/jeux.js')), b = grab(admin);
  if (!a || !b) errors.push('DEFAULT_GAMES introuvable dans js/jeux.js ou admin/jeux.js');
  else if (a !== b) errors.push('DEFAULT_GAMES de js/jeux.js et de admin/jeux.js ont divergé (garde-les identiques)');
}

if (errors.length) {
  console.error('✗ Parité admin :\n' + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}
console.log('OK : parité site ↔ admin respectée (' + textPages.size + ' pages éditables, ' + used.size + ' fichiers de données).');
