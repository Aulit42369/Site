/* admin/jeux.js — Onglet Jeux. Chargé par admin.html avant admin.js (voir l'ordre là-bas). */
const DEFAULT_GAMES = [
  { "id": "lumen", "name": "LUMEN", "tagline": "Le puzzle des orbes lumineuses", "tags": "Puzzle, Solo", "description": "Fusionne des orbes identiques pour en créer de plus grosses et de plus lumineuses. Facile à prendre en main, difficile à lâcher : vise le meilleur score et garde de la place pour la suite.", "url": "", "playUrl": "", "status": "jouable", "accent": "gold" },
  { "id": "echo", "name": "ÉCHO", "tagline": "Un labyrinthe dans le noir", "tags": "Labyrinthe, Solo", "description": "Tu avances à l'aveugle dans un labyrinthe plongé dans l'obscurité. Écoute, repère les échos et trouve la sortie avant de te perdre pour de bon.", "url": "", "playUrl": "", "status": "jouable", "accent": "cyan" },
  { "id": "resonance", "name": "Résonance", "tagline": "Un jeu d'ondes", "tags": "Réflexion, Solo", "description": "Lance des ondes, regarde-les se propager et se croiser, et fais-les résonner au bon endroit au bon moment.", "url": "", "playUrl": "", "status": "jouable", "accent": "violet" },
  { "id": "fragments", "name": "Fragments", "tagline": "L'évasion à plusieurs téléphones", "tags": "Party game, Multijoueur", "description": "Chaque joueur reçoit sur son téléphone des indices différents. Personne ne voit tout : il faut parler, comparer et mettre les fragments en commun pour s'évader ensemble.", "url": "", "playUrl": "", "status": "jouable", "accent": "magenta" }
];
const GAME_ACCENTS = [['cyan', 'Cyan'], ['violet', 'Violet'], ['magenta', 'Rose'], ['gold', 'Or']];
function normalizeGames(d) {
  const src = d && typeof d === 'object' && Array.isArray(d.games) && d.games.length ? d.games : DEFAULT_GAMES;
  return {
    games: src.filter((g) => g && typeof g === 'object').map((g) => ({
      id: strOr(g.id), name: strOr(g.name), tagline: strOr(g.tagline), tags: strOr(g.tags), description: strOr(g.description),
      url: strOr(g.url), playUrl: strOr(g.playUrl), status: g.status === 'bientot' ? 'bientot' : 'jouable',
      accent: GAME_ACCENTS.some((a) => a[0] === g.accent) ? g.accent : 'cyan',
    })),
  };
}
const gamesCol = new Collection('games', normalizeGames);
function renderJeuxEditor() {
  const games = gamesCol.data.games;
  const open = new Set([...document.querySelectorAll('#jeuxEditor details[open]')].map((d) => d.dataset.gi));
  document.getElementById('jeuxEditor').innerHTML = games.map((g, gi) => `
    <details class="tx-group" data-gi="${gi}" ${open.has(String(gi)) ? 'open' : ''}>
      <summary>${escapeHtml(g.name || 'Nouveau jeu')}<span class="tx-count">${g.status === 'bientot' ? 'bientôt' : 'jouable'}${g.url.trim() ? ' · lien OK' : ' · pas de lien'}</span></summary>
      <div class="tx-body">
        <div class="ap-inline">
          <div class="field"><label>Nom</label><input type="text" data-gi="${gi}" data-gf="name" value="${escapeHtml(g.name)}"></div>
          <div class="field"><label>Accroche (sous le nom)</label><input type="text" data-gi="${gi}" data-gf="tagline" value="${escapeHtml(g.tagline)}"></div>
        </div>
        <div class="field"><label>Description</label><textarea rows="4" data-gi="${gi}" data-gf="description">${escapeHtml(g.description)}</textarea></div>
        <div class="field"><label>Étiquettes (séparées par des virgules)</label><input type="text" data-gi="${gi}" data-gf="tags" value="${escapeHtml(g.tags)}" placeholder="Puzzle, Solo"></div>
        <div class="field"><label>Adresse pour jouer (https://…)</label><input type="text" data-gi="${gi}" data-gf="url" value="${escapeHtml(g.url)}" placeholder="https://…"></div>
        <div class="field"><label>Lien Google Play (facultatif — ajoute un bouton)</label><input type="text" data-gi="${gi}" data-gf="playUrl" value="${escapeHtml(g.playUrl)}" placeholder="https://play.google.com/store/apps/details?id=…"></div>
        <div class="ap-inline">
          <div class="field"><label>Statut</label><select data-gi="${gi}" data-gf="status"><option value="jouable" ${g.status === 'jouable' ? 'selected' : ''}>Jouable</option><option value="bientot" ${g.status === 'bientot' ? 'selected' : ''}>Bientôt disponible</option></select></div>
          <div class="field"><label>Couleur</label><select data-gi="${gi}" data-gf="accent">${GAME_ACCENTS.map(([v, l]) => `<option value="${v}" ${g.accent === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        </div>
        <div class="form-actions" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
          <button type="button" class="btn btn-secondary" data-jact="up" data-gi="${gi}" ${gi === 0 ? 'disabled' : ''}>▲ Monter</button>
          <button type="button" class="btn btn-secondary" data-jact="down" data-gi="${gi}" ${gi === games.length - 1 ? 'disabled' : ''}>▼ Descendre</button>
          <button type="button" class="btn btn-secondary danger" data-jact="del" data-gi="${gi}">Supprimer ce jeu</button>
        </div>
      </div>
    </details>`).join('') || '<div class="ap-empty">Aucun jeu — la page affiche la liste d\'origine.</div>';
}
(function wireJeux() {
  const ed = document.getElementById('jeuxEditor');
  ed.addEventListener('input', (e) => {
    const el = e.target;
    const g = gamesCol.data.games[Number(el.dataset.gi)];
    if (!g || !el.dataset.gf) return;
    g[el.dataset.gf] = el.value;
    if (el.dataset.gf === 'name') el.closest('details').querySelector('summary').firstChild.textContent = el.value || 'Nouveau jeu';
  });
  ed.addEventListener('click', (e) => {
    const b = e.target.closest('[data-jact]');
    if (!b) return;
    const list = gamesCol.data.games, i = Number(b.dataset.gi), act = b.dataset.jact;
    if (act === 'del') { if (!confirm('Supprimer « ' + (list[i].name || 'ce jeu') + ' » ?')) return; list.splice(i, 1); }
    else if (act === 'up' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
    else if (act === 'down' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
    renderJeuxEditor();
    const d = ed.querySelector('details[data-gi="' + (act === 'up' ? i - 1 : act === 'down' ? i + 1 : Math.min(i, list.length - 1)) + '"]');
    if (d && act !== 'del') d.open = true;
  });
})();
document.getElementById('addJeuBtn').addEventListener('click', () => {
  gamesCol.data.games.push({ id: '', name: '', tagline: '', tags: '', description: '', url: '', playUrl: '', status: 'jouable', accent: 'cyan' });
  markDirty('games');
  renderJeuxEditor();
  const all = document.querySelectorAll('#jeuxEditor details');
  const last = all[all.length - 1];
  last.open = true;
  last.querySelector('input').focus();
});
async function saveJeux() {
  const out = [];
  const seen = new Set();
  const okHttps = (u) => /^https:\/\/[^\s]+$/i.test(u);
  for (const [i, g] of gamesCol.data.games.entries()) {
    const name = g.name.trim();
    if (!name) return showStatus('Jeu n° ' + (i + 1) + ' : le nom est obligatoire.', 'err');
    const url = g.url.trim(), playUrl = g.playUrl.trim();
    if (url && !okHttps(url)) return showStatus('« ' + name + ' » : l\'adresse pour jouer doit commencer par https://', 'err');
    if (playUrl && !okHttps(playUrl)) return showStatus('« ' + name + ' » : le lien Google Play doit commencer par https://', 'err');
    let id = g.id.trim() || name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'jeu';
    for (let n = 2; seen.has(id); n++) id = id.replace(/-\d+$/, '') + '-' + n;
    seen.add(id);
    out.push({ id, name, tagline: g.tagline.trim(), tags: g.tags.trim(), description: g.description.trim(), url, playUrl, status: g.status, accent: g.accent });
  }
  if (!out.length) return showStatus('Garde au moins un jeu (ou rétablis la liste d\'origine en supprimant le fichier data/games.json sur GitHub).', 'err');
  showStatus('Enregistrement...', 'pending');
  try {
    await gamesCol.save({ games: out }, 'Mise à jour des jeux');
    renderJeuxEditor();
    showStatus('Jeux enregistrés. La page « Jeux » est à jour dans la minute qui suit.', 'ok');
  } catch (err) {
    showStatus('Échec : ' + err.message, 'err');
  }
}
document.getElementById('saveJeuxBtn').addEventListener('click', saveJeux);
