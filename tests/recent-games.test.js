/* « Récemment sur la chaîne » : chaque jeu n'apparaît qu'une fois. */
const { chromium } = require('playwright');
const { BASE, launchOpts } = require('./lib');
let pass = 0, fail = 0;
const check = (l, c) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + l); c ? pass++ : fail++; };
(async () => {
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.route('**/data/recent-games.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
    { game: 'Brotato', date: '2026-10-02' }, { game: 'Graveyard Keeper II', date: '2026-10-01' }, { game: 'Carnaval Marbles', date: '2026-09-30' },
    { game: 'Just Chatting', date: '2026-09-29' }, { game: 'brotato ', date: '2026-09-28' }, { game: 'R.E.P.O.', date: '2026-09-27' }, { game: 'Graveyard Keeper II', date: '2026-09-26' },
  ]) }));
  await page.goto(BASE + '/apropos.html'); await page.waitForTimeout(600);
  const tags = (await page.locator('#recentGamesList .game-tag').allTextContents()).map((t) => t.trim());
  check('5 jeux distincts affichés', tags.length === 5);
  check('ordre conservé, premier exemplaire gardé', tags.join('|') === 'Brotato|Graveyard Keeper II|Carnaval Marbles|Just Chatting|R.E.P.O.');
  check('aucune erreur JS', errs.length === 0);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
