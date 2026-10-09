/* ================================================================
   Minification + cache-busting automatique pour style.css et
   main.js.

   Les fichiers sources (style.css, main.js) restent tels qu'écrits —
   à modifier normalement, sans rien changer à cette habitude. Ce
   script génère à partir d'eux style.min.css et main.min.js
   (espaces et commentaires enlevés, pages plus légères), calcule un
   hash de ces versions minifiées, et met à jour le "?v=" dans toutes
   les pages HTML pour qu'elles pointent vers ces fichiers. Ainsi, à
   chaque modification de l'un des deux fichiers sources, les
   visiteurs récupèrent automatiquement la dernière version — plus
   besoin d'y penser ni de changer un numéro à la main.

   Lancé par .github/workflows/asset-versioning.yml à chaque push sur
   main qui touche style.css, main.js ou admin.js.
   ================================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { minify: minifyJs } = require('terser');
const CleanCSS = require('clean-css');

const ROOT = path.join(__dirname, '..');

function shortHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
}

async function main() {
  const cssSource = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf-8');
  const jsSource = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf-8');

  const cssResult = new CleanCSS({}).minify(cssSource);
  if (cssResult.errors.length) throw new Error('Echec minification CSS : ' + cssResult.errors.join(', '));
  const minifiedCss = cssResult.styles;

  const jsResult = await minifyJs(jsSource);
  if (!jsResult.code) throw new Error('Echec minification JS : sortie vide');
  const minifiedJs = jsResult.code;

  fs.writeFileSync(path.join(ROOT, 'style.min.css'), minifiedCss);
  fs.writeFileSync(path.join(ROOT, 'main.min.js'), minifiedJs);

  /* admin.js n'est pas minifié (page privée, lisible en cas de souci),
     mais il est versionné pour que l'admin ne garde jamais une
     ancienne copie en cache. */
  const adminHash = shortHash(fs.readFileSync(path.join(ROOT, 'admin.js'), 'utf-8'));
  const cssHash = shortHash(minifiedCss);
  const jsHash = shortHash(minifiedJs);

  const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));

  let updated = 0;
  for (const file of htmlFiles) {
    const filePath = path.join(ROOT, file);
    const before = fs.readFileSync(filePath, 'utf-8');

    /* On ne touche qu'aux vraies références (href="..."/src="..."),
       jamais à une simple mention du nom du fichier dans un texte ou
       un commentaire. Reconnaît aussi bien l'ancien nom (style.css,
       main.js) que le nom minifié déjà en place, pour rester
       idempotent d'un passage à l'autre. */
    const after = before
      .replace(/(href=["'])style(?:\.min)?\.css(?:\?v=[^"']*)?(["'])/g, `$1style.min.css?v=${cssHash}$2`)
      .replace(/(src=["'])main(?:\.min)?\.js(?:\?v=[^"']*)?(["'])/g, `$1main.min.js?v=${jsHash}$2`)
      .replace(/(src=["'])admin\.js(?:\?v=[^"']*)?(["'])/g, `$1admin.js?v=${adminHash}$2`);

    if (after !== before) {
      fs.writeFileSync(filePath, after);
      updated++;
    }
  }

  console.log(`style.min.css -> v=${cssHash}, main.min.js -> v=${jsHash}, admin.js -> v=${adminHash} (${updated} page(s) mise(s) à jour)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
