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

function getToken() { return localStorage.getItem(TOKEN_KEY); }
const TOKEN_AT_KEY = 'aulit_admin_token_at';
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); localStorage.setItem(TOKEN_AT_KEY, String(Date.now())); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_AT_KEY); }

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

/* ── Streamers ── */
function renderStreamers() {
  const list = document.getElementById('streamersList');
  if (streamersState.data.length === 0) {
    list.innerHTML = '<div class="empty-row">Aucun streamer pour l\'instant.</div>';
    return;
  }
  list.innerHTML = '';
  const last = streamersState.data.length - 1;
  streamersState.data.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'entry-card';
    card.innerHTML = `
      <div class="entry-order">
        <button data-up="${i}" ${i === 0 ? 'disabled' : ''} title="Monter">▲</button>
        <button data-down="${i}" ${i === last ? 'disabled' : ''} title="Descendre">▼</button>
      </div>
      <div class="entry-body">
        <div class="entry-title">${escapeHtml(s.name)}</div>
        <div class="entry-sub">${escapeHtml(s.description || '')}</div>
      </div>
      <div class="entry-actions">
        <button data-edit="${i}">Modifier</button>
        <button data-delete="${i}" class="danger">Supprimer</button>
      </div>`;
    list.appendChild(card);
  });
  list.querySelectorAll('[data-up]').forEach((btn) =>
    btn.addEventListener('click', () => moveStreamer(Number(btn.dataset.up), -1))
  );
  list.querySelectorAll('[data-down]').forEach((btn) =>
    btn.addEventListener('click', () => moveStreamer(Number(btn.dataset.down), 1))
  );
  list.querySelectorAll('[data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => openStreamerForm(Number(btn.dataset.edit)))
  );
  list.querySelectorAll('[data-delete]').forEach((btn) =>
    btn.addEventListener('click', () => deleteStreamer(Number(btn.dataset.delete)))
  );
}

async function moveStreamer(index, dir) {
  const target = index + dir;
  if (target < 0 || target >= streamersState.data.length) return;
  const next = [...streamersState.data];
  [next[index], next[target]] = [next[target], next[index]];
  showStatus('Réorganisation...', 'pending');
  try {
    const result = await writeJsonFile('data/streamers.json', next, streamersState.sha, 'Réorganisation streamers');
    streamersState = { data: next, sha: result.content.sha };
    renderStreamers();
    showStatus('Ordre mis à jour.', 'ok');
  } catch (e) {
    showStatus('Échec : ' + e.message, 'err');
  }
}

let editingStreamerIndex = null;
function openStreamerForm(index) {
  editingStreamerIndex = index;
  const s = index === null ? { name: '', url: '', description: '', avatar: '' } : streamersState.data[index];
  document.getElementById('sfName').value = s.name || '';
  document.getElementById('sfUrl').value = s.url || '';
  document.getElementById('sfDesc').value = s.description || '';
  document.getElementById('sfAvatar').value = s.avatar || '';
  document.getElementById('streamerForm').style.display = 'block';
  document.getElementById('sfPreviewBox').style.display = 'none';
}
function closeStreamerForm() {
  document.getElementById('streamerForm').style.display = 'none';
  document.getElementById('sfPreviewBox').style.display = 'none';
  editingStreamerIndex = null;
}

/* Aperçu fidèle de la carte streamer telle qu'elle apparaît sur
   streamers.html, à partir des valeurs en cours du formulaire (pas
   encore enregistrées). S'actualise en direct pendant la saisie une
   fois ouvert. */
function renderStreamerPreview() {
  const name = document.getElementById('sfName').value.trim() || 'Nom du streamer';
  const desc = document.getElementById('sfDesc').value.trim() || 'Description à venir.';
  const url = document.getElementById('sfUrl').value.trim() || '#';
  const avatar = document.getElementById('sfAvatar').value.trim();
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const card = document.getElementById('sfPreviewCard');
  card.innerHTML = `
    <div class="streamer-avatar" id="sfPreviewAvatar">${escapeHtml(initial)}</div>
    <div class="streamer-name">${escapeHtml(name)}</div>
    <p class="streamer-desc">${escapeHtml(desc)}</p>
    <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="btn btn-secondary">Voir la chaîne</a>
  `;
  if (avatar) {
    const avatarEl = document.getElementById('sfPreviewAvatar');
    const img = new Image();
    img.onload = () => {
      avatarEl.style.backgroundImage = `url('${avatar}')`;
      avatarEl.style.backgroundSize = 'cover';
      avatarEl.style.backgroundPosition = 'center';
      avatarEl.textContent = '';
    };
    img.src = avatar;
  }
}
document.getElementById('sfPreviewBtn').addEventListener('click', () => {
  const box = document.getElementById('sfPreviewBox');
  const opening = box.style.display === 'none';
  box.style.display = opening ? 'block' : 'none';
  if (opening) renderStreamerPreview();
});
['sfName', 'sfUrl', 'sfDesc', 'sfAvatar'].forEach((id) => {
  document.getElementById(id).addEventListener('input', () => {
    if (document.getElementById('sfPreviewBox').style.display !== 'none') renderStreamerPreview();
  });
});

async function saveStreamer() {
  const name = document.getElementById('sfName').value.trim();
  const url = document.getElementById('sfUrl').value.trim();
  const description = document.getElementById('sfDesc').value.trim();
  const avatar = document.getElementById('sfAvatar').value.trim();
  if (!name || !url || !description) {
    showStatus('Pseudo, URL et description sont obligatoires.', 'err');
    return;
  }
  const entry = { name, url, description };
  if (avatar) entry.avatar = avatar;

  const next = [...streamersState.data];
  if (editingStreamerIndex === null) next.push(entry);
  else next[editingStreamerIndex] = entry;

  showStatus('Enregistrement...', 'pending');
  try {
    const result = await writeJsonFile('data/streamers.json', next, streamersState.sha,
      (editingStreamerIndex === null ? 'Ajout streamer : ' : 'Modification streamer : ') + name);
    streamersState = { data: next, sha: result.content.sha };
    renderStreamers();
    closeStreamerForm();
    showStatus('Enregistré.', 'ok');
  } catch (e) {
    showStatus('Échec : ' + e.message, 'err');
  }
}

async function deleteStreamer(index) {
  const s = streamersState.data[index];
  if (!confirm(`Supprimer "${s.name}" ?`)) return;
  const next = streamersState.data.filter((_, i) => i !== index);
  showStatus('Suppression...', 'pending');
  try {
    const result = await writeJsonFile('data/streamers.json', next, streamersState.sha, 'Suppression streamer : ' + s.name);
    streamersState = { data: next, sha: result.content.sha };
    renderStreamers();
    showStatus('Supprimé.', 'ok');
  } catch (e) {
    showStatus('Échec : ' + e.message, 'err');
  }
}

/* Signale les streamers dont le lien Twitch ne répond plus (compte
   supprimé ou renommé) — détecté côté GitHub Action, voir
   scripts/update-twitch-status.js, écrit dans data/broken-links.json.
   Purement informatif : rien n'est modifié ni supprimé ici. */
async function checkBrokenLinks() {
  const warning = document.getElementById('brokenLinksWarning');
  try {
    const res = await fetch('data/broken-links.json');
    if (!res.ok) return;
    const broken = await res.json();
    if (!Array.isArray(broken) || broken.length === 0) return;
    const names = streamersState.data
      .filter((s) => {
        try {
          const username = new URL(s.url).pathname.split('/').filter(Boolean).pop().toLowerCase();
          return broken.includes(username);
        } catch {
          return false;
        }
      })
      .map((s) => s.name);
    if (names.length === 0) return;
    warning.textContent = '⚠ Lien Twitch introuvable pour : ' + names.join(', ') + ' (chaîne supprimée ou renommée ? à vérifier).';
    warning.style.display = 'block';
  } catch {
    // silencieux : purement informatif, ne doit jamais bloquer le reste de l'admin
  }
}

/* ── Clips ── */
function renderClips() {
  const list = document.getElementById('clipsList');
  if (clipsState.data.length === 0) {
    list.innerHTML = '<div class="empty-row">Aucun clip pour l\'instant.</div>';
    return;
  }
  list.innerHTML = '';
  const last = clipsState.data.length - 1;
  clipsState.data.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'entry-card';
    card.innerHTML = `
      <div class="entry-order">
        <button data-up="${i}" ${i === 0 ? 'disabled' : ''} title="Monter">▲</button>
        <button data-down="${i}" ${i === last ? 'disabled' : ''} title="Descendre">▼</button>
      </div>
      <div class="entry-body">
        <div class="entry-title">${escapeHtml(c.title)}</div>
        <div class="entry-sub">${escapeHtml(c.slug)}</div>
      </div>
      <div class="entry-actions">
        <button data-edit="${i}">Modifier</button>
        <button data-delete="${i}" class="danger">Supprimer</button>
      </div>`;
    list.appendChild(card);
  });
  list.querySelectorAll('[data-up]').forEach((btn) =>
    btn.addEventListener('click', () => moveClip(Number(btn.dataset.up), -1))
  );
  list.querySelectorAll('[data-down]').forEach((btn) =>
    btn.addEventListener('click', () => moveClip(Number(btn.dataset.down), 1))
  );
  list.querySelectorAll('[data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => openClipForm(Number(btn.dataset.edit)))
  );
  list.querySelectorAll('[data-delete]').forEach((btn) =>
    btn.addEventListener('click', () => deleteClip(Number(btn.dataset.delete)))
  );
}

async function moveClip(index, dir) {
  const target = index + dir;
  if (target < 0 || target >= clipsState.data.length) return;
  const next = [...clipsState.data];
  [next[index], next[target]] = [next[target], next[index]];
  showStatus('Réorganisation...', 'pending');
  try {
    const result = await writeJsonFile('data/clips.json', next, clipsState.sha, 'Réorganisation clips');
    clipsState = { data: next, sha: result.content.sha };
    renderClips();
    showStatus('Ordre mis à jour.', 'ok');
  } catch (e) {
    showStatus('Échec : ' + e.message, 'err');
  }
}

