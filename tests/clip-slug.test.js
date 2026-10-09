const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const { BASE, ROOT, launchOpts } = require('./lib');
let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  if (cond) pass++; else fail++;
}

(async () => {
  const backups = {};
  for (const f of ['data/clips.json']) {
    const p = path.join(ROOT, f);
    backups[f] = fs.existsSync(p) ? fs.readFileSync(p) : null;
  }
  fs.writeFileSync(path.join(ROOT, 'data/clips.json'), JSON.stringify([
    { slug: 'AwkwardSalamanderSwiftRage', title: 'Clutch improbable', dateAdded: '2026-09-01' }
  ]));

  const browser = await chromium.launch(launchOpts);

  try {
    // ===== admin.html: URL -> slug extraction =====
    let page = await browser.newPage();
    await page.goto(`${BASE}/admin.html`);
    // Bypass the GitHub-token login flow (no real token/network here) —
    // reveal the panel directly, exactly what init() does after a
    // successful connect, to test the form's own logic in isolation.
    await page.evaluate(() => {
      document.getElementById('authGate').style.display = 'none';
      document.getElementById('adminPanel').style.display = 'block';
    });
    await page.click('[data-tab="clips"]');
    await page.click('#addClipBtn');

    const cases = [
      ['https://clips.twitch.tv/AwkwardSalamanderSwiftRage', 'AwkwardSalamanderSwiftRage'],
      ['https://clips.twitch.tv/AwkwardSalamanderSwiftRage?filter=clips&range=7d', 'AwkwardSalamanderSwiftRage'],
      ['https://www.twitch.tv/aulit42369/clip/SneakyLlamaPogChamp', 'SneakyLlamaPogChamp'],
      ['https://www.twitch.tv/aulit42369/clip/SneakyLlamaPogChamp?filter=clips', 'SneakyLlamaPogChamp'],
      ['JustASlugTypedDirectly', 'JustASlugTypedDirectly'], // must stay untouched
    ];
    for (const [input, expected] of cases) {
      await page.fill('#cfSlug', '');
      await page.fill('#cfSlug', input);
      const value = await page.inputValue('#cfSlug');
      check(`admin slug extraction: "${input.slice(0,40)}..." -> "${value}"`, value === expected);
    }

    // preview reflects the slug
    await page.fill('#cfTitle', 'Titre test');
    await page.click('#cfPreviewBtn');
    await page.waitForTimeout(100);
    const previewSlugText = await page.evaluate(() => document.querySelector('#cfPreviewCard .clip-slug').textContent);
    check('admin preview shows current slug', previewSlugText === 'JustASlugTypedDirectly');
    await page.close();

    // ===== clips.html: display + click-to-copy + share payload unaffected =====
    page = await browser.newPage();
    await page.addInitScript(() => {
      window.__clipboardWrites = [];
      window.__shareCalls = [];
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: (t) => { window.__clipboardWrites.push(t); return Promise.resolve(); } },
        configurable: true,
      });
      Object.defineProperty(navigator, 'share', {
        value: (payload) => { window.__shareCalls.push(payload); return Promise.resolve(); },
        configurable: true,
      });
    });
    await page.goto(`${BASE}/clips.html`);
    await page.waitForTimeout(300);

    const slugText = await page.evaluate(() => document.querySelector('.clip-slug').textContent);
    check('clips.html: slug visible under the video', slugText === 'AwkwardSalamanderSwiftRage');

    // click slug -> copies slug only, not url
    await page.click('.clip-slug');
    await page.waitForTimeout(100);
    const clipboardAfterSlugClick = await page.evaluate(() => window.__clipboardWrites.slice());
    check('clips.html: clicking slug copies the raw slug', clipboardAfterSlugClick.includes('AwkwardSalamanderSwiftRage'));
    const slugFeedback = await page.evaluate(() => document.querySelector('.clip-slug').textContent);
    check('clips.html: slug shows "Copié !" feedback', slugFeedback === 'Copié !');
    await page.waitForTimeout(1300);
    const slugRestored = await page.evaluate(() => document.querySelector('.clip-slug').textContent);
    check('clips.html: slug text restored after feedback', slugRestored === 'AwkwardSalamanderSwiftRage');

    // keyboard activation
    await page.evaluate(() => { window.__clipboardWrites.length = 0; });
    await page.focus('.clip-slug');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    const clipboardAfterEnter = await page.evaluate(() => window.__clipboardWrites.slice());
    check('clips.html: Enter key on slug also copies it', clipboardAfterEnter.includes('AwkwardSalamanderSwiftRage'));

    // share button payload must stay title+url, no slug anywhere in it
    await page.evaluate(() => { window.__shareCalls.length = 0; window.__clipboardWrites.length = 0; });
    await page.click('.share-btn');
    await page.waitForTimeout(100);
    const shareCalls = await page.evaluate(() => window.__shareCalls.slice());
    check('clips.html: Partager button still fires navigator.share with {title,url} only', shareCalls.length === 1 && shareCalls[0].title === 'Clutch improbable' && shareCalls[0].url === 'https://clips.twitch.tv/AwkwardSalamanderSwiftRage' && !('slug' in shareCalls[0]));
    await page.close();

  } finally {
    for (const [f, content] of Object.entries(backups)) {
      const p = path.join(ROOT, f);
      if (content) fs.writeFileSync(p, content);
      else if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    await browser.close();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
