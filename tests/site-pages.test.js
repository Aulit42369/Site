const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const { BASE, ROOT, launchOpts } = require('./lib');
let pass = 0, fail = 0;
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + label);
  if (cond) pass++; else fail++;
}

function writeStatus(fresh) {
  const data = {
    _updated_at: new Date(Date.now() - (fresh ? 2*60*1000 : 90*60*1000)).toISOString(),
    aulit42369: { live: true, followers: 1234, game: 'VALORANT' },
    evil: { live: true, avatar: null }
  };
  fs.writeFileSync(path.join(ROOT, 'data/twitch-status.json'), JSON.stringify(data));
}
function writeStreamersXSS() {
  // URL volontairement valide (clé "evil" doit matcher statusData) pour ne
  // pas fausser le test de fraîcheur du badge — le payload XSS reste dans
  // name/description, ce que le href-escaping couvre est testé à part.
  const s = [{ name: '<img src=x onerror="window.__xss=true">', description: '<b>bold</b> & "quoted"', url: 'https://www.twitch.tv/evil' }];
  fs.writeFileSync(path.join(ROOT, 'data/streamers.json'), JSON.stringify(s));
}
function writeStreamerHrefXSS() {
  const s = [{ name: 'Test', description: 'desc', url: 'https://x.test/" onmouseover="window.__xss2=true' }];
  fs.writeFileSync(path.join(ROOT, 'data/streamers.json'), JSON.stringify(s));
}
function writeClipsXSS() {
  const c = [{ slug: 'abc123', title: '<script>window.__xssClip=true<\/script>Titre', dateAdded: new Date().toISOString().slice(0,10) }];
  fs.writeFileSync(path.join(ROOT, 'data/clips.json'), JSON.stringify(c));
}