let editingClipIndex = null;
function openClipForm(index) {
  editingClipIndex = index;
  const c = index === null ? { slug: '', title: '' } : clipsState.data[index];
  document.getElementById('cfSlug').value = c.slug || '';
  document.getElementById('cfTitle').value = c.title || '';
  document.getElementById('clipForm').style.display = 'block';
  document.getElementById('cfPreviewBox').style.display = 'none';
}
function closeClipForm() {
  document.getElementById('clipForm').style.display = 'none';
  document.getElementById('cfPreviewBox').style.display = 'none';
  editingClipIndex = null;
}

/* Aperçu fidèle de la carte clip telle qu'elle apparaît sur
   clips.html (hors lecteur vidéo, remplacé par un cadre neutre —
   le slug n'a pas besoin d'être valide pour prévisualiser le titre). */
function renderClipPreview() {
  const title = document.getElementById('cfTitle').value.trim() || 'Titre du clip';
  const slug = document.getElementById('cfSlug').value.trim() || 'slug-du-clip';
  const badge = editingClipIndex === null ? ' <span class="badge-new">Nouveau</span>' : '';
  const card = document.getElementById('cfPreviewCard');
  card.innerHTML = `
    <div class="clip-preview-thumb">Aperçu vidéo</div>
    <div class="clip-footer">
      <div class="clip-title">${escapeHtml(title)}${badge}</div>
      <button type="button" class="share-btn" disabled>Partager</button>
    </div>
    <div class="clip-slug">${escapeHtml(slug)}</div>
  `;
}
document.getElementById('cfPreviewBtn').addEventListener('click', () => {
  const box = document.getElementById('cfPreviewBox');
  const opening = box.style.display === 'none';
  box.style.display = opening ? 'block' : 'none';
  if (opening) renderClipPreview();
});

/* Si un lien de clip complet est collé dans le champ "Slug" (le
   réflexe naturel en copiant depuis la barre d'adresse), on en
   extrait automatiquement le slug plutôt que de laisser l'URL
   entière — clips.twitch.tv/SLUG et twitch.tv/chaine/clip/SLUG,
   avec ou sans paramètres après. Un slug déjà saisi tel quel ne
   correspond à aucun des deux motifs et reste inchangé. */
function extractClipSlug(value) {
  const v = value.trim();
  let m = v.match(/clips\.twitch\.tv\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  m = v.match(/twitch\.tv\/[^/\s]+\/clip\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  return null;
}
document.getElementById('cfSlug').addEventListener('input', (e) => {
  const extracted = extractClipSlug(e.target.value);
  if (extracted && extracted !== e.target.value.trim()) {
    e.target.value = extracted;
  }
});

['cfSlug', 'cfTitle'].forEach((id) => {
  document.getElementById(id).addEventListener('input', () => {
    if (document.getElementById('cfPreviewBox').style.display !== 'none') renderClipPreview();
  });
});

async function saveClip() {
  const slug = document.getElementById('cfSlug').value.trim();
  const title = document.getElementById('cfTitle').value.trim();
  if (!slug || !title) {
    showStatus('Slug et titre sont obligatoires.', 'err');
    return;
  }
  /* Un nouveau clip est daté du jour (pour le badge "Nouveau" sur
     clips.html, 7 jours) ; une modification garde la date d'origine
     du clip au lieu de la rajeunir. */
  const entry = editingClipIndex === null
    ? { slug, title, dateAdded: new Date().toISOString().slice(0, 10) }
    : { ...clipsState.data[editingClipIndex], slug, title };
  const next = editingClipIndex === null
    ? [entry, ...clipsState.data]
    : clipsState.data.map((c, i) => (i === editingClipIndex ? entry : c));

  showStatus('Enregistrement...', 'pending');
  try {
    const result = await writeJsonFile('data/clips.json', next, clipsState.sha,
      (editingClipIndex === null ? 'Ajout clip : ' : 'Modification clip : ') + title);
    clipsState = { data: next, sha: result.content.sha };
    renderClips();
    closeClipForm();
    showStatus('Enregistré.', 'ok');
  } catch (e) {
    showStatus('Échec : ' + e.message, 'err');
  }
}

async function deleteClip(index) {
  const c = clipsState.data[index];
  if (!confirm(`Supprimer "${c.title}" ?`)) return;
  const next = clipsState.data.filter((_, i) => i !== index);
  showStatus('Suppression...', 'pending');
  try {
    const result = await writeJsonFile('data/clips.json', next, clipsState.sha, 'Suppression clip : ' + c.title);
    clipsState = { data: next, sha: result.content.sha };
    renderClips();
    showStatus('Supprimé.', 'ok');
  } catch (e) {
    showStatus('Échec : ' + e.message, 'err');
  }
}

/* ── Planning ── */
const PLANNING_COLORS = [
  { value: '#00f5ff', label: 'Cyan' },
  { value: '#9b5cff', label: 'Violet' },
  { value: '#ff2d78', label: 'Magenta' },
  { value: '#4a5568', label: 'Gris (repos)' },
];

function renderPlanning() {
  const container = document.getElementById('planningList');
  if (planningState.data.length === 0) {
    container.innerHTML = '<div class="empty-row">Rien à afficher — vérifie que data/planning.json existe dans le dépôt.</div>';
    return;
  }
  container.innerHTML = '';
  planningState.data.forEach((d, i) => {
    const row = document.createElement('div');
    row.className = 'planning-day-card';
    const options = PLANNING_COLORS.map(
      (c) => `<option value="${c.value}" ${d.color === c.value ? 'selected' : ''}>${c.label}</option>`
    ).join('');
    row.innerHTML = `
      <div class="planning-day-name">${escapeHtml(d.day)}</div>
      <label class="planning-on"><input type="checkbox" ${d.on ? 'checked' : ''} data-i="${i}" data-field="on"> Stream ce jour</label>
      <div class="planning-day-fields">
        <div class="field"><label>Début</label><input type="time" value="${d.time || ''}" data-i="${i}" data-field="time"></div>
        <div class="field"><label>Fin</label><input type="time" value="${d.end || ''}" data-i="${i}" data-field="end"></div>
        <div class="field"><label>Jeu</label><input type="text" value="${d.game || ''}" data-i="${i}" data-field="game"></div>
        <div class="field"><label>Couleur</label><select data-i="${i}" data-field="color">${options}</select></div>
      </div>`;
    container.appendChild(row);
  });
  container.querySelectorAll('[data-field]').forEach((el) => {
    el.addEventListener('change', () => {
      const i = Number(el.dataset.i);
      const field = el.dataset.field;
      planningState.data[i][field] = field === 'on' ? el.checked : el.value;
    });
  });
}

async function savePlanning() {
  showStatus('Enregistrement...', 'pending');
  try {
    const result = await writeJsonFile('data/planning.json', planningState.data, planningState.sha, 'Mise à jour planning');
    planningState.sha = result.content.sha;
    showStatus('Planning enregistré.', 'ok');
  } catch (e) {
    showStatus('Échec : ' + e.message, 'err');
  }
}

document.getElementById('savePlanningBtn').addEventListener('click', savePlanning);

/* ── À propos / FAQ ── */
/* Contenu de départ = le texte actuel de apropos.html. data/apropos.json
   n'existe pas tant qu'on n'a pas enregistré une première fois ici ;
   il est alors créé avec ce contenu (modifié). */
const DEFAULT_APROPOS = {
  chaine: {
    title: 'La chaîne',
    paragraphs: [
      "Bienvenue dans mon univers : ici on fait du multigaming, du jeu coop, on rage, on rigole et on troll les copains. Installe-toi et viens dire des bêtises avec nous.",
      "Pas de planning de jeu figé — le choix se fait à l'ambiance du soir, entre amis.",
    ],
  },
  twitch: {
    title: 'Sur Twitch',
    intro: 'Quelques commandes utiles dans le tchat :',
    commands: [
      { cmd: '!commandes', desc: 'la liste complète' },
      { cmd: '!gameinfos', desc: 'infos sur le jeu en cours' },
      { cmd: '!discord', desc: 'le lien du serveur' },
      { cmd: '!wishliststeam', desc: 'la wishlist Steam' },
      { cmd: '!regles', desc: 'le règlement du chat' },
    ],
  },
  faq: [
    { q: 'Comment participer aux streams ou échanger avec la communauté ?', a: "Le plus simple est de rejoindre le [Discord](https://discord.com/invite/Amgaz5YNVg) : c'est là que ça se passe en dehors des lives. Le [planning](planning.html) donne les prochaines dates prévues." },
    { q: 'Y a-t-il des règles à respecter dans le chat ?', a: 'Oui — tape `!regles` dans le tchat Twitch pendant un live pour afficher le règlement complet du salon.' },
    { q: 'Peut-on proposer un jeu à faire en live ?', a: "Passe par le Discord pour proposer une idée : selon l'ambiance et le planning, ça peut atterrir au programme d'un prochain stream." },
    { q: 'Quel matériel utilises-tu pour streamer ?', a: "Le setup est amené à évoluer — rien d'exceptionnel, l'essentiel reste surtout de passer un bon moment ensemble." },
  ],
};

function normalizeApropos(d) {
  const def = JSON.parse(JSON.stringify(DEFAULT_APROPOS));
  if (!d || typeof d !== 'object' || Array.isArray(d)) return def;
  const str = (v, f) => (typeof v === 'string' ? v : f);
  const arr = (v, f) => (Array.isArray(v) ? v : f);
  return {
    chaine: {
      title: str(d.chaine && d.chaine.title, def.chaine.title),
      paragraphs: arr(d.chaine && d.chaine.paragraphs, def.chaine.paragraphs).map((p) => String(p)),
    },
    twitch: {
      title: str(d.twitch && d.twitch.title, def.twitch.title),
      intro: str(d.twitch && d.twitch.intro, def.twitch.intro),
      commands: arr(d.twitch && d.twitch.commands, def.twitch.commands).map((c) => ({ cmd: str(c && c.cmd, ''), desc: str(c && c.desc, '') })),
    },
    faq: arr(d.faq, def.faq).map((f) => ({ q: str(f && f.q, ''), a: str(f && f.a, '') })),
  };
}

let aproposState = { data: normalizeApropos(null), sha: null };

function apList(name) {
  const d = aproposState.data;
  return name === 'paragraphs' ? d.chaine.paragraphs : name === 'commands' ? d.twitch.commands : d.faq;
}

function renderApropos() {
  const d = aproposState.data;
  const btns = (list, i, last, label) => `
    <div class="ap-btns">
      <button type="button" data-act="up" data-list="${list}" data-i="${i}" ${i === 0 ? 'disabled' : ''} title="Monter">▲</button>
      <button type="button" data-act="down" data-list="${list}" data-i="${i}" ${i === last ? 'disabled' : ''} title="Descendre">▼</button>
      <button type="button" class="danger" data-act="del" data-list="${list}" data-i="${i}" title="Supprimer ${label}">✕</button>
    </div>`;

  const paragraphs = d.chaine.paragraphs.map((p, i) => `
    <div class="ap-row">
      <div class="ap-fields"><div class="field"><label>Paragraphe ${i + 1}</label><textarea data-list="paragraphs" data-i="${i}" rows="3">${escapeHtml(p)}</textarea></div></div>
      ${btns('paragraphs', i, d.chaine.paragraphs.length - 1, 'ce paragraphe')}
    </div>`).join('') || '<div class="ap-empty">Aucun paragraphe.</div>';

  const commands = d.twitch.commands.map((c, i) => `
    <div class="ap-row">
      <div class="ap-fields">
        <div class="field"><label>Commande</label><input type="text" data-list="commands" data-field="cmd" data-i="${i}" value="${escapeHtml(c.cmd)}"></div>
        <div class="field"><label>Description</label><input type="text" data-list="commands" data-field="desc" data-i="${i}" value="${escapeHtml(c.desc)}"></div>
      </div>
      ${btns('commands', i, d.twitch.commands.length - 1, 'cette commande')}
    </div>`).join('') || '<div class="ap-empty">Aucune commande.</div>';

  const faq = d.faq.map((f, i) => `
    <div class="ap-row">
      <div class="ap-fields">
        <div class="field"><label>Question ${i + 1}</label><input type="text" data-list="faq" data-field="q" data-i="${i}" value="${escapeHtml(f.q)}"></div>
        <div class="field"><label>Réponse</label><textarea data-list="faq" data-field="a" data-i="${i}" rows="3">${escapeHtml(f.a)}</textarea></div>
      </div>
      ${btns('faq', i, d.faq.length - 1, 'cette question')}
    </div>`).join('') || '<div class="ap-empty">Aucune question — la section FAQ est masquée sur le site.</div>';

  document.getElementById('aproposEditor').innerHTML = `
    <div class="ap-section">
      <h2>Carte « La chaîne »</h2>
      <div class="field" style="margin-bottom:16px;"><label>Titre</label><input type="text" data-path="chaine.title" value="${escapeHtml(d.chaine.title)}"></div>
      ${paragraphs}
      <button type="button" class="ap-add" data-act="add" data-list="paragraphs">+ Ajouter un paragraphe</button>
    </div>
    <div class="ap-section">
      <h2>Carte « Sur Twitch »</h2>
      <div class="field" style="margin-bottom:12px;"><label>Titre</label><input type="text" data-path="twitch.title" value="${escapeHtml(d.twitch.title)}"></div>
      <div class="field" style="margin-bottom:16px;"><label>Phrase d'introduction</label><input type="text" data-path="twitch.intro" value="${escapeHtml(d.twitch.intro)}"></div>
      ${commands}
      <button type="button" class="ap-add" data-act="add" data-list="commands">+ Ajouter une commande</button>
    </div>
    <div class="ap-section">
      <h2>Questions fréquentes</h2>
      ${faq}
      <button type="button" class="ap-add" data-act="add" data-list="faq">+ Ajouter une question</button>
    </div>`;
}

(function wireApropos() {
  const editor = document.getElementById('aproposEditor');
  // frappe : met à jour l'état sans redessiner (garde le curseur)
  editor.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.path) {
      const [section, key] = el.dataset.path.split('.');
      aproposState.data[section][key] = el.value;
    } else if (el.dataset.list) {
      const list = apList(el.dataset.list);
      const i = Number(el.dataset.i);
      if (el.dataset.list === 'paragraphs') list[i] = el.value;
      else list[i][el.dataset.field] = el.value;
    }
  });
  // boutons : ajouter / supprimer / déplacer (redessine)
  editor.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const list = apList(btn.dataset.list);
    const i = Number(btn.dataset.i);
    const act = btn.dataset.act;
    if (act === 'add') {
      list.push(btn.dataset.list === 'paragraphs' ? '' : btn.dataset.list === 'commands' ? { cmd: '', desc: '' } : { q: '', a: '' });
    } else if (act === 'del') {
      list.splice(i, 1);
    } else if (act === 'up' && i > 0) {
      [list[i - 1], list[i]] = [list[i], list[i - 1]];
    } else if (act === 'down' && i < list.length - 1) {
      [list[i + 1], list[i]] = [list[i], list[i + 1]];
    }
    renderApropos();
    if (act === 'add') {
      const fields = editor.querySelectorAll(`[data-list="${btn.dataset.list}"]`);
      const last = fields[fields.length - (btn.dataset.list === 'paragraphs' ? 1 : 2)];
      if (last) last.focus();
    }
  });
})();

