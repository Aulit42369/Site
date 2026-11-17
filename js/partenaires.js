/* Kit média : le bloc « Audience moyenne » reste masqué tant qu'aucun chiffre n'est saisi
   dans l'admin (« Textes des pages » > Partenaires, clés partenaires.s1 à s4).
   « À venir », « - » ou vide = pas de chiffre. */
window.pagesDataPromise.then(() => {
  const bloc = document.getElementById('kitAudience');
  if (!bloc) return;
  const renseigne = [...bloc.querySelectorAll('.kit-stat .n')]
    .some((el) => !/^(à venir|-|—|)$/i.test(el.textContent.trim()));
  bloc.hidden = !renseigne;
});
