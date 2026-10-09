const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { BASE, ROOT, launchOpts } = require('./lib');
let pass=0, fail=0;
const check=(l,c)=>{console.log((c?'PASS':'FAIL')+' — '+l); c?pass++:fail++;};
(async()=>{
  const fx = path.join(ROOT,'data/apropos.json');
  const had = fs.existsSync(fx);
  const browser = await chromium.launch(launchOpts);
  try {
    // 1. public fallback (no file)
    if (had) fs.unlinkSync(fx);
    let page = await browser.newPage();
    await page.goto(BASE+'/apropos.html'); await page.waitForTimeout(300);
    check('fallback: 4 faq items', await page.locator('#faqList details').count()===4);
    check('fallback: 5 commands', await page.locator('#twitchCommands li').count()===5);
    await page.close();

    // 2. public rendering + XSS
    fs.writeFileSync(fx, JSON.stringify({
      chaine:{title:'Ma <b>chaîne</b>',paragraphs:['Salut <img src=x onerror="window.__x=1">','Deux [Discord](https://discord.com/x?a=1&b=2) et [bad](javascript:alert(1)) `!cmd`']},
      twitch:{title:'T',intro:'',commands:[{cmd:'!a',desc:'desc [planning](planning.html)'},{cmd:'',desc:'x'}]},
      faq:[{q:'Q1 <script>',a:'ligne1\nligne2'},{q:'',a:'vide'}]
    }));
    page = await browser.newPage();
    await page.goto(BASE+'/apropos.html'); await page.waitForTimeout(300);
    check('title escaped', (await page.textContent('#aboutTitle'))==='Ma <b>chaîne</b>');
    check('no XSS exec', !(await page.evaluate(()=>window.__x)));
    check('2 paragraphs', await page.locator('#aboutParagraphs p').count()===2);
    check('ext link ok', await page.locator('#aboutParagraphs a[target=_blank][rel=noopener]').count()===1);
    check('js: link not made', (await page.innerHTML('#aboutParagraphs')).includes('[bad](javascript:alert(1))') && !(await page.innerHTML('#aboutParagraphs')).includes('href="javascript'));
    check('code tag', await page.locator('#aboutParagraphs code').count()===1);
    check('empty intro hidden', !(await page.isVisible('#twitchIntro')));
    check('1 command (empty cmd dropped), internal link', await page.locator('#twitchCommands li').count()===1 && await page.locator('#twitchCommands a[href="planning.html"]').count()===1);
    check('faq 1 item, br', await page.locator('#faqList details').count()===1 && await page.locator('#faqList br').count()===1);
    check('recentGames kept', await page.locator('#recentGames').count()===1);
    // 3. empty faq hides section
    fs.writeFileSync(fx, JSON.stringify({faq:[]}));
    await page.reload(); await page.waitForTimeout(300);
    check('empty faq hides section', !(await page.isVisible('#faqSection')));
    check('partial file keeps static chaîne', (await page.textContent('#aboutTitle'))==='La chaîne');
    fs.writeFileSync(fx, '[1,2]'); await page.reload(); await page.waitForTimeout(300);
    check('invalid json shape -> fallback', await page.locator('#faqList details').count()===4);
    await page.close();

    // 4. admin editor
    page = await browser.newPage();
    const errs=[]; page.on('pageerror',e=>errs.push(e.message));
    await page.goto(BASE+'/admin.html');
    await page.evaluate(()=>{document.getElementById('authGate').style.display='none';document.getElementById('adminPanel').style.display='block';});
    await page.evaluate(()=>{ window.__saved=null; window.writeJsonFile=async(p,d,sha,m)=>{window.__saved={p,d,m};return {content:{sha:'x'}};}; });
    await page.evaluate(()=>{aproposState.data=normalizeApropos(null);renderApropos();}); await page.click('[data-tab="apropos"]');
    check('panel visible', await page.isVisible('#aproposPanel'));
    const nFaq0 = await page.locator('#aproposEditor [data-list="faq"]').count();
    console.log('faq inputs', nFaq0);
    const adds = await page.locator('#aproposEditor [data-act="add"]').count();
    check('3 add buttons', adds===3);
    await page.locator('#aproposEditor [data-act="add"]').nth(2).click();
    const q = page.locator('#aproposEditor [data-list="faq"][data-field="q"]');
    const n = await q.count();
    check('faq entry added', n===5);
    await q.nth(n-1).fill('Nouvelle question ?');
    await page.locator('#aproposEditor [data-list="faq"][data-field="a"]').nth(n-1).fill('Réponse [x](https://a.b)');
    // move last up, then delete first
    await page.locator('#aproposEditor .ap-row').filter({has:page.locator('[data-list="faq"]')}).last().locator('[data-act="up"]').click();
    check('moved up', (await q.nth(3).inputValue())==='Nouvelle question ?');
    await q.nth(0).fill('Premier');
    await page.locator('#aproposEditor .ap-row').filter({has:page.locator('[data-list="faq"]')}).first().locator('[data-act="del"]').click();
    check('deleted first', (await q.count())===4);
    await page.click('#saveAproposBtn'); await page.waitForTimeout(200);
    const s = await page.evaluate(()=>window.__saved);
    check('saved to data/apropos.json', s && s.p==='data/apropos.json');
    check('saved faq ok', s && s.d.faq.length===4 && s.d.faq.some(f=>f.q==='Nouvelle question ?') && !s.d.faq.some(f=>f.q==='Premier'));
    check('saved shape', s && s.d.chaine.paragraphs.length>=1 && Array.isArray(s.d.twitch.commands));
    check('no page errors', errs.length===0);
    if(errs.length) console.log(errs);
    await page.close();
  } finally {
    if (had) {} // original absent in repo? restore
    if (fs.existsSync(fx)) fs.unlinkSync(fx);
    await browser.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})();
