/* admin/sante.js — Onglet Santé du site. Chargé par admin.html avant admin.js (voir l'ordre là-bas). */
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
        rows.push({ level, title: 'Automatisation : ' + n, detail: 'Dernière exécution ' + escapeHtml(state) + ', ' + agoText(Date.now() - new Date(r.updated_at).getTime()) + (level === 'err' ? ' — <a href="' + escapeHtml(r.html_url) + '" target="_blank" rel="noopener">voir le détail sur GitHub</a>' : '') + '.' });
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
