/* admin/commun.js — Socle commun : jeton, API GitHub, statut, état partagé, petits outils, classe Collection. Chargé par admin.html avant admin.js (voir l'ordre là-bas). */
/* ================================================================
   Admin AULIT42369 — lit/écrit data/streamers.json et data/clips.json
   directement sur GitHub via l'API Contents, avec un jeton personnel
   gardé dans ce navigateur uniquement. Change ici si le dépôt bouge.
   ================================================================ */
const OWNER = 'aulit42369';
const REPO = 'Site';
const TOKEN_KEY = 'aulit_admin_token';

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

/* Jeton : par défaut en sessionStorage (oublié à la fermeture de l'onglet,
   invisible des autres onglets du site). localStorage seulement si
   « Se souvenir de moi » est coché : l'origine aulit42369.github.io est
   partagée avec les pages publiques et leurs scripts. */
const TOKEN_AT_KEY = 'aulit_admin_token_at';
const TOKEN_REMEMBER_KEY = 'aulit_admin_token_remember';
function getToken() {
  const s = sessionStorage.getItem(TOKEN_KEY);
  if (s) return s;
  const l = localStorage.getItem(TOKEN_KEY);
  // ancien jeton gardé sans « se souvenir » : on le déplace dans l'onglet
  if (l && localStorage.getItem(TOKEN_REMEMBER_KEY) !== '1') {
    sessionStorage.setItem(TOKEN_KEY, l);
    localStorage.removeItem(TOKEN_KEY);
  }
  return l;
}
function setToken(t, remember) {
  clearToken();
  if (remember) { localStorage.setItem(TOKEN_KEY, t); localStorage.setItem(TOKEN_REMEMBER_KEY, '1'); }
  else sessionStorage.setItem(TOKEN_KEY, t);
  localStorage.setItem(TOKEN_AT_KEY, String(Date.now()));
}
/* « Se souvenir de moi » limité à 7 jours : appelé à l'ouverture de l'admin. */
const REMEMBER_MAX_MS = 7 * 86400000;
function expireRememberedToken() {
  if (localStorage.getItem(TOKEN_REMEMBER_KEY) !== '1') return;
  const at = Number(localStorage.getItem(TOKEN_AT_KEY) || 0);
  if (!(Date.now() - at < REMEMBER_MAX_MS)) clearToken(); // date absente ou dépassée = expiré
}
function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  [TOKEN_KEY, TOKEN_AT_KEY, TOKEN_REMEMBER_KEY].forEach((k) => localStorage.removeItem(k));
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

function utf8ToB64(str) { return btoa(unescape(encodeURIComponent(str))); }
function b64ToUtf8(str) { return decodeURIComponent(escape(atob(str))); }

/* ── Modifications non enregistrées ── */
const dirty = new Set();
function markClean(path) { dirty.delete(String(path).replace(/^data\//, '').replace(/\.json$/, '')); }
function markDirty(key) { dirty.add(key); }

async function githubRequest(path, options = {}, repo = REPO) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${repo}/contents/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: 'application/vnd.github+json',
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) throw new Error('Jeton invalide ou expiré.');
  if (res.status === 403) throw new Error('Accès refusé — vérifie que le jeton a accès au dépôt "' + repo + '" (Contents: Read and write).');
  return res;
}

async function readJsonFile(path, repo = REPO) {
  const res = await githubRequest(path, {}, repo);
  if (res.status === 404) return { data: [], sha: null };
  if (!res.ok) throw new Error('Lecture échouée (' + res.status + ')');
  const body = await res.json();
  return { data: JSON.parse(b64ToUtf8(body.content)), sha: body.sha };
}

/* Version du format des fichiers objets (voir scripts/validate-data.js).
   Les tableaux (streamers, clips, planning) gardent leur forme. */
const SCHEMA_VERSION = 1;
async function writeJsonFile(path, data, sha, message, repo = REPO) {
  if (data && typeof data === 'object' && !Array.isArray(data)) data = { schemaVersion: SCHEMA_VERSION, ...data };
  const res = await githubRequest(path, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: utf8ToB64(JSON.stringify(data, null, 2)),
      ...(sha ? { sha } : {}),
    }),
  }, repo);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 409 || (res.status === 422 && /sha/i.test(body.message || ''))) {
      const err = new Error('CONFLIT : ce contenu a été modifié ailleurs (autre appareil, restauration, automatisation) depuis ton chargement. Rien n\'a été écrasé. Recharge la dernière version (tes saisies non enregistrées seront perdues : copie-les avant si besoin).');
      err.conflict = true;
      throw err;
    }
    throw new Error(body.message || 'Écriture échouée (' + res.status + ')');
  }
  const out = await res.json();
  markClean(path);
  return out;
}

/* ── état en mémoire ── */
let streamersState = { data: [], sha: null };
let clipsState = { data: [], sha: null };
let planningState = { data: [], sha: null };

/* ================================================================
   Nouveaux onglets : changements ponctuels du planning, textes des
   pages, liens & annonce, santé du site, historique.
   ================================================================ */
async function ghApi(path, options = {}) {
  return fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: 'application/vnd.github+json',
      ...(options.headers || {}),
    },
  });
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
