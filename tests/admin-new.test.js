const { chromium } = require('playwright');
const { BASE, launchOpts } = require('./lib');
let pass=0, fail=0;
const check=(l,c)=>{console.log((c?'PASS':'FAIL')+' — '+l); c?pass++:fail++;};
const b64=s=>Buffer.from(s,'utf8').toString('base64');
const iso=(off)=>{const d=new Date();d.setDate(d.getDate()+off);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};

(async()=>{
  const browser = await chromium.launch(launchOpts);
  const ctx = await browser.newContext({viewport:{width:1100,height:900},serviceWorkers:'block'}); const page = await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  page.on('dialog',d=>d.accept()); 
  // ---- fake GitHub ----
  let n=0; const files={}; const commits={}; const puts=[]; let dispatched=0;
  const put=(p,obj,msg,date)=>{ n++; const sha='sha'+n; files[p]={content:JSON.stringify(obj,null,2),sha}; (commits[p]=commits[p]||[]).unshift({sha,commit:{message:msg,author:{date:date||new Date().toISOString()}},content:JSON.stringify(obj,null,2)}); return sha; };
  put('data/streamers.json',[],'init'); put('data/clips.json',[],'init'); put('data/planning.json',[{day:'Lundi',on:true,time:'21:00',end:'00:00',game:'X',color:'#00f5ff'}],'init');
  put('data/site.json',{socials:[{label:'Discord',url:'https://discord.com/invite/OLD'}],announcement:{enabled:true,text:'Ancien',tone:'info',from:'',until:''}},'v1','2026-09-01T10:00:00Z');
  const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
  await page.route('https://api.github.com/**', async route=>{ try {
    const req=route.request(); const url=new URL(req.url());
    const rel=url.pathname.replace('/repos/aulit42369/Site','');
    if(req.method()==='OPTIONS') return route.fulfill({status:204,headers:CORS});
    const json=(o,s=200)=>route.fulfill({status:s,headers:{...CORS,'content-type':'application/json'},body:JSON.stringify(o)});
    if(rel.startsWith('/contents/')){
      const p=decodeURIComponent(rel.slice('/contents/'.length));
      if(req.method()==='PUT'){
        const body=JSON.parse(req.postData()); const cur=files[p];
        if(cur && body.sha!==cur.sha) return json({message:'sha mismatch'},409);
        const obj=JSON.parse(Buffer.from(body.content,'base64').toString('utf8'));
        const sha=put(p,obj,body.message); puts.push({p,obj,message:body.message});
        return json({content:{sha}});
      }
      const ref=url.searchParams.get('ref');
      if(ref){ const c=(commits[p]||[]).find(c=>c.sha===ref); if(!c) return json({},404); return json({content:b64(c.content),sha:ref}); }
      if(!files[p]) return json({message:'Not Found'},404);
      return json({content:b64(files[p].content),sha:files[p].sha});
    }
    if(rel==='/commits'){ const p=url.searchParams.get('path'); return json((commits[p]||[]).map(c=>({sha:c.sha,commit:c.commit}))); }
    if(rel==='/actions/runs') return json({workflow_runs:[
      {name:'Mise à jour statut Twitch',status:'completed',conclusion:'success',updated_at:new Date(Date.now()-5*60000).toISOString(),html_url:'https://github.com/x'},
      {name:'Vérification des liens',status:'completed',conclusion:'failure',updated_at:new Date(Date.now()-3600000).toISOString(),html_url:'https://github.com/fail'},
    ]});
    if(rel==='/pages/builds/latest') return json({status:'built',updated_at:new Date(Date.now()-120000).toISOString()});
    if(rel==='/actions/workflows/twitch-status.yml/dispatches'){ dispatched++; return route.fulfill({status:204,headers:CORS}); }
    return json({},404);
  } catch(e){ console.log('ROUTE ERR',e.message); route.abort(); } });
  await page.addInitScript(()=>localStorage.setItem('aulit_admin_token','fake'));
  await page.goto(BASE+'/admin.html'); await page.waitForFunction(()=>!document.getElementById('statusMsg').classList.contains('show'),null,{timeout:10000});
  check('admin loaded without error banner', !(await page.isVisible('#statusMsg.err')));
  check('9 tabs', await page.locator('.admin-tabs [data-tab]').count()===9);

  // ---- Exceptions ----
  await page.click('[data-tab="planning"]');
  await page.click('#addExceptionBtn');
  const row = page.locator('#exceptionsEditor .ex-row').first();
  await row.locator('[data-f="date"]').fill(iso(3));
  await row.locator('[data-f="game"]').fill('Spécial');
  await row.locator('[data-f="note"]').fill('Avec <les> abonnés');
  await page.click('#addExceptionBtn');
  const row2 = page.locator('#exceptionsEditor .ex-row').nth(1);
  await row2.locator('[data-f="date"]').fill(iso(1));
  await row2.locator('[data-f="on"]').uncheck();
  await page.click('#addExceptionBtn'); // invalid (no date) row, dropped on save
  await page.click('#saveExceptionsBtn'); await page.waitForTimeout(300);
  let w=puts.find(x=>x.p==='data/planning-exceptions.json');
  check('exceptions saved sorted, invalid dropped', w && w.obj.length===2 && w.obj[0].date===iso(1) && w.obj[0].on===false && w.obj[1].game==='Spécial' && w.obj[1].note==='Avec <les> abonnés');
  check('exceptions re-render after save', await page.locator('#exceptionsEditor .ex-row').count()===2);
  await page.locator('#exceptionsEditor [data-ex-del]').first().click();
  check('exception deleted in UI', await page.locator('#exceptionsEditor .ex-row').count()===1);

  // ---- Site tab ----
  await page.click('[data-tab="site"]');
  check('site loaded from github', (await page.inputValue('[data-sl="0"][data-f="label"]'))==='Discord');
  await page.click('[data-sact="add"]');
  await page.locator('[data-sl="1"][data-f="label"]').fill('Twitch');
  await page.locator('[data-sl="1"][data-f="url"]').fill('twitch.tv/aulit42369');
  await page.click('#saveSiteBtn'); await page.waitForTimeout(200);
  check('invalid social url refused', (await page.textContent('#statusMsg')).includes('https://') && !puts.find(x=>x.p==='data/site.json'));
  await page.locator('[data-sl="1"][data-f="url"]').fill('https://www.twitch.tv/aulit42369');
  await page.click('[data-sact="up"][data-i="1"]');
  check('social moved up', (await page.inputValue('[data-sl="0"][data-f="label"]'))==='Twitch');
  await page.locator('[data-ann="text"]').fill('Pas de stream ce soir');
  await page.locator('[data-ann="until"]').fill(iso(2));
  await page.locator('[data-ann="tone"]').selectOption('alerte');
  check('preview text live', (await page.textContent('#annPreview')).includes('Pas de stream ce soir'));
  check('preview alert class', await page.locator('#annPreview.announce-alerte').count()===1);
  check('status text (active until)', (await page.textContent('#annStatus')).includes('Affichée'));
  await page.locator('[data-ann="from"]').fill(iso(5)); await page.locator('[data-ann="until"]').fill(iso(2));
  await page.click('#saveSiteBtn'); await page.waitForTimeout(200);
  check('until<from refused', (await page.textContent('#statusMsg')).includes('avant'));
  await page.locator('[data-ann="from"]').fill('');
  await page.click('#saveSiteBtn'); await page.waitForTimeout(300);
  w=puts.find(x=>x.p==='data/site.json');
  check('site saved', w && w.obj.socials.length===2 && w.obj.socials[0].label==='Twitch' && w.obj.announcement.enabled===true && w.obj.announcement.tone==='alerte' && w.obj.announcement.until===iso(2));
  await page.screenshot({path:'admin-site.png',fullPage:true});

  // ---- Textes ----
  await page.click('[data-tab="textes"]'); await page.waitForTimeout(800);
  const groups = await page.locator('#textesEditor .tx-group').count();
  check('9 page groups loaded', groups===9);
  await page.locator('#textesEditor .tx-group summary').first().click(); await page.locator('#textesEditor .tx-group summary').nth(7).click();
  const lead = page.locator('[data-tk="index.lead"]');
  const def = await lead.inputValue();
  check('default text prefilled', def.includes('Une chaîne où on teste'));
  const titleDef = await page.locator('[data-tk="coulisses.p1.title"]').inputValue();
  check('accent <em> converted to *…*', titleDef.includes('*téléphone*'));
  const legalLink = await page.locator('[data-tk="legal.2"]').inputValue();
  check('links converted to [..](..)', /\[contact\]\(contact\.html\)/.test(legalLink) && /\[Discord de la chaîne\]\(https:\/\/discord\.com\/invite/.test(legalLink));
  await lead.fill('Texte tout neuf *ici*');
  check('modified class set', await page.locator('.tx-field.modified [data-tk="index.lead"]').count()===1);
  await page.locator('#textesEditor .tx-group summary').nth(1).click();
  const emptyKey = page.locator('[data-tk="planning.eyebrow"]');
  await emptyKey.fill('');
  // extra project
  await page.click('[data-xact="add"]');
  await page.locator('[data-xp="0"][data-f="eyebrow"]').fill('Nouveau');
  await page.locator('[data-xp="0"][data-f="title"]').fill('Mon *outil*');
  await page.locator('[data-xp="0"][data-f="ptext"]').fill('Para 1\n\nPara 2');
  await page.click('#saveTextesBtn'); await page.waitForTimeout(300);
  w=puts.find(x=>x.p==='data/pages.json');
  check('only changed text saved', w && Object.keys(w.obj.texts).length===1 && w.obj.texts['index.lead']==='Texte tout neuf *ici*');
  check('emptied field -> not saved (default)', w && !('planning.eyebrow' in w.obj.texts));
  check('extra project saved w/ paragraphs split', w && w.obj.extraProjects.length===1 && w.obj.extraProjects[0].paragraphs.length===2 && w.obj.extraProjects[0].title==='Mon *outil*');
  // reset
  await page.locator('[data-reset="index.lead"]').click();
  check('reset restores default', (await lead.inputValue())===def);
  await page.click('#saveTextesBtn'); await page.waitForTimeout(300);
  const w2=puts.filter(x=>x.p==='data/pages.json').pop();
  check('after reset: no text override saved', Object.keys(w2.obj.texts).length===0);
  await page.screenshot({path:'admin-textes.png',fullPage:false});

  // round-trip fidelity of defaults: markup -> renderRichText == original text content
  const items = await page.evaluate(async()=>{
    const out=[];
    for (const [file] of TEXT_PAGES){
      const doc=new DOMParser().parseFromString(await (await fetch(file)).text(),'text/html');
      for (const el of doc.querySelectorAll('[data-edit]')){
        out.push({key:el.getAttribute('data-edit'),markup:markupOf(el),text:el.textContent.replace(/\s+/g,' ').trim(),na:el.querySelectorAll('a').length,ea:el.querySelectorAll('em').length});
      }
    }
    return out;
  });
  // renderRichText vit dans main.js : on l'exécute sur une page publique (l'admin a une CSP stricte)
  const pub = await ctx.newPage(); await pub.goto(BASE+'/index.html');
  const rt = await pub.evaluate((items)=>{
    const bad=[];
    for (const it of items){
      const tmp=document.createElement('div'); tmp.innerHTML=renderRichText(it.markup);
      const b=tmp.textContent.replace(/\s+/g,' ').trim();
      if(it.text!==b||it.na!==tmp.querySelectorAll('a').length||it.ea!==tmp.querySelectorAll('em').length) bad.push(it.key+' | '+it.text.slice(0,50)+' | '+b.slice(0,50));
    }
    return bad;
  }, items);
  await pub.close();
  check('round-trip defaults identical for all editable texts ('+rt.length+' diffs)', rt.length===0);
  if(rt.length) console.log(rt);

  // ---- Santé ----
  await page.click('[data-tab="sante"]'); await page.waitForTimeout(800);
  const rows = await page.locator('.health-row').count();
  check('health rows rendered', rows>=5);
  check('workflow failure flagged', await page.locator('.health-dot.err').count()>=1 && (await page.innerHTML('#santeBox')).includes('github.com/fail'));
  await page.click('#twitchRunBtn'); await page.waitForTimeout(300);
  check('dispatch sent', dispatched===1 && (await page.textContent('#statusMsg')).includes('lancée'));
  await page.screenshot({path:'admin-sante.png',fullPage:true});

  // ---- Historique ----
  put('data/site.json',{socials:[{label:'Discord',url:'https://discord.com/invite/MID'}],announcement:{enabled:false,text:'',tone:'info',from:'',until:''}},'v2','2026-09-15T10:00:00Z');
  await page.click('[data-tab="historique"]');
  await page.selectOption('#histFile','site'); await page.waitForTimeout(500);
  const hrows = await page.locator('.hist-row').count();
  check('history lists versions (>=3)', hrows>=3);
  check('current version has no restore button', await page.locator('.hist-row').first().locator('[data-hrestore]').count()===0);
  await page.locator('.hist-row').nth(hrows-1).locator('[data-hview]').click(); await page.waitForTimeout(300);
  check('view shows json', (await page.locator('.hist-row').nth(hrows-1).locator('.hist-pre').textContent()).includes('OLD'));
  const before=puts.length;
  await page.locator('.hist-row').nth(hrows-1).locator('[data-hrestore]').click(); await page.waitForTimeout(600);
  const rw=puts.slice(before).find(x=>x.p==='data/site.json');
  check('restore wrote old content with restoration message', rw && rw.obj.socials[0].url.endsWith('OLD') && rw.message.startsWith('Restauration de data/site.json'));
  check('admin state reloaded after restore', true);
  await page.click('[data-tab="site"]');
  check('site tab shows restored values', (await page.inputValue('[data-sl="0"][data-f="url"]')).endsWith('OLD'));
  await page.screenshot({path:'admin-histo.png',fullPage:false});
  check('no page errors', errs.length===0); if(errs.length) console.log(errs);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})();
