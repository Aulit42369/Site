/* ================================================================
   Valide la forme de data/*.json avant qu'une erreur ne casse le
   site en production.

     node scripts/validate-data.js
   Code de sortie 1 si un fichier est invalide. Un fichier absent est
   toléré (il est créé au premier enregistrement depuis l'admin).
   ================================================================ */
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./registry');

const errors = [];
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string';
const https = (v) => isStr(v) && /^https:\/\/\S+$/i.test(v);
const link = (v) => isStr(v) && (/^https?:\/\/\S+$/i.test(v) || /^[a-z0-9_-]+\.html(\?[\w=&%-]*)?(#[\w-]*)?$/i.test(v));
const date = (v) => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);

function check(cond, file, msg) { if (!cond) errors.push(`${file}: ${msg}`); }
function version(d, f) { if (isObj(d) && 'schemaVersion' in d) check(Number.isInteger(d.schemaVersion) && d.schemaVersion >= 1, f, 'schemaVersion invalide'); }

const SCHEMAS = {
  'streamers.json': { required: true, fn(d, f) {
    check(Array.isArray(d), f, 'doit être un tableau');
    (d || []).forEach((s, i) => {
      check(isObj(s) && isStr(s.name) && s.name.trim(), f, `#${i + 1} : "name" manquant`);
      check(isObj(s) && https(s.url), f, `#${i + 1} (${s && s.name}) : "url" doit commencer par https://`);
      if (isObj(s) && 'description' in s) check(isStr(s.description), f, `#${i + 1} : "description" doit être un texte`);
    });
  } },
  'clips.json': { required: true, fn(d, f) {
    check(Array.isArray(d), f, 'doit être un tableau');
    const seen = new Set();
    (d || []).forEach((c, i) => {
      check(isObj(c) && isStr(c.slug) && /^[A-Za-z0-9_-]+$/.test(c.slug), f, `#${i + 1} : "slug" invalide`);
      check(isObj(c) && isStr(c.title) && c.title.trim(), f, `#${i + 1} : "title" manquant`);
      if (isObj(c) && c.dateAdded !== undefined) check(date(c.dateAdded), f, `#${i + 1} : "dateAdded" doit être AAAA-MM-JJ`);
      if (isObj(c)) { check(!seen.has(c.slug), f, `slug en double : ${c.slug}`); seen.add(c.slug); }
    });
  } },
  'planning.json': { required: true, fn(d, f) {
    check(Array.isArray(d) && d.length === 7, f, 'doit contenir exactement 7 jours');
    (d || []).forEach((p, i) => {
      check(isObj(p) && isStr(p.day) && typeof p.on === 'boolean', f, `#${i + 1} : "day"/"on" invalides`);
      if (isObj(p)) ['time', 'end'].forEach((k) => check(p[k] === undefined || /^\d{2}:\d{2}$/.test(p[k]), f, `#${i + 1} : "${k}" doit être HH:MM`));
    });
  } },
  'planning-exceptions.json': { fn(d, f) {
    check(Array.isArray(d), f, 'doit être un tableau');
    (d || []).forEach((e, i) => check(isObj(e) && date(e.date), f, `#${i + 1} : "date" doit être AAAA-MM-JJ`));
  } },
  'apropos.json': { fn(d, f) {
    check(isObj(d), f, 'doit être un objet'); version(d, f);
    if (!isObj(d)) return;
    if (d.faq !== undefined) check(Array.isArray(d.faq) && d.faq.every((x) => isObj(x) && isStr(x.q) && isStr(x.a)), f, '"faq" : liste de {q, a}');
    if (d.twitch && d.twitch.commands !== undefined) check(Array.isArray(d.twitch.commands) && d.twitch.commands.every((x) => isObj(x) && isStr(x.cmd)), f, '"twitch.commands" invalide');
  } },
  'pages.json': { fn(d, f) {
    check(isObj(d), f, 'doit être un objet'); version(d, f);
    if (!isObj(d)) return;
    check(d.texts === undefined || (isObj(d.texts) && Object.values(d.texts).every(isStr)), f, '"texts" : clé → texte');
    check(d.extraProjects === undefined || (Array.isArray(d.extraProjects) && d.extraProjects.every((p) => isObj(p) && isStr(p.title))), f, '"extraProjects" invalide');
  } },
  'site.json': { fn(d, f) {
    check(isObj(d), f, 'doit être un objet'); version(d, f);
    if (!isObj(d)) return;
    if (d.socials !== undefined) check(Array.isArray(d.socials) && d.socials.every((s) => isObj(s) && isStr(s.label) && /^https?:\/\//i.test(s.url || '')), f, '"socials" : {label, url https}');
    if (d.escapeServerUrl) check(https(d.escapeServerUrl), f, '"escapeServerUrl" doit commencer par https://');
    const a = d.announcement;
    if (a !== undefined) {
      check(isObj(a), f, '"announcement" doit être un objet');
      if (isObj(a)) {
        check(!a.linkUrl || link(a.linkUrl), f, '"announcement.linkUrl" invalide');
        ['from', 'until'].forEach((k) => check(!a[k] || date(a[k]), f, `"announcement.${k}" doit être AAAA-MM-JJ`));
      }
    }
  } },
  'custom-pages.json': { fn(d, f) {
    check(isObj(d) && Array.isArray(d.pages), f, 'doit contenir "pages" (tableau)'); version(d, f);
    const seen = new Set();
    ((isObj(d) && d.pages) || []).forEach((p, i) => {
      check(isObj(p) && /^[a-z0-9-]{1,60}$/.test(p.slug || ''), f, `page #${i + 1} : identifiant invalide`);
      check(isObj(p) && isStr(p.title) && p.title.trim(), f, `page #${i + 1} : titre manquant`);
      if (!isObj(p)) return;
      check(!seen.has(p.slug), f, `identifiant en double : ${p.slug}`); seen.add(p.slug);
      (p.blocks || []).forEach((b, j) => {
        const w = `page "${p.slug}" bloc ${j + 1}`;
        check(isObj(b) && ['heading', 'text', 'list', 'button', 'image'].includes(b.type), f, `${w} : type inconnu`);
        if (!isObj(b)) return;
        if (b.type === 'button') check(link(b.url) && isStr(b.label), f, `${w} : bouton invalide`);
        if (b.type === 'image') check(isStr(b.url) && !b.url.includes('..'), f, `${w} : image invalide`);
        if (b.type === 'list') check(Array.isArray(b.items) && b.items.every(isStr), f, `${w} : liste invalide`);
      });
    });
  } },
};

for (const [file, s] of Object.entries(SCHEMAS)) {
  const p = path.join(ROOT, 'data', file);
  if (!fs.existsSync(p)) { if (s.required) errors.push(`${file}: fichier requis absent`); continue; }
  let d;
  try { d = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { errors.push(`${file}: JSON illisible (${e.message})`); continue; }
  s.fn(d, file);
}

if (errors.length) {
  console.error('✗ Données invalides :\n' + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}
console.log('OK : toutes les données de data/ sont valides.');
