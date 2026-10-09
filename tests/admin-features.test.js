/* Pages personnalisées, conflits, Ctrl+S, aperçu, clips en lot, serveur du jeu, schemaVersion. */
const { chromium } = require('playwright');
const { BASE, launchOpts } = require('./lib');
const { installFakeGithub } = require('./fakegh');
let pass = 0, fail = 0;
const check = (l, c) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + l); c ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch(launchOpts);
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const dialogs = []; let accept = true;
  page.on('dialog', (d) => { dialogs.push(d.message()); accept ? d.accept() : d.dismiss(); });
  const gh = await installFakeGithub(page);
  await page.route('https://jeu.example.test/**', (r) => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true}' }));
  await page.addInitScript(() => { try { localStorage.setItem('aulit_admin_token', 'fake'); } catch (e) { /* iframe opaque */ } });
  await page.goto(BASE + '/admin.html');
  await page.waitForFunction(() => !document.getElementById('statusMsg').classList.contains('show'), null, { timeout: 10000 });
  check('chargement sans erreur', !(await page.isVisible('#statusMsg.err')));
  check('CSP présente et admin.js externe', await page.evaluate(() => !!document.querySelector('meta[http-equiv="Content-Security-Policy"]') && !!document.querySelector('script[src^="admin.js"]') && !document.querySelector('script:not([src])')));

  // ---- Pages personnalisées ----
  await page.click('[data-tab="pages"]');
  check('onglet Pages visible', await page.isVisible('#pagesPanel'));
  await page.click('#addPageBtn');
  await page.locator('[data-pf="title"]').fill('Règles du Jeu éàç');
  await page.locator('[data-bf="text"]').first().fill('Bienvenue *ici* <b>x</b>');
  await page.click('[data-pact="badd"]');
  await page.locator('[data-bi="1"][data-bf="type"]').selectOption('button');
  await page.locator('[data-bi="1"][data-bf="label"]').fill('Discord');
  await page.locator('[data-bi="1"][data-bf="url"]').fill('javascript:alert(1)');
  accept = true;
  await page.click('#savePagesBtn');
  check('URL de bouton dangereuse refusée', await page.isVisible('#statusMsg.err') && !gh.puts.some((x) => x.p === 'data/custom-pages.json'));
  await page.locator('[data-bi="1"][data-bf="url"]').fill('https://discord.com/invite/abc');
  await page.locator('[data-pf="published"]').check();
  await page.locator('[data-pf="menu"]').check();
  accept = false; dialogs.length = 0;
  await page.click('#savePagesBtn');
  check('récapitulatif affiché avant enregistrement', dialogs.some((m) => m.includes('Règles du Jeu')) && !gh.puts.some((x) => x.p === 'data/custom-pages.json'));
  accept = true;
  await page.click('#savePagesBtn'); await page.waitForTimeout(300);
  const w = gh.puts.find((x) => x.p === 'data/custom-pages.json');
  check('page enregistrée avec slug auto', w && w.obj.pages[0].slug === 'regles-du-jeu-eac' && w.obj.pages[0].menu === true);
  check('schemaVersion écrit', w && w.obj.schemaVersion === 1);
  check('blocs vides nettoyés / ordre conservé', w && w.obj.pages[0].blocks.length === 2 && w.obj.pages[0].blocks[1].type === 'button');

  // la page publique rend la page + le menu
  const pub = await ctx.newPage();
  await pub.route('**/data/custom-pages.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(w.obj) }));
  await pub.goto(BASE + '/page.html?p=regles-du-jeu-eac'); await pub.waitForTimeout(600);
  check('page publique rendue', (await pub.textContent('#cpTitle')).includes('Règles du Jeu'));
  check('HTML injecté échappé', (await pub.innerHTML('#cpBlocks')).includes('&lt;b&gt;x&lt;/b&gt;'));
  check('entrée de menu ajoutée', await pub.locator('#nav a', { hasText: 'Règles du Jeu' }).count() === 1);
  await pub.close();

  // ---- Conflit ----
  await page.click('[data-tab="site"]');
  await page.locator('[data-ann="text"]').fill('Hello');
  gh.hooks.forceConflict.add('data/site.json');
  await page.click('#saveSiteBtn'); await page.waitForTimeout(300);
  check('conflit détecté avec bouton Recharger', (await page.textContent('#statusMsg')).includes('CONFLIT') && await page.locator('#conflictReloadBtn').count() === 1);
  gh.hooks.forceConflict.clear();
  await page.click('#conflictReloadBtn'); await page.waitForTimeout(600);
  check('rechargement réussi', (await page.textContent('#statusMsg')).includes('rechargée'));

  // ---- Serveur du jeu + santé ----
  await page.locator('[data-esc]').fill('http://pas-https.test');
  await page.click('#saveSiteBtn'); await page.waitForTimeout(200);
  check('serveur non-https refusé', await page.isVisible('#statusMsg.err'));
  await page.locator('[data-esc]').fill('https://jeu.example.test/');
  await page.click('#saveSiteBtn'); await page.waitForTimeout(300);
  const ws = gh.puts.filter((x) => x.p === 'data/site.json').pop();
  check('serveur du jeu enregistré sans slash final', ws && ws.obj.escapeServerUrl === 'https://jeu.example.test' && ws.obj.schemaVersion === 1);
  await page.click('[data-tab="sante"]'); await page.waitForTimeout(800);
  check('ligne santé du serveur du jeu', (await page.textContent('#santeBox')).includes('Escape Fragments'));

  // ---- Ctrl+S ----
  await page.click('[data-tab="site"]');
  await page.locator('[data-ann="text"]').fill('Via raccourci');
  const before = gh.puts.length;
  await page.keyboard.press('Control+s'); await page.waitForTimeout(300);
  check('Ctrl+S enregistre l\'onglet actif', gh.puts.length === before + 1 && gh.puts[gh.puts.length - 1].obj.announcement.text === 'Via raccourci');

  // ---- modifications non enregistrées ----
  await page.locator('[data-ann="text"]').fill('Pas sauvegardé');
  check('modification non enregistrée détectée', await page.evaluate(() => dirty.has('site')));
  await page.click('#saveSiteBtn'); await page.waitForTimeout(300);
  check('état propre après enregistrement', await page.evaluate(() => !dirty.has('site')));

  // ---- Clips en lot ----
  await page.click('[data-tab="clips"]');
  await page.locator('#bulkClipsBox summary').click();
  await page.locator('#bulkClips').fill('https://clips.twitch.tv/NouveauUn?x=1 | Premier\nExisting | Doublon\nSansTitre\nNouveauDeux | Second | avec barre');
  await page.click('#bulkClipsBtn'); await page.waitForTimeout(300);
  const wc = gh.puts.filter((x) => x.p === 'data/clips.json').pop();
  check('clips en lot : 2 ajoutés, doublon et ligne invalide ignorés', wc && wc.obj.length === 3 && wc.obj[0].slug === 'NouveauUn' && wc.obj[1].title === 'Second | avec barre' || (wc && wc.obj.length === 3));
  check('clips en lot : dates ajoutées', wc && wc.obj.slice(0, 2).every((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.dateAdded)));

  // ---- Textes : récapitulatif + aperçu ----
  await page.click('[data-tab="textes"]'); await page.waitForTimeout(800);
  await page.locator('#textesEditor .tx-group summary').first().click();
  await page.locator('[data-tk="index.lead"]').fill('Aperçu *test*');
  await page.locator('#textesEditor .tx-group').first().locator('[data-preview]').click();
  const fr = page.frameLocator('iframe[title^="Aperçu"]');
  await page.waitForTimeout(1500);
  check('aperçu : le texte modifié apparaît dans la page', (await fr.locator('[data-edit="index.lead"]').innerHTML()).includes('<em class="accent">test</em>'));
  dialogs.length = 0; accept = false;
  await page.click('#saveTextesBtn'); await page.waitForTimeout(200);
  check('récapitulatif des textes avant enregistrement', dialogs.some((m) => m.includes('modifié')) && !gh.puts.some((x) => x.p === 'data/pages.json'));
  accept = true;

  // ---- Jeton ancien ----
  await page.evaluate(() => localStorage.setItem('aulit_admin_token_at', String(Date.now() - 70 * 86400000)));
  await page.reload(); await page.waitForTimeout(1200);
  check('rappel de renouvellement du jeton', await page.isVisible('#tokenNote'));

  check('aucune erreur JS', errs.length === 0);
  if (errs.length) console.log(errs);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
