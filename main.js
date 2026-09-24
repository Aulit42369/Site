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

/* Bandeau "EN DIRECT" du header, sur toutes les pages : lit
   data/twitch-status.json (généré côté serveur par une GitHub
   Action toutes les 10 min depuis l'API Twitch officielle — decapi.me
   n'est plus utilisé) et affiche le bandeau si la chaîne y est
   marquée live. Si le fichier n'existe pas encore ou ne répond pas,
   le bandeau reste simplement invisible. */
const liveBanner = document.getElementById('liveBanner');
if (liveBanner) {
  fetch('data/twitch-status.json')
    .then(r => (r.ok ? r.json() : Promise.reject()))
    .then(data => {
      if (data.aulit42369 && data.aulit42369.live) liveBanner.classList.add('is-live');
    })
    .catch(() => {});
}
