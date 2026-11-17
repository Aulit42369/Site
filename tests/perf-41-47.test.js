/* Audit 41 et 47 (17/11) : place réservée (CLS), petites photos Twitch, images de partage en JPEG,
   pas de flou au téléphone, animations en boucle en pause hors de l'écran. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { BASE, ROOT, launchOpts } = require('./lib');
let pass = 0, fail = 0;
const check = (l, c) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + l); c ? pass++ : fail++; };
const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

(async () => {
  // images de partage : JPEG existant + balises complètes sur chaque page qui en a une
  for (const f of fs.readdirSync(ROOT).filter((n) => n.endsWith('.html'))) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const m = /property="og:image" content="https:\/\/aulit42369\.fr\/Site\/([^"?]+)/.exec(s);
    if (!m) continue;
    check(f + ' : og:image en JPEG présent', m[1].endsWith('.jpg') && fs.existsSync(path.join(ROOT, m[1])));
    check(f + ' : largeur, hauteur, alt, site_name, locale', ['og:image:width" content="1200', 'og:image:height" content="630', 'og:image:alt', 'og:site_name', 'og:locale" content="fr_FR'].every((k) => s.includes(k)));
  }

  const browser = await chromium.launch(launchOpts);
  const errs = [];
  const nouvelle = async (w, opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: w > 500 ? 900 : 844 }, isMobile: w <= 500, hasTouch: w <= 500, ...opts });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    return p;
  };
  const clsDe = (p) => p.evaluate(() => window.__cls);
  const ecouteCls = (p) => p.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });

  // CLS : données lentes (700 ms), la page ne doit pas sauter à leur arrivée
  for (const w of [1440, 390]) {
    for (const pg of ['jeux', 'streamers', 'clips', 'planning']) {
      const p = await nouvelle(w);
      await p.route('**/data/*.json*', async (r) => { await new Promise((ok) => setTimeout(ok, 700)); r.continue(); });
      await ecouteCls(p);
      await p.goto(BASE + '/' + pg + '.html'); await p.waitForTimeout(1800);
      const cls = await clsDe(p);
      check(`${pg} à ${w} px : CLS ${cls.toFixed(3)} ≤ 0,1`, cls <= 0.1);
      await p.context().close();
    }
  }

  // photos Twitch : 70x70 (écran normal), 150x150 (écran dense), retour à l'originale si la petite manque
  const AV = 'https://static-cdn.jtvnw.net/jtv_user_pictures/abc-profile_image-300x300.png';
  for (const [dpr, taille, absente] of [[1, '70x70', false], [2, '150x150', false], [1, '70x70', true]]) {
    const p = await nouvelle(1440, { deviceScaleFactor: dpr });
    const demandes = [];
    await p.route('**/data/streamers.json*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify([{ name: 'Test', url: 'https://twitch.tv/test', description: 'd' }]) }));
    await p.route('**/data/twitch-status.json*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ test: { avatar: AV, live: false } }) }));
    await p.route('https://static-cdn.jtvnw.net/**', (r) => { demandes.push(r.request().url()); return absente && !r.request().url().includes('300x300') ? r.fulfill({ status: 404, body: '' }) : r.fulfill({ contentType: 'image/png', body: PNG1 }); });
    await p.goto(BASE + '/streamers.html'); await p.waitForTimeout(900);
    const fond = await p.$eval('.streamer-avatar', (e) => e.style.backgroundImage);
    if (absente) check('petite photo absente : photo d\'origine affichée', fond.includes('300x300') && demandes.some((u) => u.includes('70x70')));
    else check(`écran x${dpr} : photo ${taille} demandée et affichée`, fond.includes(taille) && !demandes.some((u) => u.includes('300x300')));
    await p.context().close();
  }

  // flou : aucun au téléphone, toujours là sur ordinateur
  const flous = (p) => p.evaluate(() => [...document.querySelectorAll('*')].filter((e) => { const c = getComputedStyle(e); return (c.backdropFilter || 'none') !== 'none'; }).length);
  for (const pg of ['index', 'coulisses', 'planning']) {
    const m = await nouvelle(390); await m.goto(BASE + '/' + pg + '.html'); await m.waitForTimeout(500);
    check(pg + ' au téléphone : aucun flou', (await flous(m)) === 0);
    await m.context().close();
    const d = await nouvelle(1440); await d.goto(BASE + '/' + pg + '.html'); await d.waitForTimeout(500);
    check(pg + ' sur ordinateur : verre dépoli conservé', (await flous(d)) > 0);
    await d.context().close();
  }

  // animations en boucle : en pause hors de l'écran, actives à l'écran
  const p = await nouvelle(1440);
  await p.goto(BASE + '/coulisses.html'); await p.waitForTimeout(800);
  const etat = () => p.evaluate(() => {
    const vis = (el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.bottom > 0 && b.top < innerHeight; };
    const a = document.getAnimations().filter((x) => x.effect.getTiming().iterations === Infinity);
    return { n: a.length, horsEcranActives: a.filter((x) => x.playState === 'running' && !vis(x.effect.target)).length, visiblesEnPause: a.filter((x) => x.playState !== 'running' && vis(x.effect.target)).length };
  });
  let e = await etat();
  check(`coulisses : ${e.n} animations en boucle, aucune active hors de l'écran`, e.n > 10 && e.horsEcranActives === 0);
  await p.mouse.wheel(0, 2600); await p.waitForTimeout(700);
  e = await etat();
  check('après défilement : celles à l\'écran repartent, les autres en pause', e.visiblesEnPause === 0 && e.horsEcranActives === 0);
  await p.context().close();

  check('aucune erreur JS', errs.length === 0);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
