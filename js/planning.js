/* ================================================================
   Le planning vient de data/planning.json — géré via la page
   d'administration (admin.html), plus besoin d'un site séparé ni
   d'éditer de code pour le mettre à jour.
   ================================================================ */
const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const aujourdhui = JOURS[new Date().getDay()];

const grid = document.getElementById('planningGrid');
const empty = document.getElementById('emptyState');

/* Changements ponctuels (stream en plus, jour de repos exceptionnel…) :
   data/planning-exceptions.json, géré depuis l'admin (onglet Planning) ou posé
   par l'Agence Aulit. Un changement des 7 prochains jours remplace la case de son
   jour dans la grille (case active + jeu annoncé, SANS heure : pas d'ambiguïté). */
function dateLocale(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const maintenant = new Date();
const todayStr = dateLocale(maintenant);
const dans6j = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + 6);
const limiteStr = dateLocale(dans6j);

Promise.all([
  loadJson('data/planning.json', []),
  loadJson('data/planning-exceptions.json', []).catch(() => [])
]).then(([planning, list]) => {
  const upcoming = (Array.isArray(list) ? list : [])
    .filter(e => e && typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  /* première exception de chaque jour de la semaine, dans les 7 prochains jours */
  const parJour = {};
  upcoming.filter(e => e.date <= limiteStr).forEach(e => {
    const jour = JOURS[new Date(e.date + 'T12:00:00').getDay()];
    if (!parJour[jour]) parJour[jour] = e;
  });

  if (planning.length === 0) {
    empty.style.display = 'block';
  }
  /* « Une semaine sur 2 » : la carte ne montre QUE le jeu de la prochaine occurrence du jour
     (semaines paires depuis la date de départ = jeu de l'encadré « une semaine sur 2 » ; les autres = jeu du dessus,
     ou repos s'il est vide). Un jeu n'apparaît donc jamais la semaine de l'autre. */
  function jeuDeLaSemaine(base) {
    if (!base.biweekly || !/^\d{4}-\d{2}-\d{2}$/.test(base.anchor || '')) return base;
    const idx = JOURS.indexOf(base.day);
    const prochain = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + ((idx - maintenant.getDay() + 7) % 7), 12);
    const jours = Math.round((prochain - new Date(base.anchor + 'T12:00:00')) / 86400000);
    // même règle que l'aperçu de l'admin (admin/planning.js, apercuAlternance) : la date de départ est une semaine du jeu
    // « une semaine sur 2 » (altGame, demande d'Olivier du 28/10) ; les autres semaines = jeu du dessus ; vide = repos
    const jeu = Math.floor(jours / 7) % 2 === 0 ? base.altGame : base.game;
    return jeu ? Object.assign({}, base, { game: jeu, note: 'Une semaine sur 2' }) : Object.assign({}, base, { on: false });
  }

  /* 30/10 (Olivier : « je n'ai pas de semaine type, n'affiche rien ») : plus de badge « Changement » ;
     la date du jour (sa prochaine occurrence, dans les 7 jours) sous son nom, dans la couleur de la case s'il est actif. */
  function dateDuJour(day) {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + ((JOURS.indexOf(day) - maintenant.getDay() + 7) % 7));
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }

  planning.map(jeuDeLaSemaine).forEach(base => {
    const ex = parJour[base.day];
    const item = !ex ? base : ex.on
      ? Object.assign({}, base, { on: true, game: ex.game || 'Stream', time: '', note: '' })
      : Object.assign({}, base, { on: false });
    const isToday = item.day === aujourdhui;
    const card = document.createElement('div');
    card.className = 'card planning-card' + (item.on ? '' : ' off');
    card.style.setProperty('--accent', item.color);
    const date = `<div class="planning-date">${escapeHtml(dateDuJour(item.day))}</div>`;

    if (item.on) {
      card.innerHTML = `
        <div class="planning-card-head">
          <div><div class="planning-day">${escapeHtml(item.day)}</div>${date}</div>
          ${isToday ? '<span class="planning-today-badge">Aujourd\'hui</span>' : ''}
        </div>
        <div class="planning-game">${escapeHtml(item.game)}</div>
        ${item.time ? `<div class="planning-time">${item.end ? escapeHtml(item.time) + ' – ' + escapeHtml(item.end) : 'À partir de ' + escapeHtml(item.time.replace(':', 'h'))} · Heure FR</div>` : ''}
        ${item.note ? `<div class="planning-alt-note">${escapeHtml(item.note)}</div>` : ''}
      `;
    } else {
      card.innerHTML = `
        <div class="planning-card-head">
          <div><div class="planning-day">${escapeHtml(item.day)}</div>${date}</div>
        </div>
        <div class="planning-off-label">— Repos —</div>
      `;
    }
    grid.appendChild(card);
  });
});