(async () => {
  const backups = {};
  for (const f of ['data/twitch-status.json', 'data/streamers.json', 'data/clips.json', 'data/planning.json']) {
    const p = path.join(ROOT, f);
    backups[f] = fs.existsSync(p) ? fs.readFileSync(p) : null;
  }

  const browser = await chromium.launch(launchOpts);

  try {
    // ---- 1. Mobile nav overlay, across a couple of pages ----
    for (const pageName of ['index.html', 'coulisses.html']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
      await page.goto(`${BASE}/${pageName}`);
      await page.click('#navToggle');
      await page.waitForTimeout(150);
      const rect = await page.evaluate(() => document.getElementById('nav').getBoundingClientRect());
      check(`${pageName}: nav overlay fills viewport height (726px)`, Math.abs(rect.height - 726) < 2);
      const toggleBox = await page.locator('#navToggle').boundingBox();
      check(`${pageName}: nav-toggle >=44x44`, toggleBox.width >= 44 && toggleBox.height >= 44);
      await page.close();
    }

    // ---- 2. streamers.html: freshness + XSS escaping ----
    writeStreamersXSS();
    writeStatus(true);
    let page = await browser.newPage();
    let xssFired = false;
    page.on('dialog', d => d.dismiss());
    await page.exposeFunction('__report', () => { xssFired = true; });
    await page.goto(`${BASE}/streamers.html`);
    await page.waitForTimeout(400);
    const sInjected = await page.evaluate(() => !!(window.__xss || window.__xss2));
    check('streamers.html: XSS payload neutralized (no script/handler executed)', !sInjected);
    const nameHtml = await page.evaluate(() => document.querySelector('.streamer-name').innerHTML);
    check('streamers.html: name rendered as escaped text, not markup', nameHtml.includes('&lt;img'));
    const badgeClass = await page.getAttribute('#streamer-live-0', 'class');
    check('streamers.html: fresh -> still correctly live', badgeClass.includes('is-live'));
    await page.close();

    writeStatus(false);
    page = await browser.newPage();
    await page.goto(`${BASE}/streamers.html`);
    await page.waitForTimeout(400);
    const badgeClass2 = await page.getAttribute('#streamer-live-0', 'class');
    check('streamers.html: stale -> still correctly offline (isStatusFresh still works post-edit)', badgeClass2.includes('is-offline') && !badgeClass2.includes('is-live'));
    await page.close();

    // ---- 2b. streamers.html: href-attribute escaping (separate fixture) ----
    writeStreamerHrefXSS();
    writeStatus(true);
    page = await browser.newPage();
    let hrefXssFired = false;
    await page.goto(`${BASE}/streamers.html`);
    await page.waitForTimeout(300);
    const hrefXssTriggered = await page.evaluate(() => !!window.__xss2);
    check('streamers.html: quote in url cannot break out of href attribute', !hrefXssTriggered);
    await page.close();

    // ---- 3. clips.html: XSS escaping + slug encoding + share button ----
    writeClipsXSS();
    page = await browser.newPage();
    await page.goto(`${BASE}/clips.html`);
    await page.waitForTimeout(300);
    const clipXss = await page.evaluate(() => !!window.__xssClip);
    check('clips.html: <script> in title did not execute', !clipXss);
    const titleHtml = await page.evaluate(() => document.querySelector('.clip-title').innerHTML);
    check('clips.html: title rendered escaped, text preserved', titleHtml.includes('&lt;script&gt;') && titleHtml.includes('Titre'));
    const iframeSrc = await page.getAttribute('.clip-card iframe', 'src');
    check('clips.html: iframe src still points to the real slug', iframeSrc.includes('clip=abc123'));
    await page.close();

    // ---- 4. planning.html: normal + XSS-ish game name ----
    const planningData = [
      { day: 'Lundi', on: true, time: '20:00', end: '23:00', game: '<i>Valorant</i>', color: '#00f5ff' },
      { day: 'Mardi', on: false, color: '#4a5568' },
    ];
    fs.writeFileSync(path.join(ROOT, 'data/planning.json'), JSON.stringify(planningData));
    page = await browser.newPage();
    await page.goto(`${BASE}/planning.html`);
    await page.waitForTimeout(300);
    const gameHtml = await page.evaluate(() => document.querySelector('.planning-game').innerHTML);
    check('planning.html: game name escaped (no live <i> tag)', gameHtml.includes('&lt;i&gt;'));
    const offLabel = await page.evaluate(() => !!document.querySelector('.planning-off-label'));
    check('planning.html: off-day still renders normally', offLabel);
    await page.close();

    // ---- 5. admin.html: preview functions escape correctly, in isolation (no network/token needed) ----
    page = await browser.newPage();
    await page.goto(`${BASE}/admin.html`);
    const authVisible = await page.isVisible('#authGate');
    check('admin.html: loads to auth gate with no token (unchanged behavior)', authVisible);

    await page.evaluate(() => {
      document.getElementById('sfName').value = '<svg onload=window.__a=1>';
      document.getElementById('sfDesc').value = '"quoted" & <b>desc</b>';
      document.getElementById('sfUrl').value = 'https://x.test/" onmouseover="window.__b=1';
      renderStreamerPreview();
    });
    const previewHtml = await page.evaluate(() => document.getElementById('sfPreviewCard').innerHTML);
    const previewTriggered = await page.evaluate(() => !!(window.__a || window.__b));
    check('admin.html streamer preview: payload neutralized', !previewTriggered);
    check('admin.html streamer preview: name escaped in output', previewHtml.includes('&lt;svg'));

    await page.evaluate(() => {
      document.getElementById('cfTitle').value = '<script>window.__c=1<\/script>Clip titre';
      renderClipPreview();
    });
    const clipPreviewHtml = await page.evaluate(() => document.getElementById('cfPreviewCard').innerHTML);
    const clipPreviewTriggered = await page.evaluate(() => !!window.__c);
    check('admin.html clip preview: payload neutralized', !clipPreviewTriggered);
    check('admin.html clip preview: title escaped in output', clipPreviewHtml.includes('&lt;script&gt;') && clipPreviewHtml.includes('Clip titre'));

    // renderStreamers() / renderClips() / renderPlanning() with in-memory fake state, no network
    await page.evaluate(() => {
      streamersState = { data: [{ name: '<mark>Evil</mark>', description: 'd & "x"', url: '#' }], sha: null };
      renderStreamers();
      clipsState = { data: [{ title: '<i>Clip</i>', slug: '<slug>' }], sha: null };
      renderClips();
      planningState = { data: [{ day: '<b>Jour</b>', on: true, time: '20:00', end: '22:00', game: 'G', color: '#00f5ff' }], sha: null };
      renderPlanning();
    });
    const entryTitleHtml = await page.evaluate(() => document.querySelector('#streamersList .entry-title').innerHTML);
    check('admin.html renderStreamers: list entry escaped', entryTitleHtml.includes('&lt;mark&gt;'));
    const clipEntryHtml = await page.evaluate(() => document.querySelector('#clipsList .entry-title').innerHTML);
    check('admin.html renderClips: list entry escaped', clipEntryHtml.includes('&lt;i&gt;'));
    const planningDayHtml = await page.evaluate(() => document.querySelector('.planning-day-name').innerHTML);
    check('admin.html renderPlanning: day label escaped', planningDayHtml.includes('&lt;b&gt;'));
    await page.close();

    // ---- 6. coulisses.html: confirm stale gray gone, new text still present ----
    page = await browser.newPage();
    await page.goto(`${BASE}/coulisses.html`);
    const svgHtml = await page.content();
    check('coulisses.html: no more #4a5568 left', !svgHtml.includes('4a5568'));
    check('coulisses.html: new fill color present', svgHtml.includes('#75849e'));
    check('coulisses.html: YouTube chat mod text still present', svgHtml.includes('modération du chat YouTube'));
    check('coulisses.html: admin panel text still present', svgHtml.includes("panneau d'administration web"));
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
