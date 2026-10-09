const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { BASE, ROOT, launchOpts } = require('./lib');
let pass=0, fail=0;
const check=(l,c)=>{console.log((c?'PASS':'FAIL')+' — '+l); c?pass++:fail++;};
const D=f=>path.join(ROOT,'data',f);
const write=(f,o)=>fs.writeFileSync(D(f),typeof o==='string'?o:JSON.stringify(o));
const rm=f=>{ if(fs.existsSync(D(f))) fs.unlinkSync(D(f)); };
const iso=(off)=>{const d=new Date();d.setDate(d.getDate()+off);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};

(async()=>{
  const browser = await chromium.launch(launchOpts);
  const newPage = async()=>{const p=await browser.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); return p;};
  try {
    // ===== site.json : socials + discord rewrite =====
    write('site.json',{socials:[
      {label:'Discord',url:'https://discord.gg/NEWINVITE'},
      {label:'YouTube <b>',url:'https://youtube.com/x?a=1&b=2'},
      {label:'Bad',url:'javascript:alert(1)'},
    ],announcement:{enabled:false,text:'x'}});
    let p = await newPage(); await p.goto(BASE+'/index.html'); await p.waitForTimeout(300);
    let links = await p.$$eval('.site-footer .socials a',a=>a.map(x=>[x.textContent,x.getAttribute('href')]));
    check('footer rebuilt, invalid url dropped', links.length===2 && links[0][0]==='Discord' && links[1][0]==='YouTube <b>');
    check('footer href escaped properly', links[1][1]==='https://youtube.com/x?a=1&b=2');
    check('discord links rewritten (join button)', (await p.getAttribute('[data-edit="index.joinBtn"]','href'))==='https://discord.gg/NEWINVITE');
    check('no announcement when disabled', await p.locator('.announce').count()===0);
    check('no page errors (index)', p.errs.length===0); await p.close();

    // static fallback without site.json
    rm('site.json');
    p = await newPage(); await p.goto(BASE+'/index.html'); await p.waitForTimeout(300);
    check('fallback: original 4 footer links', await p.locator('.site-footer .socials a').count()===4);
    await p.close();

    // ===== announcement =====
    const ann=(o)=>write('site.json',{announcement:Object.assign({enabled:true,text:'Pas de stream <img src=x onerror="window.__x=1"> ce soir',tone:'alerte',linkLabel:'Planning',linkUrl:'planning.html',from:'',until:iso(1)},o)});
    ann({});
    p = await newPage(); await p.goto(BASE+'/clips.html'); await p.waitForTimeout(300);
    check('announce visible', await p.locator('.announce').count()===1);
    check('announce text escaped (no xss)', !(await p.evaluate(()=>window.__x)) && (await p.textContent('.announce-text')).includes('<img'));
    check('announce alerte class + link', await p.locator('.announce.announce-alerte a.announce-link[href="planning.html"]').count()===1);
    check('announce before header', await p.evaluate(()=>document.querySelector('.announce').nextElementSibling.classList.contains('site-header')));
    await p.click('.announce-close'); check('announce closes', await p.locator('.announce').count()===0);
    await p.goto(BASE+'/planning.html'); await p.waitForTimeout(300);
    check('closed announce stays closed in session', await p.locator('.announce').count()===0);
    await p.close();
    for (const [lbl,o] of [['expired',{until:iso(-1)}],['future',{from:iso(2),until:''}],['disabled',{enabled:false}],['empty text',{text:'  '}]]) {
      ann(o); p = await newPage(); await p.goto(BASE+'/index.html'); await p.waitForTimeout(250);
      check('announce hidden: '+lbl, await p.locator('.announce').count()===0); await p.close();
    }
    ann({until:iso(0),linkUrl:'javascript:alert(1)'}); p = await newPage(); await p.goto(BASE+'/index.html'); await p.waitForTimeout(250);
    check('announce visible on last day, js: link refused', await p.locator('.announce').count()===1 && await p.locator('.announce-link').count()===0); await p.close();
    rm('site.json');

    // mobile layout with announce
    ann({}); p = await browser.newPage({viewport:{width:390,height:800}}); await p.goto(BASE+'/index.html'); await p.waitForTimeout(250);
    const noOverflow = await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth);
    check('mobile: no horizontal overflow with announce', noOverflow);
    await p.click('#navToggle'); const navBox = await p.evaluate(()=>{const r=document.getElementById('nav').getBoundingClientRect();return [r.top,r.bottom,innerHeight];});
    check('mobile: nav overlay still full height under header with announce', navBox[1]>=navBox[2]-1);
    await p.screenshot({path:'announce-mobile.png'}); await p.close(); rm('site.json');

    // ===== pages.json overrides =====
    write('pages.json',{texts:{
      'index.lead':'Nouveau texte avec [Discord](https://discord.com/invite/Amgaz5YNVg) et *accent* et `code`\nligne 2 <img src=x onerror="window.__x=1">',
      'index.joinBtn':'Viens !',
      'legal.2':'Hébergement modifié',
      'coulisses.p1.title':'Titre *neuf*',
      'clips.lead':'   ',
    },extraProjects:[
      {eyebrow:'Mon outil',title:'Super *outil*',paragraphs:['Para 1','Para <b>2</b>'],stack:'Node'},
      {eyebrow:'',title:'',paragraphs:['x']},
    ]});
    write('site.json',{socials:[{label:'Discord',url:'https://discord.gg/ZZZ'}]});
    p = await newPage(); await p.goto(BASE+'/index.html'); await p.waitForTimeout(300);
    const lead = await p.innerHTML('[data-edit="index.lead"]');
    check('override applied (accent/code/br)', lead.includes('<em class="accent">accent</em>') && lead.includes('<code>code</code>') && lead.includes('<br>'));
    check('override escaped (no xss)', !(await p.evaluate(()=>window.__x)) && lead.includes('&lt;img'));
    check('override link: discord rewritten by site.json', lead.includes('href="https://discord.gg/ZZZ"'));
    check('button label override', (await p.textContent('[data-edit="index.joinBtn"]'))==='Viens !');
    check('untouched key keeps default', (await p.textContent('[data-edit="index.eyebrow"]')).includes('Multigaming'));
    await p.close();
    p = await newPage(); await p.goto(BASE+'/clips.html'); await p.waitForTimeout(300);
    check('blank override ignored', (await p.textContent('[data-edit="clips.lead"]')).includes('sélection'));
    await p.close();
    p = await newPage(); await p.goto(BASE+'/mentions-legales.html'); await p.waitForTimeout(300);
    check('legal override', (await p.textContent('[data-edit="legal.2"]'))==='Hébergement modifié'); await p.close();
    p = await newPage(); await p.goto(BASE+'/coulisses.html'); await p.waitForTimeout(300);
    check('coulisses title override', (await p.innerHTML('[data-edit="coulisses.p1.title"]')).includes('<em class="accent">neuf</em>'));
    check('extra project rendered (1 valid, empty dropped)', await p.locator('.project-text-only').count()===1);
    check('extra project content escaped', (await p.innerHTML('.project-text-only')).includes('&lt;b&gt;2&lt;/b&gt;') && (await p.innerHTML('.project-text-only h2')).includes('<em class="accent">outil</em>'));
    check('extra project after the others', await p.evaluate(()=>{const b=[...document.querySelectorAll('.project-block')];return b[b.length-1].classList.contains('project-text-only')&&b.length===9;}));
    await p.screenshot({path:'coulisses-extra.png',clip:{x:0,y:0,width:1280,height:700}});
    check('no page errors (coulisses)', p.errs.length===0); await p.close();
    rm('pages.json'); rm('site.json');
    // pages without data keep default
    p = await newPage(); await p.goto(BASE+'/coulisses.html'); await p.waitForTimeout(300);
    check('coulisses without pages.json: 7 blocks, no extras', await p.locator('.project-block').count()===8 && await p.locator('.project-text-only').count()===0);
    check('no page errors (coulisses default)', p.errs.length===0); await p.close();

    // ===== planning exceptions =====
    write('planning-exceptions.json',[
      {date:iso(-1),on:true,game:'PASSE',time:'20:00',end:'22:00',note:''},
      {date:iso(5),on:false,game:'',time:'',end:'',note:'Je suis <b>malade</b>'},
      {date:iso(2),on:true,game:'Brotato <i>',time:'20:00',end:'23:00',note:'spécial'},
      {date:'nope',on:true,game:'X'},
    ]);
    p = await newPage(); await p.goto(BASE+'/planning.html'); await p.waitForTimeout(300);
    check('exceptions visible', await p.isVisible('#exceptions'));
    check('past + invalid hidden, 2 shown', await p.locator('.exception-card').count()===2);
    check('sorted by date (on first, off second)', await p.evaluate(()=>{const c=[...document.querySelectorAll('.exception-card')];return !c[0].classList.contains('off')&&c[1].classList.contains('off');}));
    const exHtml = await p.innerHTML('#exceptionsList');
    check('exceptions escaped', exHtml.includes('&lt;b&gt;malade') && exHtml.includes('Brotato &lt;i&gt;'));
    await p.screenshot({path:'planning-exceptions.png',fullPage:false});
    check('no page errors (planning)', p.errs.length===0); await p.close();
    rm('planning-exceptions.json');
    p = await newPage(); await p.goto(BASE+'/planning.html'); await p.waitForTimeout(300);
    check('no exceptions block when file missing', !(await p.isVisible('#exceptions'))); await p.close();
  } finally {
    ['site.json','pages.json','planning-exceptions.json'].forEach(rm);
    await browser.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})();
