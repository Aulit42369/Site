/* Connexion de l'admin par mot de passe (serveur aulit42369.fr)
   et GoatCounter figé + SRI sur toutes les pages publiques. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { BASE, launchOpts } = require('./lib');
const { installFakeGithub } = require('./fakegh');
let pass = 0, fail = 0;
const check = (l, c) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + l); c ? pass++ : fail++; };

// ---- GoatCounter : version figée + integrity sur chaque page qui le charge ----
const ROOT = path.join(__dirname, '..');
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const gc = pages.filter((f) => fs.readFileSync(path.join(ROOT, f), 'utf8').includes('gc.zgo.at'));
check('GoatCounter présent sur les pages publiques', gc.length >= 12);
check('GoatCounter figé (count.v4.js) avec integrity sur chaque page', gc.every((f) => {
  const tags = fs.readFileSync(path.join(ROOT, f), 'utf8').match(/<script[^>]*gc\.zgo\.at[^>]*>/g) || [];
  return tags.length && tags.every((t) => /count\.v4\.js/.test(t) && /integrity="sha384-/.test(t) && /crossorigin="anonymous"/.test(t));
}));

(async () => {
  const browser = await chromium.launch(launchOpts);
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  page.on('dialog', (d) => d.accept());
  // 05/11/2026 : connexion par mot de passe (serveur), plus de jeton GitHub dans le navigateur
  const gh = await installFakeGithub(page, {}, { connecte: false });
  await page.addInitScript(() => { if (!sessionStorage.getItem('deja')) { sessionStorage.setItem('deja', '1'); localStorage.setItem('aulit_admin_token', 'ancien'); } });
  await page.goto(BASE + '/admin.html');
  await page.waitForSelector('#authGate', { state: 'visible' });
  check('sans session : écran de connexion par mot de passe', await page.isVisible('#passwordInput') && !(await page.isVisible('#adminPanel')));
  check('ancien jeton GitHub effacé du navigateur', (await page.evaluate(() => localStorage.getItem('aulit_admin_token'))) === null);
  await page.fill('#passwordInput', 'faux'); await page.click('#connectBtn');
  await page.waitForFunction(() => document.getElementById('loginError').textContent.length > 0);
  check("mauvais mot de passe : message, toujours à l'écran de connexion", /incorrect/.test(await page.textContent('#loginError')) && !(await page.isVisible('#adminPanel')));
  await page.fill('#passwordInput', gh.MOT_DE_PASSE); await page.press('#passwordInput', 'Enter');
  await page.waitForSelector('#adminPanel', { state: 'visible' });
  check('bon mot de passe (touche Entrée) : admin ouverte, champ vidé', (await page.inputValue('#passwordInput')) === '');
  await page.reload(); await page.waitForSelector('#adminPanel', { state: 'visible' });
  check('session gardée au rechargement', true);
  await page.click('#logoutBtn');
  await page.waitForSelector('#authGate', { state: 'visible' });
  await page.reload(); await page.waitForSelector('#authGate', { state: 'visible' });
  check('déconnexion : il faut retaper le mot de passe', !(await page.isVisible('#adminPanel')));

  check('aucune erreur JS', errs.length === 0);
  if (errs.length) console.log(errs);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
