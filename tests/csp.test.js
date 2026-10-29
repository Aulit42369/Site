/* Parité CSP : toute page HTML a une Content-Security-Policy (meta), sans
   script inline exécutable ni gestionnaire on*= (interdits par la CSP),
   et chaque page s'affiche dans un navigateur sans violation CSP ni erreur JS. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { BASE, launchOpts } = require('./lib');
let pass = 0, fail = 0;
const check = (l, c) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + l); c ? pass++ : fail++; };

const ROOT = path.join(__dirname, '..');
// fichiers de validation Google (google*.html) : pas des pages du site
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && !/^google[0-9a-f]+\.html$/.test(f));
check('au moins 16 pages HTML trouvées', pages.length >= 16);
for (const f of pages) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const csp = (html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/) || [])[1] || '';
  const scriptSrc = (csp.match(/script-src ([^;]+)/) || [])[1] || '';
  const inline = (html.match(/<script(?![^>]*\ssrc=)(?![^>]*type="application\/ld\+json")[^>]*>/g) || []).length;
  check(`${f} : CSP présente (default-src, script-src sans 'unsafe-inline', object-src 'none')`,
    /default-src 'self'/.test(csp) && scriptSrc && !/unsafe-inline|unsafe-eval/.test(scriptSrc) && /object-src 'none'/.test(csp));
  check(`${f} : aucun script inline ni attribut on*=`, inline === 0 && !/<[a-z][^>]*\son[a-z]+="/i.test(html));
}

(async () => {
  const browser = await chromium.launch(launchOpts);
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  // rien ne sort vers Internet pendant les tests (Twitch, GoatCounter…) : la CSP est évaluée avant le réseau
  await ctx.route((url) => !url.href.startsWith(BASE), (r) => r.abort());
  await ctx.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
    try { localStorage.setItem('aulit_consent_tiers', 'oui'); localStorage.setItem('aulit_consent_date', String(Date.now())); } catch (e) { /* stockage bloqué */ }
  });
  for (const f of pages.filter((x) => x !== 'admin.html')) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) errs.push(m.text()); });
    await page.goto(BASE + '/' + f, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    const v = await page.evaluate(() => window.__csp);
    check(`${f} : aucune violation CSP ni erreur JS dans le navigateur`, !v.length && !errs.length);
    if (v.length || errs.length) console.log(v, errs);
    await page.close();
  }
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
