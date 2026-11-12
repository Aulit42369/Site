/* ================================================================
   Page « Jeux » : la liste vient de data/games.json, modifiable dans
   l'admin (onglet « Jeux »). À défaut, la liste ci-dessous s'affiche.
   ATTENTION : DEFAULT_GAMES doit rester identique à celle de admin/jeux.js
   (vérifié par scripts/check-admin-parity.js).
   ================================================================ */
const DEFAULT_GAMES = [
  { "id": "lumen", "name": "LUMEN", "tagline": "Le puzzle des orbes lumineuses", "tags": "Puzzle, Solo", "description": "Fusionne des orbes identiques pour en créer de plus grosses et de plus lumineuses. Facile à prendre en main, difficile à lâcher : vise le meilleur score et garde de la place pour la suite.", "url": "", "playUrl": "", "status": "jouable", "accent": "gold" },
  { "id": "echo", "name": "ÉCHO", "tagline": "Un labyrinthe dans le noir", "tags": "Labyrinthe, Solo", "description": "Tu avances à l'aveugle dans un labyrinthe plongé dans l'obscurité. Écoute, repère les échos et trouve la sortie avant de te perdre pour de bon.", "url": "", "playUrl": "", "status": "jouable", "accent": "cyan" },
  { "id": "resonance", "name": "Résonance", "tagline": "Un jeu d'ondes", "tags": "Réflexion, Solo", "description": "Lance des ondes, regarde-les se propager et se croiser, et fais-les résonner au bon endroit au bon moment.", "url": "", "playUrl": "", "status": "jouable", "accent": "violet" },
  { "id": "fragments", "name": "Fragments", "tagline": "L'évasion à plusieurs téléphones", "tags": "Party game, Multijoueur", "description": "Chaque joueur reçoit sur son téléphone des indices différents. Personne ne voit tout : il faut parler, comparer et mettre les fragments en commun pour s'évader ensemble.", "url": "", "playUrl": "", "status": "jouable", "accent": "magenta" }
];

const jxOkUrl = (u) => typeof u === 'string' && /^https:\/\/[^\s]+$/i.test(u.trim());

// Défi du jour : même numéro que dans les 4 jeux (defi.js : #1 le 01/10/2026, date de Paris)
const JX_DEFI = ['echo', 'lumen', 'resonance', 'fragments'];
function jxDefiDuJour() {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date()).split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 9, 1)) / 864e5) + 1;
}

function jxCard(g) {
  const accent = ['violet', 'magenta', 'gold'].includes(g.accent) ? g.accent : 'cyan';
  const orbKind = ['echo', 'resonance', 'fragments'].includes(g.id) ? g.id : '';
  const tags = String(g.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
  const play = jxOkUrl(g.url);
  const store = jxOkUrl(g.playUrl);
  let actions = '';
  if (g.status === 'bientot') actions = '<span class="jx-soon">Bientôt disponible</span>';
  else if (play) actions = '<a class="btn btn-primary" href="' + escapeHtml(g.url.trim()) + '" target="_blank" rel="noopener">Jouer maintenant</a>';
  else actions = '<span class="jx-soon">Lien bientôt disponible</span>';
  if (store) actions += '<a class="btn btn-secondary" href="' + escapeHtml(g.playUrl.trim()) + '" target="_blank" rel="noopener">Google Play</a>';
  const n = jxDefiDuJour();
  const defi = play && g.status !== 'bientot' && JX_DEFI.includes(g.id) && n > 0
    ? '<a class="jx-defi" href="' + escapeHtml(g.url.trim()) + '" target="_blank" rel="noopener"><span aria-hidden="true">🎯</span> Défi du jour #' + n + ' <span class="jx-defi-note">le même pour tout le monde, nouveau chaque jour</span></a>' : '';
  const chips = tags.map((t) => '<span class="jx-chip">' + escapeHtml(t) + '</span>').join('') +
    '<span class="jx-chip pwa">Jouable en ligne · installable</span>' +
    (store ? '<span class="jx-chip pwa">Sur Google Play</span>' : '<span class="jx-chip">Google Play : bientôt</span>');
  return '<article class="card jx-card ' + accent + '"><div class="jx-top"><div class="jx-orb ' + orbKind + '" aria-hidden="true"></div><div><h2 class="jx-name">' + escapeHtml(g.name) + '</h2>' +
    (g.tagline ? '<p class="jx-tag">' + escapeHtml(g.tagline) + '</p>' : '') + '</div></div>' +
    '<p class="jx-desc">' + renderRichText(String(g.description || '')) + '</p>' +
    defi + '<div class="jx-chips">' + chips + '</div><div class="jx-actions">' + actions + '</div></article>';
}

loadJson('data/games.json', null).then((d) => {
  const list = d && Array.isArray(d.games) && d.games.length ? d.games.filter((g) => g && typeof g.name === 'string' && g.name.trim()) : DEFAULT_GAMES;
  document.getElementById('jxGrid').innerHTML = (list.length ? list : DEFAULT_GAMES).map(jxCard).join('');
});
