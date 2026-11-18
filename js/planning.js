/* ================================================================
   Le planning vient de data/planning.json + data/planning-exceptions.json
   (gérés dans l'admin). 18/11 (audit 44) : en tête, le bloc « Prochain live »
   (jour, date, heure, jeu, compte à rebours, bouton Twitch), puis la semaine
   en bande compacte : jours de repos petits, jour de live mis en avant.
   Le calcul du prochain live est celui de l'accueil (window.prochainLive,
   js/accueil-vivant.js, chargé avant ce fichier).
   ================================================================ */
const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const ABR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const grid = document.getElementById('planningGrid');
const bloc = document.getElementById('planProchain');
const empty = document.getElementById('emptyState');

function dateLocale(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const maintenant = new Date();
const todayStr = dateLocale(maintenant);
const limiteStr = dateLocale(new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + 6));

Promise.all([
  loadJson('data/planning.json', []),
  loadJson('data/planning-exceptions.json', []).catch(() => [])
]).then(([planning, list]) => {
  const exceptions = Array.isArray(list) ? list : [];
  if (!Array.isArray(planning) || planning.length === 0) { empty.style.display = 'block'; bloc.remove(); return; }

  /* changements ponctuels des 7 prochains jours : le premier de chaque jour remplace la case (sans heure) */
  const parJour = {};
  exceptions.filter(e => e && typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.date >= todayStr && e.date <= limiteStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(e => { const j = JOURS[new Date(e.date + 'T12:00:00').getDay()]; if (!parJour[j]) parJour[j] = e; });

  /* « Une semaine sur 2 » : jeu de la prochaine occurrence du jour (même règle que l'admin et l'accueil) */
  function jeuDeLaSemaine(base, jour) {
    if (!base.biweekly || !/^\d{4}-\d{2}-\d{2}$/.test(base.anchor || '')) return base;
    const n = Math.round((jour - new Date(base.anchor + 'T12:00:00')) / 86400000);
    const jeu = Math.floor(n / 7) % 2 === 0 ? base.altGame : base.game;
    return jeu ? Object.assign({}, base, { game: jeu, note: 'Une semaine sur 2' }) : Object.assign({}, base, { on: false });
  }
  const horaire = (it) => it.time ? (it.end ? heureFr(it.time) + ' – ' + heureFr(it.end) : 'À partir de ' + heureFr(it.time)) : '';

  /* les 7 jours à partir d'aujourd'hui */
  const semaine = [];
  for (let i = 0; i < 7; i++) {
    const jour = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + i, 12);
    const nom = JOURS[jour.getDay()];
    const base = planning.find(p => p.day === nom) || { day: nom, on: false };
    const ex = parJour[nom];
    const item = !ex ? jeuDeLaSemaine(base, jour) : ex.on
      ? Object.assign({}, base, { on: true, game: ex.game || 'Stream', time: '', end: '', note: '' })
      : Object.assign({}, base, { on: false });
    semaine.push({ jour, item, i });
  }

  /* --- bloc « Prochain live » --- */
  const prochain = typeof window.prochainLive === 'function' ? window.prochainLive(planning, exceptions, maintenant) : null;
  if (!prochain) {
    bloc.innerHTML = '<p class="pl-k">Prochain live</p><p class="pl-vide">Pas de live prévu cette semaine : il sera annoncé sur le <a class="lien-action" href="https://discord.com/invite/Amgaz5YNVg" target="_blank" rel="noopener">Discord →</a></p>';
  } else {
    const memeJour = semaine.find(s => dateLocale(s.jour) === dateLocale(prochain.debut));
    const it = memeJour && memeJour.item.on ? memeJour.item : { time: '' };
    const h = horaire(it) || (prochain.heureConnue ? 'À partir de ' + heureFr(prochain.debut.getHours() + ':' + String(prochain.debut.getMinutes()).padStart(2, '0')) : 'Horaire sur le Discord');
    const d = prochain.debut;
    const ferie = typeof window.ferieDe === 'function' ? window.ferieDe(d) : ''; // js/jours-feries.js (calculé, aucun service tiers)
    bloc.innerHTML = `
      <div class="pl-date" aria-hidden="true"><span>${ABR[d.getDay()]}</span><b>${d.getDate()}</b><span>${escapeHtml(d.toLocaleDateString('fr-FR', { month: 'short' }))}</span></div>
      <div class="pl-corps">
        <p class="pl-k">Prochain live<span class="sr-only"> : ${escapeHtml(d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}</span></p>
        <h2 class="pl-jeu">${escapeHtml(nomDeJeu(prochain.game))}</h2>
        <p class="pl-heure">${escapeHtml(h)} · heure de Paris${it.note ? ` <span class="etiquette">${escapeHtml(it.note)}</span>` : ''}${ferie ? ` <span class="etiquette etiquette--accent">Jour férié · ${escapeHtml(ferie)}</span>` : ''}</p>
      </div>
      <div class="pl-action">
        <p class="pl-compte"><span>Dans</span> <b id="plCompte">${escapeHtml(window.dureeLive(d - Date.now()))}</b></p>
        <a class="btn btn-primary" href="https://www.twitch.tv/aulit42369" target="_blank" rel="noopener">Suivre sur Twitch</a>
      </div>`;
    const compte = document.getElementById('plCompte');
    setInterval(() => { compte.textContent = window.dureeLive(d - Date.now()); }, 30000);
  }

  /* --- la semaine en bande compacte --- */
  grid.textContent = '';
  semaine.forEach(({ jour, item, i }) => {
    const li = document.createElement('li');
    li.className = 'pl-jour' + (item.on ? ' on' : '') + (i === 0 ? ' auj' : '');
    const date = `<span class="pl-j-nom">${ABR[jour.getDay()]}<span class="sr-only">${JOURS[jour.getDay()].slice(3)}</span></span><span class="pl-j-num">${jour.getDate()}</span>`;
    li.innerHTML = item.on
      ? `${date}<span class="pl-j-info"><b>${escapeHtml(nomDeJeu(item.game))}</b>${horaire(item) ? `<span>${escapeHtml(horaire(item))}</span>` : ''}</span>`
      : `${date}<span class="pl-j-info pl-repos">Repos</span>`;
    const ferie = typeof window.ferieDe === 'function' ? window.ferieDe(jour) : '';
    if (ferie) li.querySelector('.pl-j-info').insertAdjacentHTML('beforeend', `<span class="etiquette etiquette--accent" style="justify-self:start" title="${escapeHtml(ferie)}">Férié<span class="sr-only"> : ${escapeHtml(ferie)}</span></span>`);
    if (i === 0) li.insertAdjacentHTML('beforeend', '<span class="pl-auj">Aujourd’hui</span>');
    grid.appendChild(li);
  });
});
