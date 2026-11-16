// Idées 27 (accueil vivant) et 28 (recherche dans les clips) : logique + page réelle. Lancé par run-all.js.
const test = require('node:test');
const assert = require('node:assert');
const { prochainLive, duree } = require('../js/accueil-vivant.js');
const { jeuDuTitre, correspond } = require('../js/clips-recherche.js');

const samedi = [{ day: 'Samedi', on: true, time: '21:00', game: '', biweekly: true, anchor: '2026-10-24', altGame: '7D2D' }];

test('une semaine sur 2 : samedi 21/11 = 7D2D, samedi 28/11 = repos', () => {
  const p = prochainLive(samedi, [], new Date(2026, 10, 16, 10, 0));
  assert.strictEqual(p.game, '7D2D');
  assert.strictEqual(p.debut.getDate(), 21);
  const q = prochainLive(samedi, [], new Date(2026, 10, 22, 10, 0)); // après le 21 : le 28 est une semaine sans jeu
  assert.strictEqual(q.debut.getDate(), 5); // 5 décembre
});

test('créneau du jour déjà commencé : on passe au suivant', () => {
  const p = prochainLive(samedi, [], new Date(2026, 10, 21, 21, 30));
  assert.strictEqual(p.debut.getMonth(), 11);
});

test('une exception datée remplace la semaine type', () => {
  const ex = [{ date: '2026-11-18', on: true, game: 'VALORANT', time: '20:00' }, { date: '2026-11-21', on: false }];
  const p = prochainLive(samedi, ex, new Date(2026, 10, 16, 10, 0));
  assert.strictEqual(p.game, 'VALORANT');
  assert.strictEqual(p.debut.getHours(), 20);
  const q = prochainLive(samedi, [{ date: '2026-11-21', on: false }], new Date(2026, 10, 16, 10, 0));
  assert.strictEqual(q.debut.getDate(), 5);
});

test('rien dans les 28 jours : null', () => {
  assert.strictEqual(prochainLive([], [], new Date(2026, 10, 16)), null);
});

test('durées', () => {
  assert.strictEqual(duree((4 * 1440 + 12 * 60 + 3) * 60000), '4 j 12 h 03 min');
  assert.strictEqual(duree(72 * 60000, true), '1 h 12 min');
  assert.strictEqual(duree(8 * 60000), '8 min');
  assert.strictEqual(duree(-5), '0 min');
});

test('clips : jeu tiré du titre et recherche sans accents', () => {
  assert.strictEqual(jeuDuTitre('R.E.P.O.   -   Poules!!!'), 'R.E.P.O.');
  assert.strictEqual(jeuDuTitre('Combat contre le Baron Delamore dans Cinderia'), '');
  assert.ok(correspond('Witchspire   -   magnifique', 'MAGNIF', ''));
  assert.ok(correspond('Killing Floor 3 : le chat veut me caser', 'cåser'.replace('å', 'a'), ''));
  assert.ok(correspond('Combat contre le Baron Delamore dans Cinderia', 'delamoré', ''));
  assert.ok(!correspond('Witchspire   -   magnifique', '', 'R.E.P.O.'));
  assert.ok(correspond('R.E.P.O.  -   Poules!!!', 'poule', 'R.E.P.O.'));
});

// ===== Pages réelles (copie temporaire de run-all) =====
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { BASE, ROOT, launchOpts } = require('./lib');

test('accueil en live : titre, depuis quand, textes de l\'admin', async () => {
  const f = path.join(ROOT, 'data/twitch-status.json');
  const avant = fs.existsSync(f) ? fs.readFileSync(f) : null;
  fs.writeFileSync(f, JSON.stringify({ _updated_at: new Date().toISOString(), aulit42369: { live: true, game: 'VALORANT',
    title: 'On tente le <b>silver</b>', startedAt: new Date(Date.now() - 72 * 60000).toISOString() } }));
  const browser = await chromium.launch(launchOpts);
  try {
    const p = await browser.newPage();
    await p.goto(BASE + '/index.html');
    await p.waitForSelector('.vv-live');
    const txt = await p.locator('#vivant').innerText();
    assert.match(txt, /En direct depuis 1 h 1[23] min/);
    assert.match(txt, /On tente le <b>silver<\/b>/); // titre Twitch échappé, jamais interprété
    assert.match(txt, /Rejoindre le live/i);
    // Cam 1 en live : lecteur Twitch, plus de vidéo de présentation
    assert.strictEqual(await p.locator('#camVideo').count(), 0);
    assert.strictEqual(await p.locator('#camTwitch').isHidden(), false);
  } finally {
    await browser.close();
    if (avant) fs.writeFileSync(f, avant); else fs.unlinkSync(f);
  }
});

test('accueil hors ligne et Coulisses en textes courts', async () => {
  const browser = await chromium.launch(launchOpts);
  try {
    const p = await browser.newPage();
    await p.goto(BASE + '/index.html');
    await p.waitForSelector('.vv-grille');
    assert.match(await p.locator('#vivant').innerText(), /Prochain live/i);
    // Cam 1 hors ligne : la vidéo de présentation du site à la place de l'écran de Twitch
    assert.match(await p.getAttribute('#camVideo', 'src'), /video\/presentation-chaine\.mp4$/);
    assert.strictEqual(await p.locator('#camTwitch').count(), 0);
    assert.strictEqual(await p.textContent('#camPill'), 'Présentation');
    await p.goto(BASE + '/coulisses.html');
    assert.strictEqual(await p.locator('.project-desc p[data-edit$=".court"]').count(), 17);
    assert.strictEqual(await p.locator('.texte-court, .piste-choix').count(), 0);
    assert.ok(await p.locator('[data-edit*=".etape1.t"]').count() >= 15);
    await p.goto(BASE + '/clips.html');
    assert.strictEqual(await p.locator('.cr-barre').count(), 1);
  } finally { await browser.close(); }
});

test('clips : le champ « jeu » de l\'admin passe avant le titre', () => {
  assert.ok(correspond('Combat contre le Baron Delamore dans Cinderia', '', 'Cinderia', 'Cinderia'));
  assert.ok(!correspond('R.E.P.O.  -   Poules!!!', '', 'R.E.P.O.', 'Autre jeu'));
  assert.ok(correspond('Combat contre le Baron', 'cinderia', '', 'Cinderia')); // la recherche trouve aussi le jeu
});

test('page Clips : pastille du champ « jeu » pour un Short sans tiret', async () => {
  const f = path.join(ROOT, 'data/clips.json');
  const avant = fs.existsSync(f) ? fs.readFileSync(f) : null;
  fs.writeFileSync(f, JSON.stringify([
    { youtube: 'vrwc65V23sI', title: 'Combat contre le Baron', game: 'Cinderia', dateAdded: '2026-11-07' },
    { slug: 'AwkwardSalamanderSwiftRage', title: 'R.E.P.O. - Poules', dateAdded: '2026-11-01' }]));
  const browser = await chromium.launch(launchOpts);
  try {
    const p = await browser.newPage();
    await p.goto(BASE + '/clips.html');
    await p.waitForSelector('.cr-jeux button[data-jeu="Cinderia"]');
    await p.click('.cr-jeux button[data-jeu="Cinderia"]');
    assert.strictEqual(await p.locator('.clip-card:not([hidden])').count(), 1);
    assert.strictEqual(await p.locator('.cr-jeux button[data-jeu="R.E.P.O."]').count(), 1);
  } finally {
    await browser.close();
    if (avant) fs.writeFileSync(f, avant); else fs.unlinkSync(f);
  }
});
