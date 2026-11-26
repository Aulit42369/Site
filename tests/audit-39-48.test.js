/* Audit du 17/11 (points 39, 42, 48) : planning dans l'ordre depuis aujourd'hui, heures « 21 h »,
   « 7 Days to Die », pastille « À l'antenne » seulement en live, Échap sur le menu mobile, lien Discord
   du menu, 404 utile, chiffres du kit média masqués, accord « victoire(s) », sommaire collant des Coulisses.
   Lancé par run-all.js (copie temporaire du dépôt). */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { BASE, ROOT, launchOpts } = require('./lib');
let pass = 0, fail = 0;
const check = (l, c) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + l); c ? pass++ : fail++; };

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const fichiers = ['planning.json', 'planning-exceptions.json', 'twitch-status.json', 'pages.json'];
const sauve = {};
for (const f of fichiers) { const p = path.join(ROOT, 'data', f); sauve[f] = fs.existsSync(p) ? fs.readFileSync(p) : null; }
const ecrire = (f, v) => fs.writeFileSync(path.join(ROOT, 'data', f), JSON.stringify(v));

(async () => {
  const browser = await chromium.launch(launchOpts);
  const errs = [];
  async function ouvrir(url, largeur = 1440) {
    const p = await browser.newPage({ viewport: { width: largeur, height: 900 } });
    p.on('pageerror', (e) => errs.push(url + ' : ' + e.message));
    await p.goto(BASE + url);
    await p.waitForTimeout(400);
    return p;
  }
  try {
    // 39a + 48 : grille du planning depuis aujourd'hui, 7 jours dans l'ordre ; « 21 h » ; 7D2D affiché en entier
    ecrire('planning.json', ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map((day) => (
      { day, on: true, game: day === 'Samedi' ? '7D2D' : 'Jeu ' + day, time: '21:00', end: day === 'Mardi' ? '23:30' : '', color: '#2ee6e0' })));
    ecrire('planning-exceptions.json', []);
    let p = await ouvrir('/planning.html');
    const jours = await p.$$eval('.pl-j-nom', (els) => els.map((e) => e.textContent.trim()));
    const auj = new Date().getDay();
    check('planning : commence aujourd’hui et suit les 7 jours', JSON.stringify(jours) === JSON.stringify([0, 1, 2, 3, 4, 5, 6].map((i) => JOURS[(auj + i) % 7])));
    check('planning : badge « Aujourd’hui » sur la 1re carte', await p.locator('.pl-jour').first().locator('.pl-auj').count() === 1 && await p.locator('.pl-auj').count() === 1);
    const grille = await p.textContent('#planningGrid');
    check('planning : heures en « 21 h » et « 23 h 30 »', grille.includes('À partir de 21 h') && grille.includes('21 h – 23 h 30') && !grille.includes('21:00'));
    check('planning : 7D2D affiché « 7 Days to Die »', grille.includes('7 Days to Die') && !grille.includes('7D2D'));
    await p.close();

    // 39b : pastille du bandeau défilant
    ecrire('twitch-status.json', { _updated_at: new Date().toISOString(), aulit42369: { live: false, followers: 10 } });
    p = await ouvrir('/');
    check('accueil hors ligne : pas de « À l’antenne »', (await p.textContent('#tickerOnair')).trim() === 'En bref');
    check('accueil : prochain live en « 21 h »', /\b21 h\b/.test(await p.textContent('#sProchainQuand')));
    await p.close();
    ecrire('twitch-status.json', { _updated_at: new Date().toISOString(), aulit42369: { live: true, game: 'Jeu test', followers: 10 } });
    p = await ouvrir('/');
    check('accueil en live : « À l’antenne »', (await p.textContent('#tickerOnair')).trim() === 'À l’antenne');
    await p.close();

    // 39c + 42 : menu mobile, Échap, lien Discord en bas du menu
    p = await ouvrir('/planning.html', 390);
    await p.click('#navToggle');
    check('menu mobile : lien Discord en dernier', await p.locator('#nav a:last-child.nav-discord').isVisible());
    await p.keyboard.press('Escape');
    check('menu mobile : Échap le ferme', !(await p.evaluate(() => document.body.classList.contains('nav-open'))) && (await p.getAttribute('#navToggle', 'aria-expanded')) === 'false');
    check('menu mobile : focus rendu au bouton', await p.evaluate(() => document.activeElement.id === 'navToggle'));
    await p.close();
    p = await ouvrir('/planning.html');
    const d = await p.locator('#nav .nav-discord').boundingBox();
    check('ordinateur : lien Discord discret à droite du menu', !!d && d.width < 60 && d.x > 1000);
    await p.close();

    // 39h : 404 utile
    p = await ouvrir('/404.html');
    check('404 : liens Planning et Clips', await p.locator('main a[href="planning.html"]').count() === 1 && await p.locator('main a[href="clips.html"]').count() === 1);
    await p.close();

    // 48 : chiffres du kit média masqués tant qu'ils sont « À venir »
    ecrire('pages.json', { texts: {} });
    p = await ouvrir('/partenaires.html');
    check('kit média : bloc d’audience masqué sans chiffres', !(await p.isVisible('#kitAudience')));
    await p.close();
    ecrire('pages.json', { texts: { 'partenaires.s2': '35' } });
    p = await ouvrir('/partenaires.html');
    check('kit média : bloc affiché dès qu’un chiffre est saisi', await p.isVisible('#kitAudience'));
    await p.close();

    // 39d : accord « 1 victoire » / « 2 victoires »
    p = await browser.newPage();
    p.on('pageerror', (e) => errs.push('escape : ' + e.message));
    await p.route('https://escape-fragments.onrender.com/**', (r) => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json',
      body: JSON.stringify({ top: [{ display: 'A', points: 9, victoires: 2 }, { display: 'B', points: 5, victoires: 1 }] }) }));
    await p.goto(BASE + '/escape-fragments.html');
    await p.waitForTimeout(800);
    const podium = await p.textContent('.ef-podium');
    check('escape : « 1 victoire » et « 2 victoires »', podium.includes('1 victoire') && !podium.includes('1 victoires') && podium.includes('2 victoires'));
    await p.close();

    // 48 : sommaire collant des Coulisses sur téléphone
    p = await ouvrir('/coulisses.html', 390);
    check('coulisses : bouton « Sommaire » caché en haut de page', !(await p.isVisible('.toc-bouton')));
    await p.evaluate(() => window.scrollTo(0, 3000));
    await p.waitForTimeout(300);
    check('coulisses : bouton « Sommaire » visible après défilement', await p.isVisible('.toc-bouton'));
    await p.click('.toc-bouton');
    check('coulisses : le panneau liste les 23 projets', await p.locator('#tocPanneau a').count() === 23 && await p.isVisible('#tocPanneau'));
    await p.keyboard.press('Escape');
    check('coulisses : Échap ferme le panneau', !(await p.isVisible('#tocPanneau')));
    await p.close();
    p = await ouvrir('/coulisses.html');
    await p.evaluate(() => window.scrollTo(0, 3000));
    await p.waitForTimeout(300);
    check('coulisses : pas de bouton « Sommaire » sur ordinateur', !(await p.isVisible('.toc-bouton')));
    await p.close();

    check('aucune erreur JavaScript', errs.length === 0);
    if (errs.length) console.log(errs.join('\n'));
  } finally {
    for (const f of fichiers) {
      const p = path.join(ROOT, 'data', f);
      if (sauve[f]) fs.writeFileSync(p, sauve[f]); else if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    await browser.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
