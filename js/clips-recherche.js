/* Idée 28 (validée le 16/11/2026) · Clips : recherche par titre, pastilles par jeu, clip au hasard. Tout se passe dans le
   navigateur, sur les cartes que js/clips.js a déjà construites (le consentement des lecteurs reste le sien). */
(function () {
  // shortcut: le jeu est déduit du titre (« R.E.P.O.   -   Poules!!! ») ; clips.json n'a pas de champ jeu. À remplacer
  // par un champ « jeu » saisi dans l'admin le jour où on publie.
  function jeuDuTitre(titre) {
    const m = /^(.+?)\s+-\s+/.exec(String(titre || ''));
    return m ? m[1].trim() : '';
  }
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function correspond(titre, recherche, jeu) {
    return (!jeu || jeuDuTitre(titre) === jeu) && norm(titre).includes(norm(recherche).trim());
  }

  if (typeof module !== 'undefined') module.exports = { jeuDuTitre, correspond };
  if (typeof document === 'undefined') return;

  const grid = document.getElementById('clipsGrid');
  if (!grid) return;
  const barre = document.createElement('div');
  barre.className = 'cr-barre';
  barre.setAttribute('role', 'search');
  barre.innerHTML = `
    <label class="cr-champ"><span class="sr-only">Chercher un clip</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>
      <input type="search" name="recherche-clip" placeholder="Chercher un clip (titre, jeu…)" autocomplete="off"></label>
    <div class="cr-jeux" role="group" aria-label="Filtrer par jeu"></div>
    <button type="button" class="cr-hasard">Clip au hasard</button>
    <p class="cr-compte" aria-live="polite"></p>
    <p class="cr-vide" hidden>Aucun clip ne correspond. <button type="button" class="cr-effacer">Tout afficher</button></p>`;
  grid.before(barre);
  const champ = barre.querySelector('input');
  const jeux = barre.querySelector('.cr-jeux');
  const compte = barre.querySelector('.cr-compte');
  const vide = barre.querySelector('.cr-vide');
  let jeu = '';

  const cartes = () => [...grid.querySelectorAll('.clip-card')];
  const titre = (c) => (c.querySelector('.clip-title')?.firstChild?.textContent || '').trim();

  function appliquer() {
    let n = 0;
    cartes().forEach((c) => { const ok = correspond(titre(c), champ.value, jeu); c.hidden = !ok; if (ok) n++; });
    const total = cartes().length;
    compte.textContent = n === total ? total + ' clips' : n + ' clip' + (n > 1 ? 's' : '') + ' sur ' + total;
    vide.hidden = n !== 0;
  }
  function pastilles() {
    const liste = [...new Set(cartes().map((c) => jeuDuTitre(titre(c))).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    jeux.innerHTML = ['', ...liste].map((j) => `<button type="button" aria-pressed="${j === jeu}" data-jeu="${j.replace(/"/g, '&quot;')}">${j ? j.replace(/</g, '&lt;') : 'Tous'}</button>`).join('');
  }
  jeux.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    jeu = b.dataset.jeu;
    jeux.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    appliquer();
  });
  champ.addEventListener('input', appliquer);
  barre.querySelector('.cr-effacer').addEventListener('click', () => { champ.value = ''; jeu = ''; pastilles(); appliquer(); champ.focus(); });
  barre.querySelector('.cr-hasard').addEventListener('click', () => {
    const visibles = cartes().filter((c) => !c.hidden);
    if (!visibles.length) return;
    const c = visibles[Math.floor(Math.random() * visibles.length)];
    const doux = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    c.scrollIntoView({ behavior: doux ? 'smooth' : 'auto', block: 'center' });
    cartes().forEach((x) => x.classList.remove('cr-choisi'));
    c.classList.add('cr-choisi');
    const cible = c.querySelector('button, a, [tabindex]');
    if (cible) cible.focus({ preventScroll: true });
  });

  // js/clips.js remplit la grille après le chargement de clips.json : on se met à jour quand les cartes arrivent.
  new MutationObserver(() => { pastilles(); appliquer(); }).observe(grid, { childList: true });
  if (cartes().length) { pastilles(); appliquer(); } // cartes déjà là si clips.json est arrivé avant ce script
})();
