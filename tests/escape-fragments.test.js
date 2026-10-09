/* Page publique du classement Escape Fragments. */
const { chromium } = require('playwright');
const { BASE, launchOpts } = require('./lib');
let pass = 0, fail = 0;
const check = (l, c) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + l); c ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch(launchOpts);
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const errs = [];
  async function open(site, api) {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(e.message));
    await page.route('**/data/site.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(site) }));
    await page.route('https://jeu.example.test/**', api);
    await page.goto(BASE + '/escape-fragments.html');
    await page.waitForTimeout(900);
    return page;
  }
  let p = await open({}, (r) => r.abort());
  check('sans serveur configuré : message d\'attente', (await p.textContent('#efBox')).includes('bientôt'));
  await p.close();

  p = await open({ escapeServerUrl: 'https://jeu.example.test/' }, (r) => r.fulfill({
    status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json',
    body: JSON.stringify({ top: [{ icone: '🕵️', display: '<img src=x onerror=alert(1)>', points: 120, victoires: 4, mvp: 2 }, { icone: '🔍', display: 'Zoé', points: 80, victoires: 2, mvp: 0 }, { display: 'Max', points: 'abc' }] }),
  }));
  check('podium + tableau rendus', await p.locator('.ef-pod').count() === 3 && await p.locator('.ef-table tbody tr').count() === 3);
  check('pseudo HTML échappé (pas d\'injection)', await p.locator('#efBox img').count() === 0);
  check('valeur non numérique ramenée à 0', (await p.locator('.ef-table tbody tr').nth(2).textContent()).includes('0'));
  check('lien vers le classement complet', (await p.getAttribute('#efFullLink', 'href')) === 'https://jeu.example.test/classement');
  await p.close();

  p = await open({ escapeServerUrl: 'https://jeu.example.test' }, (r) => r.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: 'x' }));
  await p.waitForTimeout(500);
  check('serveur en erreur : message clair', (await p.textContent('#efBox')).includes('indisponible'));
  await p.close();
  check('aucune erreur JS', errs.length === 0);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
