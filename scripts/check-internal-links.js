/* ================================================================
   Vérifie que tous les liens internes (href="...html") des pages du
   site pointent vers un fichier qui existe réellement dans le
   dépôt. Ignore les liens externes (http/https), mailto:, tel:,
   javascript:, les ancres pures (#section) et les data:.

   Sert de garde-fou : si une page est renommée ou supprimée sans
   mettre à jour tous les liens qui pointaient dessus, ce script
   échoue avec la liste précise des liens cassés, plutôt que de
   laisser un visiteur tomber sur une 404 silencieuse une fois le
   site publié.

   Lancé par .github/workflows/check-links.yml à chaque push qui
   touche un fichier .html (et à la demande via workflow_dispatch).
   ================================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* Liens qu'il est inutile (ou faux) de vérifier comme un fichier du
   dépôt : externes, ancres pures sur la page courante, protocoles
   spéciaux. Tout le reste est considéré comme un lien interne. */
function isExternalOrSpecial(href) {
  if (!href) return true;
  if (/^(https?:)?\/\//i.test(href)) return true; // externe, avec ou sans protocole explicite
  if (/^(mailto|tel|data|javascript):/i.test(href)) return true;
  if (href.startsWith('#')) return true; // ancre pure sur la page courante
  return false;
}

function main() {
  const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
  const knownFiles = new Set(htmlFiles);

  const errors = [];

  for (const file of htmlFiles) {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf-8');
    const hrefRegex = /href=["']([^"']+)["']/g;
    let match;
    while ((match = hrefRegex.exec(content)) !== null) {
      const href = match[1];
      if (isExternalOrSpecial(href)) continue;

      // Seuls les liens vers une page .html du site nous concernent ici
      // (on ignore images, CSS, JSON, gabarits JS type ${...}, etc.)
      if (!/\.html($|[?#])/i.test(href)) continue;

      // Sépare le nom de fichier de tout ?query ou #ancre éventuel
      const targetFile = href.split(/[?#]/)[0];

      if (!knownFiles.has(targetFile)) {
        errors.push(`${file} -> "${href}" (fichier "${targetFile}" introuvable)`);
      }
    }
  }

  if (errors.length) {
    console.error(`${errors.length} lien(s) interne(s) cassé(s) détecté(s) :\n`);
    for (const err of errors) console.error('  - ' + err);
    process.exit(1);
  }

  console.log(`OK : tous les liens internes (${htmlFiles.length} pages passées en revue) pointent vers une page existante.`);
}

main();
