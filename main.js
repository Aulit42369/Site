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

/* Bandeau "EN DIRECT" du header, sur toutes les pages : vérifie si
   la chaîne est actuellement live via decapi.me (Twitch n'expose pas
   cette info sans clé API, inutilisable en toute sécurité ici) et
   affiche le bandeau seulement si c'est le cas. Si le service ne
   répond pas, le bandeau reste simplement invisible. */
const liveBanner = document.getElementById('liveBanner');
if (liveBanner) {
  fetch('https://decapi.me/twitch/uptime/aulit42369?offline_msg=OFFLINE')
    .then(r => (r.ok ? r.text() : Promise.reject()))
    .then(text => {
      if (text.trim() !== 'OFFLINE') liveBanner.classList.add('is-live');
    })
    .catch(() => {});
}