async function saveApropos() {
  const d = aproposState.data;
  const clean = {
    chaine: { title: d.chaine.title.trim(), paragraphs: d.chaine.paragraphs.map((p) => p.trim()).filter(Boolean) },
    twitch: {
      title: d.twitch.title.trim(),
      intro: d.twitch.intro.trim(),
      commands: d.twitch.commands.map((c) => ({ cmd: c.cmd.trim(), desc: c.desc.trim() })).filter((c) => c.cmd),
    },
    faq: d.faq.map((f) => ({ q: f.q.trim(), a: f.a.trim() })).filter((f) => f.q),
  };
  showStatus('Enregistrement...', 'pending');
  try {
    const result = await writeJsonFile('data/apropos.json', clean, aproposState.sha, 'Mise à jour page À propos / FAQ');
    aproposState = { data: clean, sha: result.content.sha };
    renderApropos();
    showStatus('Page À propos enregistrée.', 'ok');
  } catch (e) {
    showStatus('Échec : ' + e.message, 'err');
  }
}
document.getElementById('saveAproposBtn').addEventListener('click', saveApropos);

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

/* ── Planning : changements ponctuels (data/planning-exceptions.json) ── */
let exState = { data: [], sha: null };
function normalizeEx(d) {
  if (!Array.isArray(d)) return [];
  return d.filter((e) => e && typeof e === 'object').map((e) => ({
    date: strOr(e.date), on: e.on !== false, game: strOr(e.game), time: strOr(e.time), end: strOr(e.end), note: strOr(e.note),
  }));
}
function renderExceptions() {
  const box = document.getElementById('exceptionsEditor');
  if (exState.data.length === 0) {
    box.innerHTML = '<div class="ap-empty">Aucun changement prévu.</div>';
    return;
  }
  const today = todayStr();
  box.innerHTML = exState.data.map((e, i) => `
    <div class="ap-row ex-row ${e.date && e.date < today ? 'past' : ''}">
      <div class="ap-fields">
        <div class="ap-inline">
          <div class="field"><label>Date ${e.date && e.date < today ? '<span class="ex-past-tag">· passée</span>' : ''}</label><input type="date" data-ex="${i}" data-f="date" value="${escapeHtml(e.date)}"></div>
          <div class="field"><label>Début</label><input type="time" data-ex="${i}" data-f="time" value="${escapeHtml(e.time)}"></div>
          <div class="field"><label>Fin</label><input type="time" data-ex="${i}" data-f="end" value="${escapeHtml(e.end)}"></div>
          <div class="field"><label>Jeu</label><input type="text" data-ex="${i}" data-f="game" value="${escapeHtml(e.game)}"></div>
        </div>
        <div class="field"><label>Précision (facultatif)</label><input type="text" data-ex="${i}" data-f="note" value="${escapeHtml(e.note)}" placeholder="ex : session spéciale avec les abonnés"></div>
        <label class="ap-check" style="margin:0;"><input type="checkbox" data-ex="${i}" data-f="on" ${e.on ? 'checked' : ''}> Il y a stream ce jour-là (décoché = pas de stream)</label>
      </div>
      <div class="ap-btns"><button type="button" class="danger" data-ex-del="${i}" title="Supprimer cette date">✕</button></div>
    </div>`).join('');
}
(function wireExceptions() {
  const box = document.getElementById('exceptionsEditor');
  box.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.ex === undefined) return;
    exState.data[Number(el.dataset.ex)][el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
  });
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ex-del]');
    if (!b) return;
    exState.data.splice(Number(b.dataset.exDel), 1);
    renderExceptions();
  });
  document.getElementById('addExceptionBtn').addEventListener('click', () => {
    exState.data.push({ date: '', on: true, game: '', time: '21:00', end: '00:00', note: '' });
    renderExceptions();
    const dates = box.querySelectorAll('[data-f="date"]');
    if (dates.length) dates[dates.length - 1].focus();
  });
})();
async function saveExceptions() {
  const clean = exState.data
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date))
    .map((e) => ({ date: e.date, on: !!e.on, game: e.game.trim(), time: e.time, end: e.end, note: e.note.trim() }))
    .sort((a, b) => a.date.localeCompare(b.date));
  showStatus('Enregistrement...', 'pending');
  try {
    const result = await writeJsonFile('data/planning-exceptions.json', clean, exState.sha, 'Mise à jour des changements ponctuels du planning');
    exState = { data: clean, sha: result.content.sha };
    renderExceptions();
    showStatus('Changements ponctuels enregistrés.', 'ok');
  } catch (err) {
    showStatus('Échec : ' + err.message, 'err');
  }
}
document.getElementById('saveExceptionsBtn').addEventListener('click', saveExceptions);

