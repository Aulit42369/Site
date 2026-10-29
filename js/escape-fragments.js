/* ================================================================
   Classement lu en direct sur le serveur du jeu (GET /api/classement),
   dont l'adresse se règle dans l'admin (onglet « Liens & annonce »).
   Le serveur est hébergé sur une offre gratuite qui se met en veille :
   le premier chargement peut prendre jusqu'à une minute, on le dit.
   ================================================================ */
const EF_DEFAULT_SERVER = 'https://escape-fragments.onrender.com';
const efBox = document.getElementById('efBox');
const efMsg = document.getElementById('efMsg');
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function efStatus(text) {
  efBox.className = 'ef-status';
  efBox.textContent = text;
}

function efRender(top) {
  const list = (Array.isArray(top) ? top : []).filter((p) => p && (p.display || p.login));
  if (list.length === 0) {
    efStatus("Aucun agent classé pour l'instant — la première partie reste à jouer !");
    return;
  }
  const name = (p) => String(p.display || p.login);
  const icon = (p) => (typeof p.icone === 'string' ? p.icone : '');
  const grade = (p) => (typeof p.grade === 'string' ? p.grade : p.grade && typeof p.grade.nom === 'string' ? p.grade.nom : '');
  const pod = list.slice(0, 3).map((p, i) =>
    '<div class="ef-pod p' + (i + 1) + '"><div class="rank">' + (i + 1) + '</div><div class="icon">' + escapeHtml(icon(p)) + '</div><b>' + escapeHtml(name(p)) + '</b><span>' + num(p.points) + ' pts · ' + num(p.victoires) + ' victoires</span></div>');
  // le podium s'affiche dans l'ordre 2 – 1 – 3
  const order = [pod[1], pod[0], pod[2]].filter(Boolean).join('');
  const rows = list.map((p, i) =>
    '<tr><td>' + (i + 1) + '</td><td>' + escapeHtml(icon(p)) + ' ' + escapeHtml(name(p)) + (grade(p) ? ' <span style="color:var(--dim);font-size:0.85rem;">' + escapeHtml(grade(p)) + '</span>' : '') + '</td><td class="num">' + num(p.points) + '</td><td class="num hide-s">' + num(p.victoires) + '</td><td class="num hide-s">' + num(p.mvp) + '</td></tr>').join('');
  efBox.className = '';
  efBox.innerHTML = '<div class="ef-podium">' + order + '</div>' +
    '<table class="ef-table"><thead><tr><th>#</th><th>Agent</th><th class="num">Points</th><th class="num hide-s">Victoires</th><th class="num hide-s">MVP</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

async function efFetch(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 70000);
  try {
    const r = await fetch(url + '/api/classement?t=' + Date.now(), { signal: ctrl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

loadJson('data/site.json', null).then(async (cfg) => {
  // adresse réglée dans l'admin (Liens & annonce) ; à défaut, le serveur officiel du jeu
  const url = (cfg && typeof cfg.escapeServerUrl === 'string' && /^https:\/\//i.test(cfg.escapeServerUrl) ? cfg.escapeServerUrl : EF_DEFAULT_SERVER).replace(/\/+$/, '');
  document.getElementById('efPlayLink').href = url + '/jouer';
  document.getElementById('efPlay').style.display = '';
  document.getElementById('efFullLink').href = url + '/classement';
  document.getElementById('efFull').style.display = '';
  const wake = setTimeout(() => { efMsg.textContent = 'Réveil du serveur du jeu… ça peut prendre jusqu\'à une minute.'; }, 4000);
  try {
    const data = await efFetch(url);
    efRender(data && data.top);
  } catch (e) {
    try {
      efRender((await efFetch(url)).top);
    } catch (e2) {
      efStatus('Classement indisponible pour le moment — réessaie dans un instant.');
    }
  } finally {
    clearTimeout(wake);
  }
  efStamp();
  // le classement se remet à jour tout seul tant que la page est ouverte ; en cas d'erreur on garde l'affichage actuel
  setInterval(async () => {
    if (document.hidden) return;
    try {
      efRender((await efFetch(url)).top);
      efStamp();
    } catch (e) { /* on garde l'ancien affichage */ }
  }, 60000);
});

function efStamp() {
  if (!efBox.querySelector('.ef-table')) return;
  const d = new Date();
  document.getElementById('efStamp').textContent = 'Actualisé à ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' · mise à jour automatique chaque minute';
}
