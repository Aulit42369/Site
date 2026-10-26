/* Checklist de mise en ligne (25/10) : consentement aux lecteurs Twitch,
   liens légaux du pied de page, formulaire de contact (validation +
   anti-spam), pas de débordement horizontal à 360 px. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { BASE, ROOT, launchOpts } = require('./lib');

let pass = 0, fail = 0;
const check = (l, c) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + l); c ? pass++ : fail++; };

const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && f !== 'admin.html' && f !== '404.html');

(async () => {
  const browser = await chromium.launch(launchOpts);
  const ctx = await browser.newContext();
  // aucun appel réseau réel vers Twitch / GoatCounter / Formspree pendant les tests
  const twitchHits = [];
  let formspreeHits = 0;
  await ctx.route(/player\.twitch\.tv|clips\.twitch\.tv/, (r) => { twitchHits.push(r.request().url()); r.fulfill({ status: 200, body: '' }); });
  await ctx.route(/gc\.zgo\.at/, (r) => r.fulfill({ status: 200, body: '' }));
  await ctx.route(/formspree\.io/, (r) => { formspreeHits++; r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });

  try {
    // ---- 1. Consentement : rien de Twitch avant accord ----
    let p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE + '/index.html');
    await p.waitForTimeout(300);
    check('index : lecteur Twitch non chargé avant accord', !(await p.getAttribute('.broadcast-frame iframe', 'src')) && twitchHits.length === 0);
    check('index : remplaçant affiché à la place du lecteur', await p.locator('.consent-ph').isVisible());
    check('index : bandeau de choix affiché', await p.locator('#consentBar').isVisible());
    await p.click('#consentBar [data-consent="non"]');
    check('refus : bandeau fermé, lecteur toujours absent', (await p.locator('#consentBar').count()) === 0 && twitchHits.length === 0);
    await p.reload();
    await p.waitForTimeout(200);
    check('refus mémorisé : pas de bandeau au rechargement', (await p.locator('#consentBar').count()) === 0);
    await p.click('.site-footer [data-consent-open]');
    check('bouton « Cookies » du pied de page rouvre le choix', await p.locator('#consentBar').isVisible());
    await p.click('#consentBar [data-consent="oui"]');
    await p.waitForTimeout(200);
    const src = await p.getAttribute('.broadcast-frame iframe', 'src');
    check('accord : lecteur chargé, remplaçant retiré', !!src && src.includes('player.twitch.tv') && (await p.locator('.consent-ph').count()) === 0);
    check('aucune erreur JS (index)', errs.length === 0);
    // choix daté : redemandé après 6 mois, et un choix sans date (ancien) aussi
    check('accord daté', !!(await p.evaluate(() => localStorage.getItem('aulit_consent_date'))));
    await p.evaluate(() => localStorage.setItem('aulit_consent_date', String(Date.now() - 200 * 24 * 3600 * 1000)));
    await p.reload();
    await p.waitForTimeout(200);
    check('choix de plus de 6 mois : bandeau redemandé', await p.locator('#consentBar').isVisible());
    await p.evaluate(() => localStorage.removeItem('aulit_consent_date'));
    await p.reload();
    await p.waitForTimeout(200);
    check('choix sans date : bandeau redemandé', await p.locator('#consentBar').isVisible());
    // opposition à GoatCounter (skipgc lu par count.v4.js)
    await p.goto(BASE + '/confidentialite.html');
    await p.click('[data-gc-toggle]');
    check('« Ne pas être compté » écrit skipgc=t', (await p.evaluate(() => localStorage.getItem('skipgc'))) === 't'
      && (await p.textContent('[data-gc-toggle]')).includes('de nouveau'));
    await p.click('[data-gc-toggle]');
    check('« Être compté de nouveau » retire skipgc', (await p.evaluate(() => localStorage.getItem('skipgc'))) === null);
    await p.close();

    // ---- 2. Pied de page : liens légaux sur toutes les pages ----
    p = await ctx.newPage();
    for (const f of PAGES.concat('404.html')) {
      await p.goto(BASE + '/' + f);
      const hrefs = await p.$$eval('.site-footer .legal-links a', (a) => a.map((x) => x.getAttribute('href')));
      const ok = ['mentions-legales.html', 'confidentialite.html', 'cgu.html'].every((h) => hrefs.includes(h))
        && (await p.locator('.site-footer [data-consent-open]').count()) === 1;
      check(f + ' : liens Mentions / Confidentialité / CGU / Cookies', ok);
    }
    await p.close();

    // ---- 3. Pas de débordement horizontal à 360 px ----
    p = await ctx.newPage({ viewport: { width: 360, height: 740 } });
    for (const f of PAGES) {
      await p.goto(BASE + '/' + f);
      await p.waitForTimeout(150);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(f + ' : pas de défilement horizontal à 360 px', over <= 0);
    }
    await p.close();

    // ---- 4. Formulaire de contact ----
    p = await ctx.newPage();
    await p.goto(BASE + '/contact.html');
    await p.click('#contactForm button[type="submit"]');
    const msg = await p.$eval('#name', (el) => el.validationMessage);
    check('contact : message d’erreur en français', msg === 'Indique ton nom ou ton pseudo.');
    await p.fill('#name', 'Testeur');
    await p.fill('#email', 'test@exemple.fr');
    await p.fill('#message', 'Bonjour, ceci est un test.');
    await p.click('#contactForm button[type="submit"]');
    await p.waitForTimeout(200);
    check('contact : envoi trop rapide (robot) → rien n’est envoyé', formspreeHits === 0 && await p.locator('#successBox').isVisible());
    await p.close();

    p = await ctx.newPage();
    await p.goto(BASE + '/contact.html');
    await p.fill('#name', 'Testeur');
    await p.fill('#email', 'test@exemple.fr');
    await p.fill('#message', 'Bonjour, ceci est un test.');
    await p.waitForTimeout(3100);
    await p.click('#contactForm button[type="submit"]');
    await p.waitForTimeout(300);
    check('contact : envoi humain → transmis à Formspree', formspreeHits === 1 && await p.locator('#successBox').isVisible());
    await p.close();
  } finally {
    await browser.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
