/* admin/commun.js — Socle commun : connexion, API du serveur, statut, état partagé, petits outils, classe Collection. Chargé par admin.html avant admin.js (voir l'ordre là-bas). */
/* Admin AULIT42369 : lit/écrit data/*.json sur le serveur aulit42369.fr (service site-admin), plus sur GitHub depuis le 05/11/2026. */
const OWNER = 'aulit42369';
const REPO = 'Site';

/* Échappe le texte réinjecté en HTML ci-dessous (liste + aperçus) —
   cette page ne charge pas main.js (voir plus haut), copie locale de
   la même fonction que streamers.html / clips.html / planning.html. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* Service worker requis par Chrome pour proposer l'installation de
   cette page comme application (surtout sur téléphone). Ne fait
   aucun cache, voir sw-admin.js. */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw-admin.js', { scope: 'admin.html' }).catch(() => {});
}

const authGate = document.getElementById('authGate');
const adminPanel = document.getElementById('adminPanel');
const statusMsg = document.getElementById('statusMsg');

/* Connexion (05/11/2026) : mot de passe d'Olivier, vérifié par le serveur (service site-admin, /Site/admin-api/).
   Session dans un cookie HttpOnly posé par le serveur : rien n'est gardé dans le navigateur par ce script. */
const API_ADMIN = '/Site/admin-api/';
async function apiAdmin(route, options = {}) {
  const res = await fetch(API_ADMIN + route, {
    ...options,
    credentials: 'same-origin',
    cache: 'no-store', // jamais une réponse gardée par le navigateur (05/11 : « pas connecté » gardé 10 min)
    headers: { 'Content-Type': 'application/json', 'X-Admin': '1', ...(options.headers || {}) },
  });
  if (res.status === 401 && route !== 'connexion') throw new Error('Session expirée : reconnecte-toi.');
  return res;
}
async function sessionActive() {
  try { return (await (await apiAdmin('session')).json()).connecte === true; } catch { return false; }
}

function showStatus(text, kind) {
  statusMsg.textContent = text;
  statusMsg.className = 'show ' + kind;
  if (/^(Échec : )?CONFLIT/.test(text)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'conflictReloadBtn';
    b.className = 'btn btn-secondary';
    b.style.marginLeft = '12px';
    b.textContent = 'Recharger la dernière version';
    b.addEventListener('click', async () => {
      showStatus('Rechargement...', 'pending');
      const errors = await loadAllContent();
      dirty.clear();
      if (errors.length) showStatus(errors.join(' — '), 'err');
      else showStatus('Dernière version rechargée — refais ta modification puis enregistre.', 'ok');
    });
    statusMsg.appendChild(b);
  }
}
function hideStatus() { statusMsg.className = ''; }


/* ── Modifications non enregistrées ── */
const dirty = new Set();
function markClean(path) { dirty.delete(String(path).replace(/^data\//, '').replace(/\.json$/, '')); }
function markDirty(key) { dirty.add(key); }

const nomFichier = (path) => String(path).replace(/^data\//, '').replace(/\.json$/, '');
async function readJsonFile(path) {
  const res = await apiAdmin('fichier/' + nomFichier(path));
  if (!res.ok) throw new Error('Lecture échouée (' + res.status + ')');
  const body = await res.json();
  return body.data === null ? { data: [], sha: null } : { data: body.data, sha: body.sha };
}

/* Version du format des fichiers objets (voir scripts/validate-data.js).
   Les tableaux (streamers, clips, planning) gardent leur forme. */
const SCHEMA_VERSION = 1;
async function writeJsonFile(path, data, sha, message) {
  if (data && typeof data === 'object' && !Array.isArray(data)) data = { schemaVersion: SCHEMA_VERSION, ...data };
  const res = await apiAdmin('fichier/' + nomFichier(path), { method: 'PUT', body: JSON.stringify({ data, sha, message }) });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 409) {
      const err = new Error('CONFLIT : ce contenu a été modifié ailleurs (autre appareil, restauration, agence) depuis ton chargement. Rien n\'a été écrasé. Recharge la dernière version (tes saisies non enregistrées seront perdues : copie-les avant si besoin).');
      err.conflict = true;
      throw err;
    }
    throw new Error(body.erreur || 'Écriture échouée (' + res.status + ')');
  }
  const out = await res.json();
  markClean(path);
  return { content: { sha: out.sha } }; // même forme qu'avant (result.content.sha)
}

/* ── état en mémoire ── */
let streamersState = { data: [], sha: null };
let clipsState = { data: [], sha: null };
let planningState = { data: [], sha: null };

/* ================================================================
   Nouveaux onglets : changements ponctuels du planning, textes des
   pages, liens & annonce, santé du site, historique.
   ================================================================ */
/* Lecture publique de l'API GitHub (onglet Santé), sans jeton, tant que les automatismes y tournent encore. */
async function ghApi(path) {
  return fetch('https://api.github.com/repos/' + OWNER + '/' + REPO + path, { headers: { Accept: 'application/vnd.github+json' } });
}
const strOr = (v, f = '') => (typeof v === 'string' ? v : f);
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function frDate(s) {
  const d = new Date(s + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
function agoText(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return "à l'instant";
  if (m < 90) return 'il y a ' + m + ' min';
  const h = Math.round(m / 60);
  if (h < 48) return 'il y a ' + h + ' h';
  return 'il y a ' + Math.round(h / 24) + ' jours';
}

/* ================================================================
   Couche de données partagée : une Collection = un fichier data/*.json
   (chargement, normalisation, écriture avec détection de conflit).
   ================================================================ */
class Collection {
  constructor(file, normalize) {
    this.path = 'data/' + file + '.json';
    this.key = file;
    this.normalize = normalize;
    this.state = { data: normalize(null), sha: null };
  }
  get data() { return this.state.data; }
  async load() {
    const r = await readJsonFile(this.path);
    this.state = { data: this.normalize(r.data), sha: r.sha };
    return this.state;
  }
  async save(clean, message) {
    const result = await writeJsonFile(this.path, clean, this.state.sha, message);
    this.state = { data: this.normalize(clean), sha: result.content.sha };
    return this.state;
  }
}
