/* Page publique « Jeux » + onglet admin « Jeux ». */
const { chromium } = require('playwright');
const { BASE, launchOpts } = require('./lib');
const { installFakeGithub } = require('./fakegh');
let pass = 0, fail = 0;
const check = (l, c) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + l); c ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch(launchOpts);
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: 'block' });
  const errs = [];

  // ---- page publique : liste par défaut ----
  let p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/data/games.json*', (r) => r.fulfill({ status: 404, body: '' }));
  await p.goto(BASE + '/jeux.html'); await p.waitForTimeout(600);
  check('4 jeux par défaut affichés', await p.locator('.jx-card').count() === 4);
  check('noms LUMEN, ÉCHO, Résonance, Fragments', (await p.locator('.jx-name').allTextContents()).join('|') === 'LUMEN|ÉCHO|Résonance|Fragments');
  check('sans lien : « Lien bientôt disponible », pas de bouton', await p.locator('.jx-soon', { hasText: 'Lien bientôt' }).count() === 4 && await p.locator('.jx-card .btn-primary').count() === 0);
  check('guide d\'installation : 4 étapes', await p.locator('.jx-steps li').count() === 4);
  check('entrée « Jeux » active dans le menu', await p.locator('#nav a.active', { hasText: 'Jeux' }).count() === 1);
  await p.close();

  // ---- avec data/games.json : liens, statut, échappement ----
  p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/data/games.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ games: [
    { id: 'lumen', name: 'LUMEN', tagline: 'T', tags: 'A, B', description: 'Desc <b>x</b> *mot*', url: 'https://jeu.example.test/lumen/', playUrl: 'https://play.google.com/store/apps/details?id=x', status: 'jouable', accent: 'gold' },
    { id: 'x', name: 'Piégé', description: '', url: 'javascript:alert(1)', status: 'jouable' },
    { id: 'y', name: 'Futur', description: 'Bientôt', url: 'https://jeu.example.test/y/', status: 'bientot' },
  ] }) }));
  await p.goto(BASE + '/jeux.html'); await p.waitForTimeout(600);
  check('liste du fichier utilisée (3 cartes)', await p.locator('.jx-card').count() === 3);
  check('bouton Jouer avec le bon lien, nouvel onglet sûr', (await p.locator('.jx-card').first().locator('.btn-primary').getAttribute('href')) === 'https://jeu.example.test/lumen/' && (await p.locator('.jx-card').first().locator('.btn-primary').getAttribute('rel')) === 'noopener');
  check('bouton Google Play présent quand renseigné', await p.locator('.jx-card').first().locator('.btn-secondary').count() === 1);
  check('description échappée + *mot* en couleur', (await p.locator('.jx-desc').first().innerHTML()).includes('&lt;b&gt;x&lt;/b&gt;') && (await p.locator('.jx-desc').first().innerHTML()).includes('<em class="accent">mot</em>'));
  check('lien javascript: refusé', await p.locator('.jx-card').nth(1).locator('a.btn-primary').count() === 0);
  check('statut « bientôt » : pas de bouton jouer', await p.locator('.jx-card').nth(2).locator('.btn-primary').count() === 0 && (await p.locator('.jx-card').nth(2).textContent()).includes('Bientôt disponible'));
  await p.close();

  // ---- admin ----
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(e.message));
  let accept = true; page.on('dialog', (d) => (accept ? d.accept() : d.dismiss()));
  const gh = await installFakeGithub(page);
  await page.addInitScript(() => { try { localStorage.setItem('aulit_admin_token', 'fake'); } catch (e) { /* iframe */ } });
  await page.goto(BASE + '/admin.html');
  await page.waitForFunction(() => !document.getElementById('statusMsg').classList.contains('show'), null, { timeout: 10000 });
  await page.click('[data-tab="jeux"]');
  check('admin : 4 jeux par défaut listés (fichier absent)', await page.locator('#jeuxEditor details').count() === 4);
  await page.locator('#jeuxEditor details').first().locator('summary').click();
  await page.locator('[data-gi="0"][data-gf="url"]').fill('http://pas-https.test');
  await page.click('#saveJeuxBtn'); await page.waitForTimeout(200);
  check('admin : adresse non https refusée', await page.isVisible('#statusMsg.err') && !gh.puts.some((x) => x.p === 'data/games.json'));
  await page.locator('[data-gi="0"][data-gf="url"]').fill('https://jeu.example.test/lumen/');
  await page.locator('[data-gi="0"][data-gf="status"]').selectOption('bientot');
  await page.click('#addJeuBtn');
  await page.locator('[data-gi="4"][data-gf="name"]').fill('Nouveau Jeu Été');
  await page.click('[data-jact="up"][data-gi="4"]'); await page.waitForTimeout(100);
  await page.keyboard.press('Control+s'); await page.waitForTimeout(400);
  const w = gh.puts.find((x) => x.p === 'data/games.json');
  check('admin : fichier games.json écrit (schemaVersion, 5 jeux)', w && w.obj.schemaVersion === 1 && w.obj.games.length === 5);
  check('admin : lien, statut et ordre enregistrés', w && w.obj.games[0].url === 'https://jeu.example.test/lumen/' && w.obj.games[0].status === 'bientot' && w.obj.games[3].name === 'Nouveau Jeu Été' && w.obj.games[3].id === 'nouveau-jeu-ete');
  await page.click('[data-tab="historique"]'); await page.waitForTimeout(300);
  check('admin : « Jeux » dans l\'historique', (await page.locator('#histFile option').allTextContents()).includes('Jeux'));
  check('aucune erreur JS', errs.length === 0);
  if (errs.length) console.log(errs);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
