/* Audit du 18/11 (points 43 à 46, maquette validée) : tableau de score de l'accueil (une info = une place),
   prochain live calculé une seule fois (accueil = planning), clips lus au clic seulement et après accord,
   miniature copiée sur le site ou vignette dessinée, système commun (titres neutres, boutons 48 px).
   Lancé par run-all.js (copie temporaire du dépôt). */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { BASE, ROOT, launchOpts } = require('./lib');
const { nomFichier } = require(path.join(ROOT, 'scripts', 'miniatures-clips.js'));
let pass = 0, fail = 0;
const check = (l, c, info) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + l + (!c && info ? ' (' + info + ')' : '')); c ? pass++ : fail++; };

const fichiers = ['planning.json', 'planning-exceptions.json', 'twitch-status.json', 'clips.json', 'recent-games.json'];
const sauve = {};
for (const f of fichiers) { const p = path.join(ROOT, 'data', f); sauve[f] = fs.existsSync(p) ? fs.readFileSync(p) : null; }
const ecrire = (f, v) => fs.writeFileSync(path.join(ROOT, 'data', f), JSON.stringify(v));
const dateLocale = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

(async () => {
  const browser = await chromium.launch(launchOpts);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const tiers = [];
  await ctx.route(/twitch\.tv|youtube|ytimg|jtvnw/, (r) => { tiers.push(r.request().url()); r.fulfill({ status: 200, body: '' }); });
  await ctx.route(/gc\.zgo\.at/, (r) => r.fulfill({ status: 200, body: '' })); // mesure d'audience sans cookie, hors sujet ici
  const errs = [];
  async function ouvrir(url) {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(url + ' : ' + e.message));
    await p.goto(BASE + url);
    await p.waitForTimeout(500);
    return p;
  }
  try {
    // 44 + 43 : prochain live = changement ponctuel de demain, le même sur l'accueil et le planning
    const demain = new Date(); demain.setDate(demain.getDate() + 1);
    ecrire('planning.json', [{ day: 'Samedi', on: true, game: '7D2D', time: '21:00', end: '23:00', color: '#2ee6e0' }]);
    ecrire('planning-exceptions.json', [{ date: dateLocale(demain), on: true, game: 'Jeu exceptionnel' }]);
    ecrire('twitch-status.json', { _updated_at: new Date().toISOString(), aulit42369: { live: false, followers: 197 } });
    ecrire('recent-games.json', [{ game: 'Dice Hoarder', date: '2026-11-14' }]);
    let p = await ouvrir('/planning.html');
    check('planning : bloc « Prochain live » en tête', (await p.textContent('#planProchain')).includes('Jeu exceptionnel'));
    check('planning : « heure de Paris » et bouton Twitch', (await p.textContent('#planProchain')).includes('heure de Paris') && await p.locator('#planProchain a.btn-primary[href*="twitch.tv/aulit42369"]').count() === 1);
    check('planning : 7 jours, repos petits, jour de live mis en avant', await p.locator('.pl-jour').count() === 7 && await p.locator('.pl-jour.on').count() >= 1 && await p.locator('.pl-repos').count() >= 1);
    check('planning : calcul partagé avec l’accueil (window.prochainLive)', await p.evaluate(() => typeof window.prochainLive === 'function'));
    await p.close();
    p = await ouvrir('/');
    check('accueil : même prochain live que le planning', (await p.textContent('#sProchainQuand')).includes('Jeu exceptionnel'));
    check('accueil hors ligne : Abonnés · Dernier live · Prochain live, sans case Statut', await p.isVisible('#cDernier') && await p.isVisible('#cProchain') && await p.isHidden('#cStatut'));
    check('accueil : dernier live affiché', (await p.textContent('#sDernier')).includes('Dice Hoarder'));
    check('accueil : compte à rebours unique', await p.locator('#sCompte').count() === 1 && await p.locator('#vvCompte').count() === 0 && await p.locator('#nextLive').count() === 0);
    check('accueil : bloc vivant masqué hors live', await p.isHidden('#vivant'));
    check('accueil : 4 tuiles « univers » en h3', await p.locator('.sw-fam .sw-cardsite').count() === 4 && await p.locator('.sw-fam h3').count() === 4 && await p.locator('.sw-home h4').count() === 0);
    check('accueil : un seul bouton plein dans l’accroche', await p.locator('.sw-cta .sw-btn.primary').count() === 1 && !(await p.textContent('.sw-cta .sw-btn.primary')).includes('✦'));
    check('accueil : vidéo de présentation dans CAM 1 hors ligne', /video\/presentation-chaine\.mp4$/.test(await p.getAttribute('#camVideo', 'src') || ''));
    await p.close();
    ecrire('twitch-status.json', { _updated_at: new Date().toISOString(), aulit42369: { live: true, game: 'Jeu test', followers: 197, startedAt: new Date(Date.now() - 3600e3).toISOString() } });
    p = await ouvrir('/');
    check('accueil en live : Statut · Abonnés + bloc « Ce soir »', await p.isVisible('#cStatut') && await p.isHidden('#cDernier') && await p.isHidden('#cProchain') && await p.isVisible('#vivant'));
    await p.close();

    // 45 : clips au clic, après accord ; miniature copiée sinon vignette dessinée
    ecrire('clips.json', [
      { slug: 'SlugAvecMini', title: 'R.E.P.O. - Avec miniature', dateAdded: '2026-11-01' },
      { slug: 'SlugSansMini', title: 'Witchspire - Sans miniature', dateAdded: '2026-11-01' },
      { youtube: 'vrwc65V23sI', title: 'Killing Floor 3 : un Short', dateAdded: '2026-11-01' }]);
    const dossier = path.join(ROOT, 'img', 'clips');
    fs.mkdirSync(dossier, { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'og-image.jpg'), path.join(dossier, nomFichier('SlugAvecMini')));
    fs.writeFileSync(path.join(dossier, 'miniatures.json'), JSON.stringify({ SlugAvecMini: nomFichier('SlugAvecMini') }));
    tiers.length = 0;
    p = await ouvrir('/clips.html');
    check('clips : aucune requête tierce au chargement', tiers.length === 0, tiers.join(' '));
    check('clips : aucun lecteur avant clic', await p.locator('.clip-card iframe').count() === 0);
    check('clips : explication des cookies une seule fois', await p.locator('#clipsCookies').count() === 1 && await p.locator('.consent-ph').count() === 0);
    check('clips : miniature copiée affichée', await p.locator('.clip-card').nth(0).locator('img.clip-mini').count() === 1 && await p.evaluate(() => document.querySelector('img.clip-mini').naturalWidth > 0));
    check('clips : vignette dessinée sans miniature', await p.locator('.clip-card').nth(1).locator('img').count() === 0 && await p.locator('.clip-card').nth(1).locator('.vt-jeu').isVisible());
    check('clips : étiquettes Clip Twitch / Short YouTube', (await p.textContent('.clip-card:nth-child(1) .clip-pied')).includes('Clip Twitch') && (await p.textContent('.clip-card:nth-child(3) .clip-pied')).includes('Short YouTube'));
    await p.click('.clip-card:nth-child(2) .clip-play');
    check('clips sans accord : « Accepter et lire » ou « Regarder sur Twitch »', await p.locator('.clip-accord').isVisible() && await p.locator('.clip-accord a[href="https://clips.twitch.tv/SlugSansMini"]').count() === 1 && tiers.length === 0);
    await p.click('.clip-accord [data-consent="oui"]');
    await p.waitForTimeout(200);
    const src = await p.getAttribute('.clip-card:nth-child(2) iframe', 'src');
    check('accord : le clip demandé se lance, explication retirée', !!src && src.includes('clip=SlugSansMini') && await p.locator('#clipsCookies').count() === 0);
    check('accord : les autres clips restent des vignettes', await p.locator('.clip-card iframe').count() === 1);
    await p.click('.clip-card:nth-child(3) .clip-play');
    await p.waitForTimeout(100);
    check('Short : lecteur vertical au clic', (await p.getAttribute('.clip-card:nth-child(3) iframe', 'src') || '').includes('youtube-nocookie.com/embed/vrwc65V23sI') && await p.locator('.clip-card:nth-child(3) .clip-media.vertical').count() === 1);
    await p.close();
    check('miniatures : nom de fichier nettoyé', nomFichier('a/b..\\c-D_1') === 'abc-D_1.jpg');

    // 46 : titres neutres sauf le mot porteur ; boutons 48 px partout
    p = await ouvrir('/mentions-legales.html');
    const [h1, em] = await p.evaluate(() => [getComputedStyle(document.querySelector('h1')).color, getComputedStyle(document.querySelector('h1 em.accent')).color]);
    check('titres : mot en <em> neutre sans .porteur', h1 === em);
    await p.close();
    p = await ouvrir('/clips.html');
    const [h1b, emb] = await p.evaluate(() => [getComputedStyle(document.querySelector('h1')).color, getComputedStyle(document.querySelector('h1 em.porteur')).color]);
    check('titres : mot porteur en couleur', h1b !== emb);
    await p.close();
    for (const page of ['/', '/planning.html', '/streamers.html', '/coulisses.html', '/contact.html']) {
      p = await ouvrir(page);
      const hauteurs = await p.$$eval('.btn, .sw-btn', (els) => els.filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().height)));
      check(`boutons de ${page} : 48 px`, hauteurs.length > 0 && hauteurs.every((h) => h === 48));
      await p.close();
    }
    check('aucune erreur JS', errs.length === 0);
    if (errs.length) console.log(errs.join('\n'));
  } finally {
    await browser.close();
    for (const f of fichiers) { const p = path.join(ROOT, 'data', f); if (sauve[f]) fs.writeFileSync(p, sauve[f]); else if (fs.existsSync(p)) fs.unlinkSync(p); }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
