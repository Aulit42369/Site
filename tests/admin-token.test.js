/* Stockage du jeton (sessionStorage par défaut, localStorage si « Se souvenir de moi »)
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
  await installFakeGithub(page);
  const store = () => page.evaluate(() => ({
    s: sessionStorage.getItem('aulit_admin_token'),
    l: localStorage.getItem('aulit_admin_token'),
    r: localStorage.getItem('aulit_admin_token_remember'),
  }));
  const connect = async (remember) => {
    await page.fill('#tokenInput', 'fake');
    if (remember) await page.check('#rememberToken'); else await page.uncheck('#rememberToken');
    await page.click('#connectBtn');
    await page.waitForSelector('#adminPanel', { state: 'visible' });
  };

  await page.goto(BASE + '/admin.html');
  await connect(false);
  let st = await store();
  check('sans « se souvenir » : jeton en sessionStorage, rien en localStorage', st.s === 'fake' && st.l === null && st.r === null);

  await page.click('#logoutBtn');
  st = await store();
  check('déconnexion : jeton effacé partout', st.s === null && st.l === null);

  await connect(true);
  st = await store();
  check('avec « se souvenir » : jeton en localStorage', st.l === 'fake' && st.r === '1' && st.s === null);
  await page.reload(); await page.waitForSelector('#adminPanel', { state: 'visible' });
  st = await store();
  check('« se souvenir » : reste connecté et le jeton reste en localStorage', st.l === 'fake');
  await page.click('#logoutBtn');

  // ancien jeton laissé en localStorage par l'ancienne version (sans drapeau)
  await page.evaluate(() => localStorage.setItem('aulit_admin_token', 'fake'));
  await page.reload(); await page.waitForSelector('#adminPanel', { state: 'visible' });
  st = await store();
  check('ancien jeton : déplacé en sessionStorage, retiré du localStorage', st.s === 'fake' && st.l === null);

  // « se souvenir » limité à 7 jours
  const remembered = (days) => page.evaluate((d) => {
    sessionStorage.clear();
    localStorage.setItem('aulit_admin_token', 'fake');
    localStorage.setItem('aulit_admin_token_remember', '1');
    localStorage.setItem('aulit_admin_token_at', String(Date.now() - d * 86400000));
  }, days);
  await remembered(6);
  await page.reload(); await page.waitForSelector('#adminPanel', { state: 'visible' });
  st = await store();
  check('« se souvenir » depuis 6 jours : toujours connecté', st.l === 'fake');
  await remembered(8);
  await page.reload(); await page.waitForSelector('#authGate', { state: 'visible' });
  st = await store();
  check('« se souvenir » depuis 8 jours : jeton effacé, reconnexion demandée', st.l === null && st.r === null && st.s === null && !(await page.isVisible('#adminPanel')));
  check('texte de l\'option : 7 jours', /7 jours/.test(await page.textContent('label:has(#rememberToken)')));

  check('aucune erreur JS', errs.length === 0);
  if (errs.length) console.log(errs);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
