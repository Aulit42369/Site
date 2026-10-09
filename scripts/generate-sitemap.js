/* ================================================================
   Génère sitemap.xml depuis la liste des pages (main.js) + les pages
   personnalisées créées dans l'admin (data/custom-pages.json).

     node scripts/generate-sitemap.js          réécrit sitemap.xml
     node scripts/generate-sitemap.js --check  échoue s'il est périmé
   ================================================================ */
const fs = require('fs');
const path = require('path');
const { ROOT, loadCorePages, loadCustomPages } = require('./registry');

const BASE = 'https://aulit42369.github.io/Site/';
const META = {
  'index.html': ['weekly', '1.0'], 'planning.html': ['weekly', '0.8'], 'clips.html': ['weekly', '0.7'],
  'streamers.html': ['weekly', '0.6'], 'coulisses.html': ['monthly', '0.6'], 'apropos.html': ['monthly', '0.5'],
  'contact.html': ['monthly', '0.5'], 'escape-fragments.html': ['weekly', '0.6'],
};

const entries = [];
for (const p of loadCorePages()) {
  if (p.sitemap === false || p.generic) continue;
  if (!fs.existsSync(path.join(ROOT, p.file))) continue;
  const [freq, prio] = META[p.file] || ['monthly', '0.5'];
  entries.push([BASE + p.file, freq, prio]);
}
for (const c of loadCustomPages()) entries.push([BASE + 'page.html?p=' + c.slug, 'monthly', '0.5']);

const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  entries.map(([loc, f, pr]) => `  <url>\n    <loc>${loc.replace(/&/g, '&amp;')}</loc>\n    <changefreq>${f}</changefreq>\n    <priority>${pr}</priority>\n  </url>`).join('\n') +
  '\n</urlset>\n';

const target = path.join(ROOT, 'sitemap.xml');
const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
if (process.argv.includes('--check')) {
  if (current !== xml) {
    console.error('✗ sitemap.xml est périmé (lance node scripts/generate-sitemap.js)');
    process.exit(1);
  }
  console.log('OK : sitemap.xml à jour.');
} else {
  if (current !== xml) fs.writeFileSync(target, xml);
  console.log(current !== xml ? 'sitemap.xml régénéré.' : 'sitemap.xml déjà à jour.');
}
