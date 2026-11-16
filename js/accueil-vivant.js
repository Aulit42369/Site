/* Idée 27 (validée le 16/11/2026) · Accueil vivant : en live, le jeu, depuis quand et l'objectif de la soirée ;
   hors ligne, le dernier live et un compte à rebours jusqu'au prochain. Données lues dans data/ (rien n'est envoyé). */
(function (global) {
  const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const ISO = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  /* Prochain live dans les 28 jours : exception datée d'abord, sinon semaine type (même règle « une semaine sur 2 »
     que js/planning.js : semaines paires depuis la date de départ = altGame, les autres = game, vide = repos). */
  function prochainLive(planning, exceptions, now) {
    for (let i = 0; i < 28; i++) { // 28 j : une semaine sur 2 + un samedi annulé
      const jour = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 12);
      const iso = ISO(jour);
      const ex = (exceptions || []).find((e) => e && e.date === iso);
      let item = null;
      if (ex) {
        if (ex.on) item = { game: ex.game || 'Stream', time: ex.time || '' };
      } else {
        const base = (planning || []).find((p) => p.day === JOURS[jour.getDay()] && p.on);
        if (base) {
          let game = base.game;
          if (base.biweekly && /^\d{4}-\d{2}-\d{2}$/.test(base.anchor || '')) {
            const n = Math.round((jour - new Date(base.anchor + 'T12:00:00')) / 86400000);
            game = Math.floor(n / 7) % 2 === 0 ? base.altGame : base.game;
          }
          if (game) item = { game, time: base.time || '' };
        }
      }
      if (!item) continue;
      const [h, m] = (item.time || '00:00').split(':').map(Number);
      const debut = new Date(jour.getFullYear(), jour.getMonth(), jour.getDate(), h || 0, m || 0);
      if (item.time && debut <= now) continue; // créneau d'aujourd'hui déjà commencé
      return { debut, game: item.game, heureConnue: !!item.time };
    }
    return null;
  }

  // « 4 j 12 h 03 min », « 1 h 12 », « 8 min »
  function duree(ms, avecMinutesSeules) {
    const t = Math.max(0, Math.floor(ms / 60000));
    const j = Math.floor(t / 1440), h = Math.floor((t % 1440) / 60), m = t % 60;
    if (j) return j + ' j ' + h + ' h ' + String(m).padStart(2, '0') + ' min';
    if (h) return h + ' h ' + String(m).padStart(2, '0') + (avecMinutesSeules ? ' min' : '');
    return m + ' min';
  }

  if (typeof module !== 'undefined') module.exports = { prochainLive, duree };
  if (typeof document === 'undefined') return;

  const zone = document.getElementById('vivant');
  if (!zone) return;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const json = (p) => fetch(p, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  // Textes modifiables dans l'admin : <div id="vivantTextes"> d'index.html (déjà en HTML sûr, rendu par main.js)
  const T = (k) => { const el = document.querySelector('[data-edit="index.vivant.' + k + '"]'); return el ? el.innerHTML : ''; };
  const ABBR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  /* Lecteur « CAM 1 » : en live, le lecteur Twitch (soumis au consentement, main.js) ; hors ligne, la vidéo de
     présentation hébergée par le site, au lieu de l'écran « hors ligne » de Twitch. La vidéo n'est téléchargée
     que hors ligne ; mouvement réduit : elle ne démarre pas toute seule (contrôles affichés). */
  function camera(enDirect) {
    const video = document.getElementById('camVideo'), twitch = document.getElementById('camTwitch'), pill = document.getElementById('camPill');
    if (!video || !twitch) return;
    if (enDirect) { video.remove(); twitch.hidden = false; return; }
    twitch.remove(); // hors ligne : aucun lecteur Twitch, donc aucun cookie Twitch même après accord
    if (pill) pill.textContent = 'Présentation';
    video.src = 'video/presentation-chaine.mp4';
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { video.controls = true; return; }
    video.autoplay = true;
    video.play().catch(() => { video.controls = true; }); // lecture auto refusée par le navigateur : on laisse le bouton
  }

  Promise.all([json('data/twitch-status.json'), json('data/planning.json'), json('data/planning-exceptions.json'),
    json('data/recent-games.json'), json('data/clips.json'), global.pagesDataPromise]).then(([statut, planning, exceptions, recents, clips]) => {
    const chaine = statut && statut.aulit42369;
    const frais = statut && statut._updated_at && Date.now() - new Date(statut._updated_at) < 30 * 60000;
    const prochain = prochainLive(planning, exceptions, new Date());

    // Case « Prochain live » du tableau de score : main.js ignore la semaine sur 2 et les exceptions, on la corrige ici
    const caseProchain = document.getElementById('nextLive');
    if (caseProchain && prochain) {
      caseProchain.textContent = ABBR[prochain.debut.getDay()] + (prochain.heureConnue
        ? ' ' + prochain.debut.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '');
    }

    const enDirect = !!(chaine && chaine.live && frais);
    camera(enDirect);

    if (enDirect) {
      const depuis = chaine.startedAt ? duree(Date.now() - new Date(chaine.startedAt), true) : '';
      zone.innerHTML = `
        <div class="vv-live">
          <span class="vv-pastille"><span class="vv-point" aria-hidden="true"></span>${T('direct')}${depuis ? ' depuis ' + esc(depuis) : ''}</span>
          <div class="vv-live-corps">
            <p class="vv-k">${T('cesoir')}</p>
            <h2 class="vv-jeu">${esc(chaine.game || 'Stream')}</h2>
            ${chaine.title ? `<p class="vv-objectif"><span>${T('objectif')}</span>« ${esc(chaine.title)} »</p>` : ''}
          </div>
          <a class="sw-btn primary" href="https://www.twitch.tv/aulit42369" target="_blank" rel="noopener">${T('rejoindre')}</a>
        </div>`;
      return;
    }

    const dernier = Array.isArray(recents) && recents[0];
    const clipSoiree = dernier && Array.isArray(clips) && clips.find((c) => c.dateAdded === dernier.date);
    const quand = dernier ? new Date(dernier.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
    zone.innerHTML = `
      <div class="vv-grille">
        <article class="vv-carte">
          <p class="vv-k">${T('dernier')}</p>
          ${dernier ? `<div class="vv-dernier">
            ${dernier.art ? `<img src="${esc(dernier.art)}" alt="" width="72" height="96" loading="lazy">` : ''}
            <div><h2 class="vv-jeu">${esc(dernier.game)}</h2><p class="vv-quand">${esc(quand)}</p>
              ${clipSoiree ? `<p class="vv-clip">${T('clip')} <a href="clips.html">${esc(clipSoiree.title)}</a></p>` : ''}
              <a class="vv-lien" href="https://www.twitch.tv/aulit42369/videos" target="_blank" rel="noopener">${T('revoir')}</a></div>
          </div>` : `<p class="vv-quand">${T('aucun')}</p>`}
        </article>
        <article class="vv-carte vv-carte--prochain">
          <p class="vv-k">${T('prochain')}</p>
          ${prochain ? `<p class="vv-compte" id="vvCompte" aria-live="off">${esc(duree(prochain.debut - Date.now()))}</p>
            <p class="vv-quand">${esc(prochain.debut.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}${prochain.heureConnue ? ' · ' + esc(prochain.debut.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })) : ''} · <b>${esc(prochain.game)}</b></p>
            <a class="vv-lien" href="planning.html">${T('planning')}</a>`
            : `<p class="vv-quand">${T('annonce')}</p><a class="vv-lien" href="planning.html">${T('planning')}</a>`}
        </article>
      </div>`;
    const compte = document.getElementById('vvCompte');
    if (compte && prochain) setInterval(() => { compte.textContent = duree(prochain.debut - Date.now()); }, 30000);
  });
})(typeof window !== 'undefined' ? window : globalThis);
