/* ================================================================
   Miniatures des clips (18/11/2026, audit 45) : copie sur le site la
   miniature de chaque clip de data/clips.json, pour que la page Clips
   n'appelle aucun serveur tiers au chargement.
     - Clip Twitch : API Helix GET /clips?id=… → thumbnail_url
       (identifiants TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET ; sans eux,
       les clips Twitch sont simplement sautés).
     - Short YouTube : https://i.ytimg.com/vi/<id>/hqdefault.jpg (sans clé).
   Écrit img/clips/<id>.jpg + img/clips/miniatures.json ({ id: fichier }),
   lu par js/clips.js (sans entrée : vignette dessinée). Une miniature déjà
   présente n'est pas retéléchargée ; celle d'un clip retiré est supprimée.
   Ne casse jamais la construction : toute erreur = clip sauté, code 0.
   Lancé par site-construire (serveur), à côté de update-twitch-status.js.
   ================================================================ */
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const DOSSIER = path.join(RACINE, 'img', 'clips');
const LISTE = path.join(DOSSIER, 'miniatures.json');
const MAX_OCTETS = 150 * 1024; // shortcut: pas de redimensionnement (aucun outil d'image sur le serveur) ; au-delà, vignette dessinée

const nomFichier = (id) => String(id).replace(/[^\w-]/g, '').slice(0, 100) + '.jpg';

async function jetonTwitch() {
  const { TWITCH_CLIENT_ID: id, TWITCH_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) return null;
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: 'client_credentials' })
  });
  if (!res.ok) throw new Error('jeton Twitch : ' + res.status);
  return { 'Client-Id': id, Authorization: 'Bearer ' + (await res.json()).access_token };
}

/* { slug: thumbnail_url } pour les clips Twitch (100 par appel) */
async function urlsTwitch(slugs) {
  const urls = {};
  if (!slugs.length) return urls;
  const entetes = await jetonTwitch();
  if (!entetes) { console.log('miniatures : identifiants Twitch absents, clips Twitch sautés'); return urls; }
  for (let i = 0; i < slugs.length; i += 100) {
    const q = slugs.slice(i, i + 100).map((s) => 'id=' + encodeURIComponent(s)).join('&');
    const res = await fetch('https://api.twitch.tv/helix/clips?' + q, { headers: entetes });
    if (!res.ok) throw new Error('Helix /clips : ' + res.status);
    for (const c of (await res.json()).data || []) if (c.id && c.thumbnail_url) urls[c.id] = c.thumbnail_url;
  }
  return urls;
}

async function telecharger(url, fichier) {
  if (!/^https:\/\//.test(url)) return false;
  const res = await fetch(url);
  if (!res.ok || !/^image\/jpe?g/.test(res.headers.get('content-type') || '')) return false;
  const octets = Buffer.from(await res.arrayBuffer());
  if (octets.length < 1000 || octets.length > MAX_OCTETS) return false;
  fs.writeFileSync(fichier, octets);
  return true;
}

async function main() {
  let clips = [];
  try { clips = JSON.parse(fs.readFileSync(path.join(RACINE, 'data', 'clips.json'), 'utf8')); } catch { /* pas de clips */ }
  if (!Array.isArray(clips)) clips = [];
  fs.mkdirSync(DOSSIER, { recursive: true });

  const voulus = clips.map((c) => {
    if (c && typeof c.youtube === 'string' && /^[\w-]{11}$/.test(c.youtube)) return { id: c.youtube, yt: true };
    if (c && typeof c.slug === 'string' && /^[\w-]{1,100}$/.test(c.slug)) return { id: c.slug, yt: false };
    return null;
  }).filter(Boolean);

  const manquants = voulus.filter((v) => !fs.existsSync(path.join(DOSSIER, nomFichier(v.id))));
  let twitch = {};
  try { twitch = await urlsTwitch(manquants.filter((v) => !v.yt).map((v) => v.id)); }
  catch (e) { console.log('miniatures : ' + e.message + ' (clips Twitch sautés)'); }

  for (const v of manquants) {
    const url = v.yt ? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` : twitch[v.id];
    try { if (url && !(await telecharger(url, path.join(DOSSIER, nomFichier(v.id))))) console.log('miniatures : ' + v.id + ' non copiée'); }
    catch (e) { console.log('miniatures : ' + v.id + ' : ' + e.message); }
  }

  const liste = {};
  for (const v of voulus) if (fs.existsSync(path.join(DOSSIER, nomFichier(v.id)))) liste[v.id] = nomFichier(v.id);
  const gardes = new Set(Object.values(liste));
  for (const f of fs.readdirSync(DOSSIER)) if (f.endsWith('.jpg') && !gardes.has(f)) fs.unlinkSync(path.join(DOSSIER, f));
  const texte = JSON.stringify(liste, null, 2) + '\n';
  if (!fs.existsSync(LISTE) || fs.readFileSync(LISTE, 'utf8') !== texte) fs.writeFileSync(LISTE, texte);
  console.log('miniatures : ' + Object.keys(liste).length + '/' + voulus.length + ' clips');
}

if (require.main === module) main().catch((e) => { console.log('miniatures : ' + e.message); });
module.exports = { nomFichier };
