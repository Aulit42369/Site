/* ================================================================
   AULIT42369 — script partagé
   Menu mobile, chargé sur toutes les pages du site.
   ================================================================ */
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
      if (liveBanner && chaine.live) liveBanner.classList.add('is-live');
      if (followerCount && typeof chaine.followers === 'number') {
        followerCount.textContent = chaine.followers.toLocaleString('fr-FR');
        if (followerStat) followerStat.style.display = '';
      }
    })
    .catch(() => {});
}
