/* Idée 42 (validée le 18/11/2026) · Jours fériés de France métropolitaine, calculés ici (Pâques par l'algorithme de Meeus/Jones/Butcher) :
   aucun appel à un service tiers, rien à mettre à jour d'une année à l'autre.
   window.ferieDe(date) -> « Noël », « Lundi de Pâques »… ou '' ; window.feriesDu(date, jours) -> [{ date, nom }] sur les N prochains jours. */
(function (global) {
  const ISO = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  function paques(a) {
    const c = Math.floor(a / 100), n = a % 19, k = Math.floor((c - 17) / 25);
    let i = c - Math.floor(c / 4) - Math.floor((c - k) / 3) + 19 * n + 15;
    i -= 30 * Math.floor(i / 30);
    i -= Math.floor(i / 28) * (1 - Math.floor(i / 28) * Math.floor(29 / (i + 1)) * Math.floor((21 - n) / 11));
    let j = a + Math.floor(a / 4) + i + 2 - c + Math.floor(c / 4);
    j -= 7 * Math.floor(j / 7);
    const l = i - j, mois = 3 + Math.floor((l + 40) / 44), jour = l + 28 - 31 * Math.floor(mois / 4);
    return new Date(a, mois - 1, jour, 12);
  }

  const memo = {};
  function feries(annee) {
    if (memo[annee]) return memo[annee];
    const p = paques(annee), apres = (n) => ISO(new Date(annee, p.getMonth(), p.getDate() + n, 12));
    const t = {};
    t[annee + '-01-01'] = 'Jour de l’An'; t[apres(1)] = 'Lundi de Pâques'; t[annee + '-05-01'] = 'Fête du Travail';
    t[annee + '-05-08'] = 'Victoire 1945'; t[apres(39)] = 'Ascension'; t[apres(50)] = 'Lundi de Pentecôte';
    t[annee + '-07-14'] = 'Fête nationale'; t[annee + '-08-15'] = 'Assomption'; t[annee + '-11-01'] = 'Toussaint';
    t[annee + '-11-11'] = 'Armistice 1918'; t[annee + '-12-25'] = 'Noël';
    return (memo[annee] = t);
  }

  const ferieDe = (date) => feries(date.getFullYear())[ISO(date)] || '';

  function feriesDu(depuis, jours) {
    const sortie = [];
    for (let i = 0; i <= jours; i++) {
      const d = new Date(depuis.getFullYear(), depuis.getMonth(), depuis.getDate() + i, 12);
      const nom = ferieDe(d);
      if (nom) sortie.push({ date: ISO(d), nom, dans: i });
    }
    return sortie;
  }

  if (typeof module !== 'undefined') module.exports = { ferieDe, feriesDu, feries };
  global.ferieDe = ferieDe; global.feriesDu = feriesDu;
})(typeof window !== 'undefined' ? window : globalThis);
