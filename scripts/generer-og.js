// Régénère les images d'aperçu (og:image, 1200×630) au style du site depuis scripts/og/modele.html.
// Usage : node scripts/generer-og.js (Playwright des tests : cd tests && npm install si absent). Après, monter OG_V dans les pages.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'tests', 'node_modules', 'playwright'));

const RACINE = path.join(__dirname, '..');
const S = '<span class="m">✦</span>';
const IMAGES = [
  { fichiers: ['og-image.jpg', 'og-image.png'], sur: `${S} Multigaming · Streamer Twitch francophone`, titre: 'Aulit42369', sous: 'Jeux coop entre potes · planning des lives · clips · Discord' },
  { fichiers: ['og/planning-og.png'], sur: `Aulit42369 ${S}`, titre: 'Planning', sous: 'Les prochains lives, jour par jour' },
  { fichiers: ['og/clips-og.png'], sur: `Aulit42369 ${S}`, titre: 'Clips', sous: 'Les meilleurs moments du stream' },
  { fichiers: ['og/coulisses-og.png'], sur: `Aulit42369 ${S}`, titre: 'Coulisses', sous: 'Les outils et systèmes derrière le stream' },
  { fichiers: ['og/streamers-og.png'], sur: `Aulit42369 ${S}`, titre: 'Streamers', sous: 'Les chaînes amies à découvrir' },
  { fichiers: ['og/apropos-og.png'], sur: `Aulit42369 ${S}`, titre: 'À propos', sous: 'Qui se cache derrière la chaîne' },
  { fichiers: ['og/contact-og.png'], sur: `Aulit42369 ${S}`, titre: 'Contact', sous: 'Partenariat, question ou idée : écris-moi' },
];

(async () => {
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage({ viewport: { width: 1200, height: 630 } });
  for (const im of IMAGES) {
    const q = new URLSearchParams({ sur: im.sur, titre: im.titre, sous: im.sous });
    await page.goto('file:///' + path.join(__dirname, 'og', 'modele.html').replace(/\\/g, '/') + '?' + q);
    await page.evaluate(() => document.fonts.ready);
    for (const f of im.fichiers) {
      const jpg = f.endsWith('.jpg');
      await page.screenshot({ path: path.join(RACINE, f), type: jpg ? 'jpeg' : 'png', ...(jpg ? { quality: 88 } : {}) });
      console.log('ok', f);
    }
  }
  await navigateur.close();
})();