/* ── Liens & annonce (data/site.json) ── */
const DEFAULT_SITE = {
  socials: [
    { label: 'Discord', url: 'https://discord.com/invite/Amgaz5YNVg' },
    { label: 'YouTube', url: 'https://www.youtube.com/@Aulit42369' },
    { label: 'Instagram', url: 'https://www.instagram.com/aulit42369/?hl=fr' },
    { label: 'TikTok', url: 'https://www.tiktok.com/@aulit42369_' },
  ],
  announcement: { enabled: false, text: '', linkLabel: '', linkUrl: '', tone: 'info', from: '', until: '' },
  escapeServerUrl: '',
};
function normalizeSite(d) {
  const def = JSON.parse(JSON.stringify(DEFAULT_SITE));
  if (!d || typeof d !== 'object' || Array.isArray(d)) return def;
  const a = d.announcement && typeof d.announcement === 'object' ? d.announcement : {};
  return {
    escapeServerUrl: strOr(d.escapeServerUrl),
    socials: Array.isArray(d.socials) ? d.socials.map((s) => ({ label: strOr(s && s.label), url: strOr(s && s.url) })) : def.socials,
    announcement: {
      enabled: !!a.enabled, text: strOr(a.text), linkLabel: strOr(a.linkLabel), linkUrl: strOr(a.linkUrl),
      tone: a.tone === 'alerte' ? 'alerte' : 'info', from: strOr(a.from), until: strOr(a.until),
    },
  };
}
let siteState = { data: normalizeSite(null), sha: null };
function announcementStatus(a) {
  if (!a.text.trim()) return 'Aucun texte saisi.';
  if (!a.enabled) return 'Désactivée — rien ne s\'affiche sur le site.';
  const t = todayStr();
  if (a.from && t < a.from) return 'Programmée — elle apparaîtra le ' + frDate(a.from) + '.';
  if (a.until && t > a.until) return 'Expirée — elle ne s\'affiche plus.';
  return 'Affichée sur toutes les pages' + (a.until ? ' jusqu\'au ' + frDate(a.until) + ' inclus' : ' (sans date de fin)') + '.';
}
function updateAnnPreview() {
  const a = siteState.data.announcement;
  const prev = document.getElementById('annPreview');
  if (!prev) return;
  prev.className = 'announce' + (a.tone === 'alerte' ? ' announce-alerte' : '');
  prev.innerHTML = '<span>' + escapeHtml(a.text || 'Ton message apparaîtra ici') + '</span>' +
    (a.linkUrl ? '<span class="announce-link">' + escapeHtml(a.linkLabel || 'En savoir plus') + '</span>' : '');
  document.getElementById('annStatus').textContent = announcementStatus(a);
}
function renderSite() {
  const d = siteState.data, a = d.announcement;
  const last = d.socials.length - 1;
  const socials = d.socials.map((s, i) => `
    <div class="ap-row">
      <div class="ap-fields">
        <div class="field"><label>Nom affiché</label><input type="text" data-sl="${i}" data-f="label" value="${escapeHtml(s.label)}"></div>
        <div class="field"><label>Adresse (https://…)</label><input type="text" data-sl="${i}" data-f="url" value="${escapeHtml(s.url)}"></div>
      </div>
      <div class="ap-btns">
        <button type="button" data-sact="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} title="Monter">▲</button>
        <button type="button" data-sact="down" data-i="${i}" ${i === last ? 'disabled' : ''} title="Descendre">▼</button>
        <button type="button" class="danger" data-sact="del" data-i="${i}" title="Supprimer ce lien">✕</button>
      </div>
    </div>`).join('') || '<div class="ap-empty">Aucun lien — le pied de page garde ses liens d\'origine.</div>';
  document.getElementById('siteEditor').innerHTML = `
    <div class="ap-section">
      <h2>Liens du pied de page</h2>
      ${socials}
      <button type="button" class="ap-add" data-sact="add">+ Ajouter un lien</button>
    </div>
    <div class="ap-section">
      <h2>Jeu Escape Fragments</h2>
      <div class="field"><label>Adresse du serveur du jeu (https://…)</label><input type="text" data-esc="escapeServerUrl" value="${escapeHtml(d.escapeServerUrl)}" placeholder="https://ton-serveur.onrender.com"></div>
      <p class="admin-note" style="margin:0;">Sert à la page « Classement des agents ». Vide = la page affiche un message d'attente. L'état du serveur est visible dans « Santé du site ».</p>
    </div>
    <div class="ap-section">
      <h2>Bandeau d'annonce</h2>
      <label class="ap-check"><input type="checkbox" data-ann="enabled" ${a.enabled ? 'checked' : ''}> Afficher le bandeau</label>
      <div class="field"><label>Message</label><input type="text" data-ann="text" maxlength="200" value="${escapeHtml(a.text)}" placeholder="ex : Pas de stream ce soir — retour demain 21h !"></div>
      <div class="ap-inline" style="margin-bottom:16px;">
        <div class="field"><label>Style</label><select data-ann="tone"><option value="info" ${a.tone === 'info' ? 'selected' : ''}>Information</option><option value="alerte" ${a.tone === 'alerte' ? 'selected' : ''}>Alerte (rose)</option></select></div>
        <div class="field"><label>Texte du lien (facultatif)</label><input type="text" data-ann="linkLabel" value="${escapeHtml(a.linkLabel)}" placeholder="ex : Voir le planning"></div>
        <div class="field"><label>Adresse du lien</label><input type="text" data-ann="linkUrl" value="${escapeHtml(a.linkUrl)}" placeholder="https://… ou planning.html"></div>
      </div>
      <div class="ap-inline" style="margin-bottom:16px;">
        <div class="field"><label>Affichée à partir du (facultatif)</label><input type="date" data-ann="from" value="${escapeHtml(a.from)}"></div>
        <div class="field"><label>Jusqu'au, inclus (facultatif)</label><input type="date" data-ann="until" value="${escapeHtml(a.until)}"></div>
      </div>
      <div class="preview-label">Aperçu</div>
      <div id="annPreview" class="announce"></div>
      <p class="admin-note" id="annStatus" style="margin:12px 0 0;"></p>
    </div>`;
  updateAnnPreview();
}
(function wireSite() {
  const ed = document.getElementById('siteEditor');
  ed.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.esc) {
      siteState.data.escapeServerUrl = el.value;
    } else if (el.dataset.sl !== undefined) {
      siteState.data.socials[Number(el.dataset.sl)][el.dataset.f] = el.value;
    } else if (el.dataset.ann) {
      siteState.data.announcement[el.dataset.ann] = el.type === 'checkbox' ? el.checked : el.value;
      updateAnnPreview();
    }
  });
  ed.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sact]');
    if (!b) return;
    const list = siteState.data.socials, i = Number(b.dataset.i), act = b.dataset.sact;
    if (act === 'add') list.push({ label: '', url: '' });
    else if (act === 'del') list.splice(i, 1);
    else if (act === 'up' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
    else if (act === 'down' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
    renderSite();
    if (act === 'add') {
      const f = ed.querySelectorAll('[data-sl][data-f="label"]');
      if (f.length) f[f.length - 1].focus();
    }
  });
})();
async function saveSite() {
  const d = siteState.data, a = d.announcement;
  const socials = d.socials.map((s) => ({ label: s.label.trim(), url: s.url.trim() })).filter((s) => s.label || s.url);
  const bad = socials.find((s) => !s.label || !/^https?:\/\//i.test(s.url));
  if (bad) return showStatus('Chaque lien a besoin d\'un nom et d\'une adresse qui commence par https://', 'err');
  const linkUrl = a.linkUrl.trim();
  if (linkUrl && !/^https?:\/\//i.test(linkUrl) && !/^[a-z0-9_-]+\.html$/i.test(linkUrl)) {
    return showStatus('Adresse du lien de l\'annonce : https://… ou une page du site (ex : planning.html).', 'err');
  }
  if (a.from && a.until && a.until < a.from) return showStatus('La date de fin est avant la date de début.', 'err');
  const esc = d.escapeServerUrl.trim().replace(/\/+$/, '');
  if (esc && !/^https:\/\/[^\s]+$/i.test(esc)) return showStatus('Adresse du serveur du jeu : elle doit commencer par https://', 'err');
  const clean = {
    escapeServerUrl: esc,
    socials,
    announcement: { enabled: !!a.enabled, text: a.text.trim(), linkLabel: a.linkLabel.trim(), linkUrl, tone: a.tone === 'alerte' ? 'alerte' : 'info', from: a.from, until: a.until },
  };
  showStatus('Enregistrement...', 'pending');
  try {
    const result = await writeJsonFile('data/site.json', clean, siteState.sha, 'Mise à jour liens et annonce');
    siteState = { data: normalizeSite(clean), sha: result.content.sha };
    renderSite();
    showStatus('Liens et annonce enregistrés.', 'ok');
  } catch (err) {
    showStatus('Échec : ' + err.message, 'err');
  }
}
document.getElementById('saveSiteBtn').addEventListener('click', saveSite);

/* ── Textes des pages (data/pages.json) ── */
const TEXT_PAGES = [
  ['index.html', 'Accueil'], ['planning.html', 'Planning'], ['clips.html', 'Clips'], ['streamers.html', 'Streamers'],
  ['apropos.html', 'À propos'], ['coulisses.html', 'Coulisses'], ['contact.html', 'Contact'], ['mentions-legales.html', 'Mentions légales'],
  ['escape-fragments.html', 'Escape Fragments (classement)'],
];
function normalizePages(d) {
  const out = { texts: {}, extraProjects: [] };
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    if (d.texts && typeof d.texts === 'object') {
      Object.keys(d.texts).forEach((k) => { if (typeof d.texts[k] === 'string') out.texts[k] = d.texts[k]; });
    }
    if (Array.isArray(d.extraProjects)) {
      out.extraProjects = d.extraProjects.filter((p) => p && typeof p === 'object').map((p) => ({
        eyebrow: strOr(p.eyebrow), title: strOr(p.title), stack: strOr(p.stack),
        ptext: (Array.isArray(p.paragraphs) ? p.paragraphs.map(String) : []).join('\n\n'),
      }));
    }
  }
  return out;
}
let pagesState = { data: normalizePages(null), sha: null };
let textesModel = null;

