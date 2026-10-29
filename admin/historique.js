/* admin/historique.js — Onglet Historique et restauration. Chargé par admin.html avant admin.js (voir l'ordre là-bas). */
/* ── Historique et restauration ── */
const HIST_FILES = [
  ['streamers', 'Streamers'], ['clips', 'Clips'], ['planning', 'Planning (semaine type)'],
  ['planning-exceptions', 'Planning (changements ponctuels)'], ['apropos', 'À propos / FAQ'],
  ['pages', 'Textes des pages'], ['custom-pages', 'Pages personnalisées'], ['games', 'Jeux'], ['site', 'Liens & annonce'],
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
          <button type="button" data-hview="${escapeHtml(c.sha)}">Voir</button>
          ${i === 0 ? '' : `<button type="button" data-hrestore="${escapeHtml(c.sha)}" data-when="${escapeHtml(when)}">Restaurer</button>`}
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
