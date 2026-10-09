/* ================================================================
   Synchronise le menu STATIQUE (celui qu'on voit sans JavaScript, et
   avant que main.js ne s'exécute) de chaque page avec la liste unique
   CORE_PAGES de main.js.

     node scripts/sync-nav.js          réécrit les menus
     node scripts/sync-nav.js --check  échoue si un menu diffère
   ================================================================ */
const fs = require('fs');
const path = require('path');
const { ROOT, loadCorePages } = require('./registry');

const check = process.argv.includes('--check');
const pages = loadCorePages();
const menu = pages.filter((p) => p.menu && !p.last).concat(pages.filter((p) => p.menu && p.last));

function navFor(file) {
  const links = menu.map((p) => `      <a href="${p.file}"${p.file === file ? ' class="active"' : ''}>${p.label}</a>`).join('\n');
  return `<nav class="nav" id="nav">\n${links}\n    </nav>`;
}

let diffs = 0;
for (const p of pages) {
  const f = path.join(ROOT, p.file);
  if (!fs.existsSync(f)) {
    console.log(`(absent) ${p.file}`);
    continue;
  }
  const html = fs.readFileSync(f, 'utf8');
  const re = /<nav class="nav" id="nav">[\s\S]*?<\/nav>/;
  if (!re.test(html)) {
    console.error(`✗ ${p.file} : pas de <nav class="nav" id="nav">`);
    diffs++;
    continue;
  }
  const next = html.replace(re, navFor(p.file));
  if (next !== html) {
    diffs++;
    if (check) console.error(`✗ ${p.file} : menu statique différent de CORE_PAGES (lance node scripts/sync-nav.js)`);
    else {
      fs.writeFileSync(f, next);
      console.log(`↻ ${p.file} : menu mis à jour`);
    }
  }
}
if (check && diffs) process.exit(1);
console.log(check ? 'OK : tous les menus statiques correspondent à CORE_PAGES.' : `Terminé (${diffs} page(s) modifiée(s)).`);