/* HTML d'une page → texte à balisage simple (l'inverse de renderRichText de main.js) */
function domToMarkup(node) {
  let out = '';
  node.childNodes.forEach((n) => {
    if (n.nodeType === 3) out += n.nodeValue.replace(/\s+/g, ' ');
    else if (n.nodeType === 1) {
      const inner = domToMarkup(n);
      if (n.tagName === 'EM') out += '*' + inner + '*';
      else if (n.tagName === 'A') out += '[' + inner + '](' + (n.getAttribute('href') || '') + ')';
      else if (n.tagName === 'CODE') out += '`' + inner + '`';
      else if (n.tagName === 'BR') out += '\n';
      else out += inner;
    }
  });
  return out;
}
function markupOf(el) { return domToMarkup(el).replace(/ *\n */g, '\n').trim(); }

async function loadTextes() {
  if (textesModel) return;
  const box = document.getElementById('textesEditor');
  box.innerHTML = '<div class="ap-empty">Chargement des pages…</div>';
  try {
    const t = Date.now();
    const groups = [];
    for (const [file, title] of TEXT_PAGES) {
      const res = await fetch(file + '?t=' + t, { cache: 'no-store' });
      if (!res.ok) continue;
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      const fields = [...doc.querySelectorAll('[data-edit]')].map((el) => {
        const key = el.getAttribute('data-edit');
        const def = markupOf(el);
        const ov = pagesState.data.texts[key];
        const rawLabel = el.getAttribute('data-edit-label') || key;
        const label = /élément \d+$/.test(rawLabel) ? rawLabel.replace(/élément \d+$/, '« ' + def.slice(0, 45).replace(/[`*\[\]]/g, '') + (def.length > 45 ? '…' : '') + ' »') : rawLabel;
        return { key, label, def, value: typeof ov === 'string' && ov.trim() ? ov : def };
      });
      if (fields.length) groups.push({ file, title, fields });
    }
    textesModel = groups;
    renderTextes();
  } catch (e) {
    box.innerHTML = '<div class="ap-empty">Impossible de charger les pages : ' + escapeHtml(e.message) + '</div>';
  }
}
function renderTextes() {
  const box = document.getElementById('textesEditor');
  const openFiles = new Set([...box.querySelectorAll('details[open]')].map((d) => d.dataset.file));
  box.innerHTML = textesModel.map((g) => {
    const modified = g.fields.filter((f) => f.value !== f.def).length;
    return `<details class="tx-group" data-file="${escapeHtml(g.file)}" ${openFiles.has(g.file) ? 'open' : ''}><summary>${escapeHtml(g.title)}<span class="tx-count">${g.fields.length} textes${modified ? ' · ' + modified + ' modifié' + (modified > 1 ? 's' : '') : ''}</span></summary>
      <div class="tx-body"><div style="margin-bottom:12px;"><button type="button" class="btn btn-secondary" data-preview="${escapeHtml(g.file)}">Aperçu de la page avec ces textes</button></div><div class="tx-preview" data-prev-for="${escapeHtml(g.file)}"></div>${g.fields.map((f) => `
        <div class="field tx-field ${f.value !== f.def ? 'modified' : ''}">
          <label>${escapeHtml(f.label)}<button type="button" class="tx-reset" data-reset="${escapeHtml(f.key)}">Rétablir</button></label>
          <textarea data-tk="${escapeHtml(f.key)}" rows="${Math.min(10, Math.max(1, Math.ceil(f.value.length / 80) + (f.value.match(/\n/g) || []).length))}">${escapeHtml(f.value)}</textarea>
        </div>`).join('')}</div></details>`;
  }).join('') || '<div class="ap-empty">Aucun texte éditable trouvé.</div>';
}
function textField(key) {
  for (const g of textesModel || []) for (const f of g.fields) if (f.key === key) return f;
  return null;
}
function previewPage(file) {
  const g = (textesModel || []).find((x) => x.file === file);
  const holder = document.querySelector('[data-prev-for="' + file + '"]');
  if (!g || !holder) return;
  holder.innerHTML = '';
  const fr = document.createElement('iframe');
  fr.title = 'Aperçu ' + file;
  fr.style.cssText = 'width:100%;height:520px;border:1px solid var(--line);border-radius:4px;background:#070a10;margin-bottom:14px;';
  fr.addEventListener('load', () => {
    const w = fr.contentWindow;
    Promise.resolve(w.pagesDataPromise).then(() => {
      g.fields.forEach((f) => {
        if (!f.value.trim()) return;
        const el = w.document.querySelector('[data-edit="' + f.key.replace(/"/g, '') + '"]');
        if (el && typeof w.renderRichText === 'function') el.innerHTML = w.renderRichText(f.value);
      });
    }).catch(() => {});
  });
  fr.src = file;
  holder.appendChild(fr);
}
(function wireTextes() {
  const box = document.getElementById('textesEditor');
  box.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.dataset.tk) return;
    const f = textField(el.dataset.tk);
    if (!f) return;
    f.value = el.value;
    el.closest('.tx-field').classList.toggle('modified', el.value.trim() !== '' && el.value !== f.def);
  });
  box.addEventListener('click', (e) => {
    const pv = e.target.closest('[data-preview]');
    if (pv) { previewPage(pv.dataset.preview); return; }
    const b = e.target.closest('[data-reset]');
    if (!b) return;
    const f = textField(b.dataset.reset);
    if (!f) return;
    f.value = f.def;
    const wrap = b.closest('.tx-field');
    wrap.querySelector('textarea').value = f.def;
    wrap.classList.remove('modified');
  });
})();

/* projets supplémentaires de la page Coulisses */
function renderExtra() {
  const list = pagesState.data.extraProjects;
  const last = list.length - 1;
  const rows = list.map((p, i) => `
    <div class="ap-row">
      <div class="ap-fields">
        <div class="field"><label>Sur-titre (ex : Mon nouvel outil)</label><input type="text" data-xp="${i}" data-f="eyebrow" value="${escapeHtml(p.eyebrow)}"></div>
        <div class="field"><label>Titre (<code>*mot*</code> = mot en couleur)</label><input type="text" data-xp="${i}" data-f="title" value="${escapeHtml(p.title)}"></div>
        <div class="field"><label>Description (une ligne vide = nouveau paragraphe)</label><textarea data-xp="${i}" data-f="ptext" rows="5">${escapeHtml(p.ptext)}</textarea></div>
        <div class="field"><label>Technologies (facultatif)</label><input type="text" data-xp="${i}" data-f="stack" value="${escapeHtml(p.stack)}"></div>
      </div>
      <div class="ap-btns">
        <button type="button" data-xact="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} title="Monter">▲</button>
        <button type="button" data-xact="down" data-i="${i}" ${i === last ? 'disabled' : ''} title="Descendre">▼</button>
        <button type="button" class="danger" data-xact="del" data-i="${i}" title="Supprimer ce projet">✕</button>
      </div>
    </div>`).join('') || '<div class="ap-empty">Aucun projet supplémentaire.</div>';
  document.getElementById('extraEditor').innerHTML = `
    <div class="ap-section" style="margin-top:20px;">
      <h2>Projets supplémentaires (page Coulisses)</h2>
      <p class="admin-note" style="margin-bottom:16px;">Texte seul (sans schéma), affichés à la suite des projets existants.</p>
      ${rows}
      <button type="button" class="ap-add" data-xact="add">+ Ajouter un projet</button>
    </div>`;
}
(function wireExtra() {
  const box = document.getElementById('extraEditor');
  box.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.xp === undefined) return;
    pagesState.data.extraProjects[Number(el.dataset.xp)][el.dataset.f] = el.value;
  });
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-xact]');
    if (!b) return;
    const list = pagesState.data.extraProjects, i = Number(b.dataset.i), act = b.dataset.xact;
    if (act === 'add') list.push({ eyebrow: '', title: '', ptext: '', stack: '' });
    else if (act === 'del') list.splice(i, 1);
    else if (act === 'up' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
    else if (act === 'down' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
    renderExtra();
    if (act === 'add') {
      const f = box.querySelectorAll('[data-f="eyebrow"]');
      if (f.length) f[f.length - 1].focus();
    }
  });
})();
async function saveTextes() {
  const texts = {};
  if (textesModel) {
    const known = new Set();
    textesModel.forEach((g) => g.fields.forEach((f) => {
      known.add(f.key);
      if (f.value.trim() && f.value !== f.def) texts[f.key] = f.value;
    }));
    // garde les modifications de pages qu'on n'a pas pu relire
    Object.keys(pagesState.data.texts).forEach((k) => { if (!known.has(k)) texts[k] = pagesState.data.texts[k]; });
  } else {
    Object.assign(texts, pagesState.data.texts);
  }
  const extraProjects = pagesState.data.extraProjects.map((p) => ({
    eyebrow: p.eyebrow.trim(), title: p.title.trim(), stack: p.stack.trim(),
    paragraphs: p.ptext.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean),
  })).filter((p) => p.title);
  const clean = { texts, extraProjects };
  const before = pagesState.data.texts;
  const changed = Object.keys(texts).filter((k) => before[k] !== texts[k]);
  const reset = Object.keys(before).filter((k) => !(k in texts));
  const extraChanged = JSON.stringify(extraProjects) !== JSON.stringify(pagesState.data.extraProjects.map((p) => ({ eyebrow: p.eyebrow.trim(), title: p.title.trim(), stack: p.stack.trim(), paragraphs: p.ptext.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean) })).filter((p) => p.title));
  if (!changed.length && !reset.length && !extraChanged) return showStatus('Aucune modification à enregistrer.', 'pending');
  const labelOf = (k) => { const f = textField(k); return f ? f.label : k; };
  const summary = [].concat(changed.slice(0, 8).map((k) => '• modifié : ' + labelOf(k)), reset.slice(0, 4).map((k) => '• rétabli : ' + labelOf(k)), extraChanged ? ['• projets supplémentaires Coulisses'] : []);
  if (changed.length > 8 || reset.length > 4) summary.push('• … et d\'autres');
  if (!confirm('Enregistrer ' + (changed.length + reset.length + (extraChanged ? 1 : 0)) + ' changement(s) ?\n\n' + summary.join('\n'))) return;
  showStatus('Enregistrement...', 'pending');
  try {
    const result = await writeJsonFile('data/pages.json', clean, pagesState.sha, 'Mise à jour des textes des pages');
    pagesState = { data: normalizePages(clean), sha: result.content.sha };
    renderExtra();
    if (textesModel) renderTextes();
    showStatus('Textes enregistrés.', 'ok');
  } catch (err) {
    showStatus('Échec : ' + err.message, 'err');
  }
}
document.getElementById('saveTextesBtn').addEventListener('click', saveTextes);

/* ── Santé du site ── */
async function loadSante() {
  const box = document.getElementById('santeBox');
  box.innerHTML = '<div class="ap-empty">Analyse en cours…</div>';
  const t = Date.now();
  const getJson = async (p) => {
    try { const r = await fetch(p + '?t=' + t, { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch (e) { return null; }
  };
  const rows = [];
  const [status, broken, games] = await Promise.all([
    getJson('data/twitch-status.json'), getJson('data/broken-links.json'), getJson('data/recent-games.json'),
  ]);

  if (!status || !status._updated_at) {
    rows.push({ level: 'err', title: 'Statut Twitch', detail: 'Fichier absent ou sans date — l\'automatisation n\'a jamais tourné ?' });
  } else {
    const age = Date.now() - new Date(status._updated_at).getTime();
    const level = age < 30 * 60000 ? 'ok' : age < 3 * 3600000 ? 'warn' : 'err';
    rows.push({
      level, title: 'Statut Twitch (direct, abonnés, avatars)',
      detail: 'Dernière mise à jour ' + agoText(age) + '.' + (level === 'ok' ? '' : ' Le bandeau « En direct » est masqué au-delà de 30 min : lance une mise à jour ci-dessous, et vérifie le cron-job.org si ça se répète.'),
    });
  }
  if (Array.isArray(broken)) {
    rows.push(broken.length === 0
      ? { level: 'ok', title: 'Liens de streamers', detail: 'Aucun lien Twitch introuvable.' }
      : { level: 'warn', title: 'Liens de streamers', detail: 'Pseudos introuvables sur Twitch : ' + broken.map(escapeHtml).join(', ') + ' (chaîne supprimée ou renommée ?).' });
  }
  if (Array.isArray(games) && games.length) {
    const last = games.map((g) => g.date).filter(Boolean).sort().pop();
    if (last) {
      const days = Math.round((Date.now() - new Date(last + 'T12:00:00').getTime()) / 86400000);
      rows.push({ level: days <= 14 ? 'ok' : 'warn', title: 'Jeux récents (page À propos)', detail: 'Dernier jeu enregistré le ' + escapeHtml(frDate(last)) + (days > 14 ? ' — ça fait un moment, pas de stream ou automatisation en panne ?' : '.') });
    }
  }

  const escUrl = (siteState.data.escapeServerUrl || '').trim();
  if (escUrl) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 9000);
      const r = await fetch(escUrl.replace(/\/+$/, '') + '/api/ping', { cache: 'no-store', signal: ctl.signal });
      clearTimeout(timer);
      rows.push(r.ok ? { level: 'ok', title: 'Serveur Escape Fragments', detail: 'Le serveur du jeu répond.' }
        : { level: 'warn', title: 'Serveur Escape Fragments', detail: 'Le serveur répond avec une erreur (' + r.status + ').' });
    } catch (e) {
      rows.push({ level: 'warn', title: 'Serveur Escape Fragments', detail: 'Injoignable ou endormi (l\'hébergement gratuit se met en veille après un moment sans visite : normal, il se réveille en ~30 s). La page de classement affiche alors un message d\'attente.' });
    }
  }

  // Workflows GitHub Actions + dernier déploiement Pages (nécessitent un jeton avec accès Actions / Pages en lecture)
  try {
    const res = await ghApi('/actions/runs?per_page=40');
    if (res.ok) {
      const body = await res.json();
      const latest = {};
      (body.workflow_runs || []).forEach((r) => { if (!latest[r.name]) latest[r.name] = r; });
      const names = Object.keys(latest);
      if (names.length === 0) rows.push({ level: 'warn', title: 'Automatisations GitHub', detail: 'Aucune exécution récente trouvée.' });
      names.forEach((n) => {
        const r = latest[n];
        const level = r.status !== 'completed' ? 'ok' : r.conclusion === 'success' ? 'ok' : r.conclusion === 'skipped' || r.conclusion === 'cancelled' ? 'warn' : 'err';
        const state = r.status !== 'completed' ? 'en cours' : ({ success: 'réussie', failure: 'échouée', cancelled: 'annulée', skipped: 'ignorée', timed_out: 'expirée' }[r.conclusion] || r.conclusion);
        rows.push({ level, title: 'Automatisation : ' + n, detail: 'Dernière exécution ' + state + ', ' + agoText(Date.now() - new Date(r.updated_at).getTime()) + (level === 'err' ? ' — <a href="' + escapeHtml(r.html_url) + '" target="_blank" rel="noopener">voir le détail sur GitHub</a>' : '') + '.' });
      });
    } else {
      rows.push({ level: 'warn', title: 'Automatisations GitHub', detail: 'Lecture impossible (' + res.status + ') : le jeton doit avoir la permission « Actions : Read » pour afficher leur état.' });
    }
  } catch (e) {
    rows.push({ level: 'warn', title: 'Automatisations GitHub', detail: 'Lecture impossible (' + escapeHtml(e.message) + ').' });
  }
  try {
    const res = await ghApi('/pages/builds/latest');
    if (res.ok) {
      const b = await res.json();
      const level = b.status === 'built' ? 'ok' : b.status === 'errored' ? 'err' : 'warn';
      rows.push({ level, title: 'Publication du site (GitHub Pages)', detail: (b.status === 'built' ? 'Dernière publication réussie, ' : 'Statut « ' + escapeHtml(b.status) + ' », ') + agoText(Date.now() - new Date(b.updated_at).getTime()) + '.' });
    }
  } catch (e) { /* purement informatif */ }

  box.innerHTML = `<div class="ap-section" style="margin-bottom:0;">${rows.map((r) => `
    <div class="health-row"><span class="health-dot ${r.level}"></span><div><div class="health-title">${escapeHtml(r.title)}</div><div class="health-detail">${r.detail}</div></div></div>`).join('')}</div>`;
}
document.getElementById('santeRefreshBtn').addEventListener('click', loadSante);
document.getElementById('twitchRunBtn').addEventListener('click', async () => {
  showStatus('Demande envoyée à GitHub...', 'pending');
  try {
    const res = await ghApi('/actions/workflows/twitch-status.yml/dispatches', { method: 'POST', body: JSON.stringify({ ref: 'main' }) });
    if (res.status === 204) showStatus('Mise à jour Twitch lancée — compte environ une minute, puis clique sur « Actualiser ».', 'ok');
    else if (res.status === 403 || res.status === 404) showStatus('Refusé par GitHub : le jeton doit avoir la permission « Actions : Read and write ».', 'err');
    else showStatus('Échec du lancement (' + res.status + ').', 'err');
  } catch (e) {
    showStatus('Échec : ' + e.message, 'err');
  }
});

/* ── Historique et restauration ── */
const HIST_FILES = [
  ['streamers', 'Streamers'], ['clips', 'Clips'], ['planning', 'Planning (semaine type)'],
  ['planning-exceptions', 'Planning (changements ponctuels)'], ['apropos', 'À propos / FAQ'],
  ['pages', 'Textes des pages'], ['custom-pages', 'Pages personnalisées'], ['site', 'Liens & annonce'],
];
document.getElementById('histFile').innerHTML = HIST_FILES.map(([v, l]) => `<option value="${v}">${escapeHtml(l)}</option>`).join('');
async function loadHistory() {
  const file = document.getElementById('histFile').value;
  const box = document.getElementById('histList');
  box.innerHTML = '<div class="ap-empty">Chargement…</div>';
  try {
    const res = await ghApi('/commits?path=' + encodeURIComponent('data/' + file + '.json') + '&per_page=20');
    if (!res.ok) throw new Error('Lecture impossible (' + res.status + ')');
    const commits = await res.json();
    if (!Array.isArray(commits) || commits.length === 0) {
      box.innerHTML = '<div class="ap-empty">Aucune version enregistrée pour ce contenu (rien n\'a encore été sauvegardé depuis l\'admin).</div>';
      return;
    }
    box.innerHTML = '<div class="ap-section" style="margin-bottom:0;">' + commits.map((c, i) => {
      const when = new Date(c.commit.author.date).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
      return `<div class="hist-row">
        <div class="hist-meta"><div class="hist-date">${escapeHtml(when)}${i === 0 ? ' · version actuelle' : ''}</div><div class="hist-msg">${escapeHtml((c.commit.message || '').split('\n')[0])}</div></div>
        <div class="ap-btns" style="flex-direction:row;">
          <button type="button" data-hview="${c.sha}">Voir</button>
          ${i === 0 ? '' : `<button type="button" data-hrestore="${c.sha}" data-when="${escapeHtml(when)}">Restaurer</button>`}
        </div>
        <pre class="hist-pre" style="display:none;"></pre>
      </div>`;
    }).join('') + '</div>';
  } catch (e) {
    box.innerHTML = '<div class="ap-empty">' + escapeHtml(e.message) + '</div>';
  }
}
async function readJsonAt(file, sha) {
  const res = await githubRequest('data/' + file + '.json?ref=' + sha);
  if (!res.ok) throw new Error('Lecture de cette version impossible (' + res.status + ')');
  const body = await res.json();
  return JSON.parse(b64ToUtf8(body.content));
}
document.getElementById('histFile').addEventListener('change', loadHistory);
document.getElementById('histList').addEventListener('click', async (e) => {
  const file = document.getElementById('histFile').value;
  const view = e.target.closest('[data-hview]');
  const restore = e.target.closest('[data-hrestore]');
  if (view) {
    const pre = view.closest('.hist-row').querySelector('.hist-pre');
    if (pre.style.display !== 'none') { pre.style.display = 'none'; return; }
    pre.style.display = 'block';
    pre.textContent = 'Chargement…';
    try {
      const data = await readJsonAt(file, view.dataset.hview);
      const txt = JSON.stringify(data, null, 2);
      pre.textContent = txt.length > 4000 ? txt.slice(0, 4000) + '\n…' : txt;
    } catch (err) { pre.textContent = err.message; }
  } else if (restore) {
    if (!confirm('Restaurer la version du ' + restore.dataset.when + ' ?\nLa version actuelle reste dans l\'historique.')) return;
    showStatus('Restauration...', 'pending');
    try {
      const data = await readJsonAt(file, restore.dataset.hrestore);
      const cur = await readJsonFile('data/' + file + '.json');
      await writeJsonFile('data/' + file + '.json', data, cur.sha, 'Restauration de data/' + file + '.json (version du ' + restore.dataset.when + ')');
      await loadAllContent();
      showStatus('Version du ' + restore.dataset.when + ' restaurée.', 'ok');
      loadHistory();
    } catch (err) {
      showStatus('Échec : ' + err.message, 'err');
    }
  }
});

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

/* ── Pages personnalisées (data/custom-pages.json) ── */
const BLOCK_TYPES = [['heading', 'Titre'], ['text', 'Texte'], ['list', 'Liste'], ['button', 'Bouton'], ['image', 'Image']];
function normalizeCustom(d) {
  const pages = d && typeof d === 'object' && Array.isArray(d.pages) ? d.pages : [];
  return {
    pages: pages.filter((p) => p && typeof p === 'object').map((p) => ({
      slug: strOr(p.slug), title: strOr(p.title), intro: strOr(p.intro),
      published: p.published !== false, menu: !!p.menu,
      blocks: (Array.isArray(p.blocks) ? p.blocks : []).filter((b) => b && typeof b === 'object').map((b) => ({
        type: BLOCK_TYPES.some((t) => t[0] === b.type) ? b.type : 'text',
        text: strOr(b.text), label: strOr(b.label), url: strOr(b.url), alt: strOr(b.alt),
        itemsText: (Array.isArray(b.items) ? b.items.filter((x) => typeof x === 'string') : []).join('\n'),
      })),
    })),
  };
}
const customCol = new Collection('custom-pages', normalizeCustom);
function slugify(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
const okLink = (u) => /^https?:\/\//i.test(u) || /^[a-z0-9_-]+\.html(\?[\w=&%-]*)?(#[\w-]*)?$/i.test(u);
const okImage = (u) => !u.includes('..') && (/^https:\/\//i.test(u) || /^[A-Za-z0-9_./-]+\.(png|jpe?g|gif|webp|svg)$/i.test(u));
let savedSlugs = new Set();
function blockFields(b, pi, bi) {
  const f = (name, label, val, ph, area) => `<div class="field"><label>${label}</label>${area
    ? `<textarea rows="3" data-pi="${pi}" data-bi="${bi}" data-bf="${name}" placeholder="${escapeHtml(ph || '')}">${escapeHtml(val)}</textarea>`
    : `<input type="text" data-pi="${pi}" data-bi="${bi}" data-bf="${name}" value="${escapeHtml(val)}" placeholder="${escapeHtml(ph || '')}">`}</div>`;
  if (b.type === 'heading') return f('text', 'Titre', b.text);
  if (b.type === 'text') return f('text', 'Texte (*mot* en couleur, [mot](lien), Entrée = retour à la ligne)', b.text, '', true);
  if (b.type === 'list') return f('itemsText', 'Éléments (un par ligne)', b.itemsText, '', true);
  if (b.type === 'button') return f('label', 'Texte du bouton', b.label) + f('url', 'Adresse (https://… ou page.html)', b.url);
  return f('url', 'Adresse de l\'image (https://… ou images/fichier.png)', b.url) + f('alt', 'Description (légende + accessibilité)', b.alt);
}
function renderPagesEditor() {
  const pages = customCol.data.pages;
  const open = new Set([...document.querySelectorAll('#pagesEditor details[open]')].map((d) => d.dataset.pi));
  document.getElementById('pagesEditor').innerHTML = pages.map((p, pi) => `
    <details class="tx-group" data-pi="${pi}" ${open.has(String(pi)) ? 'open' : ''}>
      <summary>${escapeHtml(p.title || 'Nouvelle page')}<span class="tx-count">${p.published ? 'publiée' : 'brouillon'}${p.menu ? ' · menu' : ''} · ${p.blocks.length} bloc${p.blocks.length > 1 ? 's' : ''}</span></summary>
      <div class="tx-body">
        <div class="ap-inline">
          <div class="field"><label>Titre de la page</label><input type="text" data-pi="${pi}" data-pf="title" value="${escapeHtml(p.title)}"></div>
          <div class="field"><label>Identifiant (adresse)</label><input type="text" data-pi="${pi}" data-pf="slug" value="${escapeHtml(p.slug)}" placeholder="auto d'après le titre"></div>
        </div>
        <div class="field"><label>Introduction (facultatif)</label><textarea rows="2" data-pi="${pi}" data-pf="intro">${escapeHtml(p.intro)}</textarea></div>
        <label class="ap-check"><input type="checkbox" data-pi="${pi}" data-pf="published" ${p.published ? 'checked' : ''}> Publiée (visible sur le site)</label>
        <label class="ap-check"><input type="checkbox" data-pi="${pi}" data-pf="menu" ${p.menu ? 'checked' : ''}> Dans le menu de navigation</label>
        ${p.blocks.map((b, bi) => `
          <div class="ap-row">
            <div class="ap-fields">
              <div class="field"><label>Bloc ${bi + 1}</label><select data-pi="${pi}" data-bi="${bi}" data-bf="type">${BLOCK_TYPES.map(([v, l]) => `<option value="${v}" ${b.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
              ${blockFields(b, pi, bi)}
            </div>
            <div class="ap-btns">
              <button type="button" data-pact="bup" data-pi="${pi}" data-bi="${bi}" ${bi === 0 ? 'disabled' : ''} title="Monter">▲</button>
              <button type="button" data-pact="bdown" data-pi="${pi}" data-bi="${bi}" ${bi === p.blocks.length - 1 ? 'disabled' : ''} title="Descendre">▼</button>
              <button type="button" class="danger" data-pact="bdel" data-pi="${pi}" data-bi="${bi}" title="Supprimer ce bloc">✕</button>
            </div>
          </div>`).join('')}
        <button type="button" class="ap-add" data-pact="badd" data-pi="${pi}">+ Ajouter un bloc</button>
        <div class="form-actions" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
          ${savedSlugs.has(p.slug) ? `<a class="btn btn-secondary" href="page.html?p=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">Voir la page</a>` : '<span class="admin-note" style="margin:0;">Enregistre pour pouvoir voir la page en ligne.</span>'}
          <button type="button" class="btn btn-secondary danger" data-pact="pdel" data-pi="${pi}">Supprimer cette page</button>
        </div>
      </div>
    </details>`).join('') || '<div class="ap-empty">Aucune page personnalisée pour l\'instant.</div>';
}
(function wirePages() {
  const ed = document.getElementById('pagesEditor');
  ed.addEventListener('input', (e) => {
    const el = e.target;
    const p = customCol.data.pages[Number(el.dataset.pi)];
    if (!p) return;
    if (el.dataset.pf) p[el.dataset.pf] = el.type === 'checkbox' ? el.checked : el.value;
    else if (el.dataset.bf) {
      p.blocks[Number(el.dataset.bi)][el.dataset.bf] = el.value;
      if (el.dataset.bf === 'type') renderPagesEditor();
    }
    if (el.dataset.pf === 'title') {
      const s = el.closest('details').querySelector('summary');
      s.firstChild.textContent = el.value || 'Nouvelle page';
    }
  });
  ed.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pact]');
    if (!b) return;
    const pages = customCol.data.pages, pi = Number(b.dataset.pi), bi = Number(b.dataset.bi), act = b.dataset.pact;
    const p = pages[pi];
    if (act === 'pdel') { if (!confirm('Supprimer la page « ' + (p.title || 'sans titre') + ' » ?')) return; pages.splice(pi, 1); }
    else if (act === 'badd') p.blocks.push({ type: 'text', text: '', label: '', url: '', alt: '', itemsText: '' });
    else if (act === 'bdel') p.blocks.splice(bi, 1);
    else if (act === 'bup' && bi > 0) [p.blocks[bi - 1], p.blocks[bi]] = [p.blocks[bi], p.blocks[bi - 1]];
    else if (act === 'bdown' && bi < p.blocks.length - 1) [p.blocks[bi + 1], p.blocks[bi]] = [p.blocks[bi], p.blocks[bi + 1]];
    renderPagesEditor();
  });
})();
document.getElementById('addPageBtn').addEventListener('click', () => {
  customCol.data.pages.push({ slug: '', title: '', intro: '', published: false, menu: false, blocks: [{ type: 'text', text: '', label: '', url: '', alt: '', itemsText: '' }] });
  markDirty('custom-pages');
  renderPagesEditor();
  const all = document.querySelectorAll('#pagesEditor details');
  const last = all[all.length - 1];
  last.open = true;
  last.querySelector('input').focus();
});
async function savePages() {
  const out = [];
  const seen = new Set();
  for (const [i, p] of customCol.data.pages.entries()) {
    const title = p.title.trim();
    const slug = (p.slug.trim() || slugify(title)).toLowerCase();
    const name = title || 'Page ' + (i + 1);
    if (!title) return showStatus('« ' + name + ' » : le titre est obligatoire.', 'err');
    if (!/^[a-z0-9-]{1,60}$/.test(slug)) return showStatus('« ' + name + ' » : identifiant invalide (lettres minuscules, chiffres et tirets).', 'err');
    if (seen.has(slug)) return showStatus('Deux pages ont le même identifiant « ' + slug + ' ».', 'err');
    seen.add(slug);
    const blocks = [];
    for (const [bi, b] of p.blocks.entries()) {
      const where = '« ' + name + ' », bloc ' + (bi + 1);
      if (b.type === 'heading' || b.type === 'text') {
        if (!b.text.trim()) continue;
        blocks.push({ type: b.type, text: b.text.trim() });
      } else if (b.type === 'list') {
        const items = b.itemsText.split('\n').map((x) => x.trim()).filter(Boolean);
        if (items.length) blocks.push({ type: 'list', items });
      } else if (b.type === 'button') {
        if (!b.label.trim() && !b.url.trim()) continue;
        if (!b.label.trim() || !okLink(b.url.trim())) return showStatus(where + ' : un bouton a besoin d\'un texte et d\'une adresse (https://… ou page.html).', 'err');
        blocks.push({ type: 'button', label: b.label.trim(), url: b.url.trim() });
      } else if (b.type === 'image') {
        if (!b.url.trim()) continue;
        if (!okImage(b.url.trim())) return showStatus(where + ' : adresse d\'image invalide (https://… ou images/fichier.png).', 'err');
        blocks.push({ type: 'image', url: b.url.trim(), alt: b.alt.trim() });
      }
    }
    out.push({ slug, title, intro: p.intro.trim(), published: !!p.published, menu: !!p.menu, blocks });
  }
  const lines = out.map((p) => '• ' + p.title + ' — ' + (p.published ? 'publiée' : 'brouillon') + (p.menu ? ', dans le menu' : '')).join('\n');
  if (!confirm('Enregistrer ' + out.length + ' page' + (out.length > 1 ? 's' : '') + ' ?\n\n' + lines)) return;
  showStatus('Enregistrement...', 'pending');
  try {
    await customCol.save({ pages: out }, 'Mise à jour des pages personnalisées');
    savedSlugs = new Set(out.map((p) => p.slug));
    renderPagesEditor();
    showStatus('Pages enregistrées. Elles apparaissent sur le site dans la minute qui suit (le plan du site est mis à jour automatiquement).', 'ok');
  } catch (err) {
    showStatus('Échec : ' + err.message, 'err');
  }
}
document.getElementById('savePagesBtn').addEventListener('click', savePages);

/* ── Ajout de plusieurs clips d'un coup ── */
document.getElementById('bulkClipsBtn').addEventListener('click', async () => {
  const lines = document.getElementById('bulkClips').value.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return showStatus('Colle au moins une ligne « lien | titre ».', 'err');
  const known = new Set(clipsState.data.map((c) => c.slug));
  const added = [], skipped = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const line of lines) {
    const [rawLink, ...rest] = line.split('|');
    const link = rawLink.trim();
    const slug = extractClipSlug(link) || (/^[A-Za-z0-9_-]+$/.test(link) ? link : null);
    const title = rest.join('|').trim();
    if (!slug || !title) { skipped.push(line); continue; }
    if (known.has(slug)) { skipped.push(line + ' (déjà présent)'); continue; }
    known.add(slug);
    added.push({ slug, title, dateAdded: today });
  }
  if (!added.length) return showStatus('Rien à ajouter. Lignes ignorées : ' + skipped.join(' ; '), 'err');
  const next = [...added.reverse(), ...clipsState.data];
  showStatus('Enregistrement...', 'pending');
  try {
    const result = await writeJsonFile('data/clips.json', next, clipsState.sha, 'Ajout de ' + added.length + ' clips');
    clipsState = { data: next, sha: result.content.sha };
    renderClips();
    document.getElementById('bulkClips').value = '';
    showStatus(added.length + ' clip' + (added.length > 1 ? 's' : '') + ' ajouté' + (added.length > 1 ? 's' : '') + (skipped.length ? ' — ignoré : ' + skipped.join(' ; ') : '') + '.', 'ok');
  } catch (err) {
    showStatus('Échec : ' + err.message, 'err');
  }
});

/* ── Confort : modifications non enregistrées, Ctrl+S, jeton ── */
const SAVE_BUTTON_BY_TAB = { planning: ['savePlanningBtn', 'saveExceptionsBtn'], apropos: ['saveAproposBtn'], textes: ['saveTextesBtn'], pages: ['savePagesBtn'], site: ['saveSiteBtn'] };
const DIRTY_AREAS = [
  ['planningList', 'planning'], ['exceptionsEditor', 'planning-exceptions'], ['aproposEditor', 'apropos'],
  ['textesEditor', 'pages'], ['extraEditor', 'pages'], ['siteEditor', 'site'], ['pagesEditor', 'custom-pages'],
];
DIRTY_AREAS.forEach(([id, key]) => {
  const el = document.getElementById(id);
  el.addEventListener('input', () => markDirty(key));
  el.addEventListener('click', (e) => { if (e.target.closest('button')) markDirty(key); });
});
window.addEventListener('beforeunload', (e) => {
  if (dirty.size) { e.preventDefault(); e.returnValue = ''; }
});
document.addEventListener('keydown', (e) => {
  if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) return;
  e.preventDefault();
  const tab = document.querySelector('.admin-tabs [data-tab].active');
  const ids = tab && SAVE_BUTTON_BY_TAB[tab.dataset.tab];
  if (!ids) return showStatus('Rien à enregistrer avec Ctrl+S dans cet onglet (les streamers et clips s\'enregistrent depuis leur formulaire).', 'pending');
  // un onglet à deux sections (planning) : on enregistre celle qui a des changements
  const pick = tab.dataset.tab === 'planning' && dirty.has('planning-exceptions') && !dirty.has('planning') ? ids[1] : ids[0];
  document.getElementById(pick).click();
});
function showTokenNote() {
  const at = Number(localStorage.getItem(TOKEN_AT_KEY) || 0);
  const box = document.getElementById('tokenNote');
  if (!at) { localStorage.setItem(TOKEN_AT_KEY, String(Date.now())); return; }
  const days = Math.floor((Date.now() - at) / 86400000);
  if (days >= 60) {
    box.style.display = 'block';
    box.textContent = 'Ton jeton GitHub est enregistré dans ce navigateur depuis ' + days + ' jours. Par sécurité, pense à le renouveler (GitHub → Settings → Developer settings → Fine-grained tokens → Regenerate), puis déconnecte-toi et reconnecte-toi avec le nouveau.';
  } else {
    box.style.display = 'none';
  }
}

/* ── Sauvegarde ── */
function downloadBackup() {
  const backup = {
    exported_at: new Date().toISOString(),
    streamers: streamersState.data,
    clips: clipsState.data,
    planning: planningState.data,
    apropos: aproposState.data,
    planning_exceptions: exState.data,
    site: siteState.data,
    custom_pages: customCol.data,
    pages: { texts: pagesState.data.texts, extraProjects: pagesState.data.extraProjects },
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sauvegarde-aulit42369-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
document.getElementById('backupBtn').addEventListener('click', downloadBackup);

/* ── Onglets ── */
const TAB_NAMES = ['streamers', 'clips', 'planning', 'apropos', 'textes', 'pages', 'site', 'sante', 'historique'];
document.querySelectorAll('.admin-tabs [data-tab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-tabs [data-tab]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    TAB_NAMES.forEach((name) => {
      document.getElementById(name + 'Panel').style.display = btn.dataset.tab === name ? 'block' : 'none';
    });
    hideStatus();
    if (btn.dataset.tab === 'textes') loadTextes();
    if (btn.dataset.tab === 'sante') loadSante();
    if (btn.dataset.tab === 'historique') loadHistory();
  });
});

/* ── Formulaires : boutons ouvrir/annuler/enregistrer ── */
document.getElementById('addStreamerBtn').addEventListener('click', () => openStreamerForm(null));
document.getElementById('sfCancel').addEventListener('click', closeStreamerForm);
document.getElementById('sfSave').addEventListener('click', saveStreamer);

document.getElementById('addClipBtn').addEventListener('click', () => openClipForm(null));
document.getElementById('cfCancel').addEventListener('click', closeClipForm);
document.getElementById('cfSave').addEventListener('click', saveClip);

/* ── Connexion / déconnexion ── */
/* Charge (ou recharge) tous les contenus depuis GitHub. Renvoie la
   liste des erreurs éventuelles. */
async function loadAllContent() {
  const errors = [];
  try {
    streamersState = await readJsonFile('data/streamers.json');
    renderStreamers();
    checkBrokenLinks();
  } catch (e) {
    errors.push('Streamers : ' + e.message);
  }
  try {
    clipsState = await readJsonFile('data/clips.json');
    renderClips();
  } catch (e) {
    errors.push('Clips : ' + e.message);
  }
  try {
    planningState = await readJsonFile('data/planning.json');
    renderPlanning();
  } catch (e) {
    errors.push('Planning : ' + e.message);
  }
  try {
    const r = await readJsonFile('data/planning-exceptions.json');
    exState = { data: normalizeEx(r.data), sha: r.sha };
    renderExceptions();
  } catch (e) {
    errors.push('Changements ponctuels : ' + e.message);
  }
  try {
    const r = await readJsonFile('data/apropos.json');
    aproposState = { data: normalizeApropos(r.data), sha: r.sha };
    renderApropos();
  } catch (e) {
    errors.push('À propos : ' + e.message);
  }
  try {
    const r = await readJsonFile('data/site.json');
    siteState = { data: normalizeSite(r.data), sha: r.sha };
    renderSite();
  } catch (e) {
    errors.push('Liens & annonce : ' + e.message);
  }
  try {
    const r = await readJsonFile('data/pages.json');
    pagesState = { data: normalizePages(r.data), sha: r.sha };
    renderExtra();
    textesModel = null;
    if (document.getElementById('textesPanel').style.display !== 'none') loadTextes();
  } catch (e) {
    errors.push('Textes des pages : ' + e.message);
  }
  try {
    await customCol.load();
    savedSlugs = new Set(customCol.data.pages.map((p) => p.slug));
    renderPagesEditor();
  } catch (e) {
    errors.push('Pages : ' + e.message);
  }
  return errors;
}

async function init() {
  const token = getToken();
  if (!token) return;
  authGate.style.display = 'none';
  adminPanel.style.display = 'block';
  showStatus('Chargement...', 'pending');
  const errors = await loadAllContent();
  dirty.clear();
  showTokenNote();
  if (errors.length) showStatus(errors.join(' — '), 'err');
  else hideStatus();
}

document.getElementById('connectBtn').addEventListener('click', () => {
  const value = document.getElementById('tokenInput').value.trim();
  if (!value) return;
  setToken(value);
  init();
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  clearToken();
  adminPanel.style.display = 'none';
  authGate.style.display = 'block';
  document.getElementById('tokenInput').value = '';
});

init();
