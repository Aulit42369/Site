/* ================================================================
   Cache-busting automatique pour style.css et main.js.

   Calcule un hash du contenu de chacun des deux fichiers et met à
   jour le "?v=" derrière leur nom dans toutes les pages HTML du
   site. Ainsi, à chaque modification de l'un des deux fichiers, les
   visiteurs récupèrent automatiquement la dernière version au lieu
   de rester sur une copie mise en cache par leur navigateur — plus
   besoin d'y penser ni de changer un numéro à la main.

   Lancé par .github/workflows/asset-versioning.yml à chaque push sur
   main qui touche style.css ou main.js.
   ================================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

function shortHash(fileName) {
  const content = fs.readFileSync(path.join(ROOT, fileName));
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
}

const cssHash = shortHash('style.css');
const jsHash = shortHash('main.js');

const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));

let updated = 0;
for (const file of htmlFiles) {
  const filePath = path.join(ROOT, file);
  const before = fs.readFileSync(filePath, 'utf-8');

  /* On ne touche qu'aux vraies références (href="..."/src="..."),
     jamais à une simple mention du nom du fichier dans un texte ou
     un commentaire. */
  const after = before
    .replace(/(href=["'])style\.css(?:\?v=[^"']*)?(["'])/g, `$1style.css?v=${cssHash}$2`)
    .replace(/(src=["'])main\.js(?:\?v=[^"']*)?(["'])/g, `$1main.js?v=${jsHash}$2`);

  if (after !== before) {
    fs.writeFileSync(filePath, after);
    updated++;
  }
}

console.log(`style.css -> v=${cssHash}, main.js -> v=${jsHash} (${updated} page(s) mise(s) à jour)`);
