/* ================================================================
   admin.js — point d'entrée de l'administration : confort (Ctrl+S,
   modifications non enregistrées), sauvegarde, onglets, connexion et
   démarrage. Le reste est découpé par onglet dans admin/*.js, chargés
   AVANT ce fichier par admin.html (scripts classiques : les fonctions
   et constantes de haut niveau sont partagées entre fichiers).
   ================================================================ */

/* ── Confort : modifications non enregistrées, Ctrl+S, jeton ── */
const SAVE_BUTTON_BY_TAB = { planning: ['savePlanningBtn', 'saveExceptionsBtn'], apropos: ['saveAproposBtn'], textes: ['saveTextesBtn'], pages: ['savePagesBtn'], jeux: ['saveJeuxBtn'], site: ['saveSiteBtn'] };
const DIRTY_AREAS = [
  ['planningList', 'planning'], ['exceptionsEditor', 'planning-exceptions'], ['aproposEditor', 'apropos'],
  ['textesEditor', 'pages'], ['extraEditor', 'pages'], ['siteEditor', 'site'], ['pagesEditor', 'custom-pages'], ['jeuxEditor', 'games'],
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
    games: gamesCol.data,
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
const TAB_NAMES = ['streamers', 'clips', 'planning', 'apropos', 'textes', 'pages', 'jeux', 'site', 'sante', 'historique'];
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
  try {
    await gamesCol.load();
    renderJeuxEditor();
  } catch (e) {
    errors.push('Jeux : ' + e.message);
  }
  return errors;
}

async function init() {
  expireRememberedToken();
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
  setToken(value, document.getElementById('rememberToken').checked);
  init();
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  clearToken();
  adminPanel.style.display = 'none';
  authGate.style.display = 'block';
  document.getElementById('tokenInput').value = '';
});

init();
