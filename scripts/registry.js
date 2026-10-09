/* ================================================================
   Lit la liste des pages (CORE_PAGES) directement dans main.js, pour
   que les scripts de vérification et de génération utilisent EXACTEMENT
   la même liste que le site — une seule source de vérité.
   ================================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function loadCorePages() {
  const src = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  const m = src.match(/const CORE_PAGES = (\[[\s\S]*?\n\]);/);
  if (!m) throw new Error('CORE_PAGES introuvable dans main.js');
  // eslint-disable-next-line no-new-func
  return new Function('return ' + m[1])();
}

function loadCustomPages() {
  const f = path.join(ROOT, 'data', 'custom-pages.json');
  if (!fs.existsSync(f)) return [];
  try {
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    return Array.isArray(d.pages) ? d.pages.filter((p) => p && p.published !== false && /^[a-z0-9-]{1,60}$/.test(p.slug || '') && p.title) : [];
  } catch (e) {
    return [];
  }
}

module.exports = { ROOT, loadCorePages, loadCustomPages };
