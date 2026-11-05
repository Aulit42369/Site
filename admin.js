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
  // l'admin ne marche que sur le serveur (API /Site/admin-api/) : la copie GitHub Pages y renvoie
  if (location.hostname.endsWith('github.io')) { location.replace('https://aulit42369.fr/Site/admin.html'); return; }
  // anciens jetons GitHub laissés dans ce navigateur : effacés (05/11/2026, connexion par mot de passe)
  ['aulit_admin_token', 'aulit_admin_token_at', 'aulit_admin_token_remember'].forEach((k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
  if (!(await sessionActive())) return;
  authGate.style.display = 'none';
  adminPanel.style.display = 'block';
  showStatus('Chargement...', 'pending');
  const errors = await loadAllContent();
  dirty.clear();
  if (errors.length) showStatus(errors.join(' — '), 'err');
  else hideStatus();
}

async function seConnecter() {
  const champ = document.getElementById('passwordInput');
  const erreur = document.getElementById('loginError');
  if (!champ.value) return;
  erreur.textContent = '';
  try {
    const res = await apiAdmin('connexion', { method: 'POST', body: JSON.stringify({ motDePasse: champ.value }) });
    if (!res.ok) { erreur.textContent = (await res.json().catch(() => ({}))).erreur || 'Connexion refusée (' + res.status + ').'; return; }
    champ.value = '';
    init();
  } catch (e) {
    erreur.textContent = 'Serveur injoignable : ' + e.message;
  }
}
document.getElementById('connectBtn').addEventListener('click', seConnecter);
document.getElementById('passwordInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') seConnecter(); });

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await apiAdmin('deconnexion', { method: 'POST' }).catch(() => {});
  adminPanel.style.display = 'none';
  authGate.style.display = 'block';
});

init();
