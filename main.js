/* ================================================================
   AULIT42369 — script partagé
   Menu mobile, chargé sur toutes les pages du site.
   ================================================================ */

/* Lien d'accès rapide au contenu : invisible tant qu'il n'a pas le
   focus, visible dès qu'on y arrive au clavier (touche Tab). Permet
   de sauter directement au contenu de la page sans repasser par tout
   le menu à chaque fois — utile au clavier et aux lecteurs d'écran.
   Ajouté en JS (comme le reste de ce fichier) plutôt que dans chaque
   page HTML. */
const mainEl = document.querySelector('main');
if (mainEl) {
  if (!mainEl.id) mainEl.id = 'main-content';
  mainEl.setAttribute('tabindex', '-1');

  const skipLink = document.createElement('a');
  skipLink.className = 'skip-link';
  skipLink.href = '#' + mainEl.id;
  skipLink.textContent = 'Aller au contenu';
  document.body.insertBefore(skipLink, document.body.firstChild);
}

const navToggle = document.getElementById('navToggle');
const nav = document.getElementById('nav');
navToggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  document.body.classList.toggle('nav-open', open);
  navToggle.setAttribute('aria-expanded', open);
});

/* Bandeau "EN DIRECT" du header (sur toutes les pages) + nombre
   d'abonnés Twitch (affiché seulement là où l'élément #followerCount
   existe, ex. l'accueil) : les deux lisent data/twitch-status.json,
   généré côté serveur par une GitHub Action toutes les 10 min depuis
   l'API Twitch officielle (decapi.me n'est plus utilisé). Si le
   fichier n'existe pas encore ou ne répond pas, ces éléments restent
   simplement invisibles. */
const liveBanner = document.getElementById('liveBanner');
const followerStat = document.getElementById('followerStat');
const followerCount = document.getElementById('followerCount');
if (liveBanner || followerCount) {
  fetch('data/twitch-status.json')
    .then(r => (r.ok ? r.json() : Promise.reject()))
    .then(data => {
      const chaine = data.aulit42369;
      if (!chaine) return;
      if (liveBanner && chaine.live) {
        liveBanner.classList.add('is-live');
        if (chaine.game) {
          const label = liveBanner.querySelector('.label');
          if (label) label.textContent = 'En direct — ' + chaine.game;
        }
        if (chaine.gameArt) {
          const art = document.createElement('img');
          art.className = 'live-banner-art';
          art.alt = '';
          art.src = chaine.gameArt;
          const dot = liveBanner.querySelector('.dot');
          liveBanner.insertBefore(art, dot.nextSibling);
        }
      }
      if (followerCount && typeof chaine.followers === 'number') {
        followerCount.textContent = chaine.followers.toLocaleString('fr-FR');
        if (followerStat) followerStat.style.display = '';
      }
    })
    .catch(() => {});
}

/* Bouton "retour en haut", sur toutes les pages. Le survol et
   l'apparition sont des transitions CSS (déjà neutralisées en
   mouvement réduit par style.css) ; le défilement fluide déclenché
   ici est du JS, donc on vérifie nous-mêmes la préférence avant de
   l'utiliser. */
const backToTop = document.createElement('button');
backToTop.id = 'backToTop';
backToTop.type = 'button';
backToTop.setAttribute('aria-label', 'Retourner en haut de la page');
backToTop.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>';
document.body.appendChild(backToTop);

window.addEventListener('scroll', () => {
  backToTop.classList.toggle('show', window.scrollY > 500);
}, { passive: true });

backToTop.addEventListener('click', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
});
