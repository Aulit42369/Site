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
