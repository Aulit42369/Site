/* js/passeport.js — Passeport du viewer (18/11/2026). Parle au service /Site/passeport-api/ (même origine, cookie HttpOnly).
   Connexion Twitch par flux implicite SANS permission : le jeton revient dans l'ancre (#access_token), est envoyé une fois
   au service (qui lit le pseudo puis le révoque) et retiré de l'adresse aussitôt. Seul stockage local : sessionStorage
   « pp_etat » (contrôle anti-falsification de la connexion, effacé au retour de Twitch). */
(function () {
  'use strict';
  const API = '/Site/passeport-api/';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const date = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (t) => new Date(t).toLocaleDateString('fr-FR');
  const COUL = { cyan: '#2ee6e0', violet: '#a24bff', or: '#ffc94a', magenta: '#ff3d9a' };
  const MOTIFS = {
    etoile: '<path d="M27 17l3.5 7.5 8 1-6 5.5 1.7 8L27 35l-7.2 4 1.7-8-6-5.5 8-1z" fill="§"/>',
    flamme: '<path d="M27 15c5 6 9 9 9 15a9 9 0 0 1-18 0c0-4 2-6 4-8 0 3 1 5 3 5-1-4 0-8 2-12z" fill="§"/>',
    carte: '<rect x="19" y="17" width="16" height="22" rx="2.5" fill="none" stroke="§" stroke-width="2.5"/><path d="M23 23h8M23 28h8M23 33h5" stroke="§" stroke-width="2"/>',
    bille: '<circle cx="27" cy="29" r="9" fill="none" stroke="§" stroke-width="2.5"/><circle cx="24" cy="26" r="2.5" fill="§"/>',
    eclair: '<path d="M30 15l-10 15h7l-3 11 10-15h-7z" fill="§"/>',
    fleche: '<path d="M17 37l15-15M24 21h9v9" fill="none" stroke="§" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    lune: '<path d="M32 18a11 11 0 1 0 5 17 9 9 0 0 1-5-17z" fill="§"/>',
    couronne: '<path d="M17 36l2-14 6 6 2-9 2 9 6-6 2 14z" fill="§"/>',
    coeur: '<path d="M27 38s-10-6-10-12a5.5 5.5 0 0 1 10-3 5.5 5.5 0 0 1 10 3c0 6-10 12-10 12z" fill="§"/>',
  };
  const svgBadge = (b) => {
    const c = COUL[b.couleur] || COUL.cyan;
    const m = b.motif === 'nombre'
      ? `<text x="27" y="36" text-anchor="middle" font-family="Saira Condensed, sans-serif" font-weight="800" font-size="${String(b.seuil).length > 2 ? 13 : 17}" fill="${c}">${esc(String(b.seuil).slice(0, 4))}</text>`
      : (MOTIFS[b.motif] || MOTIFS.etoile).replaceAll('§', c);
    return `<svg viewBox="0 0 54 60" aria-hidden="true"><path d="M27 3l22 12.5v29L27 57 5 44.5v-29z" fill="#191431" stroke="${c}" stroke-width="2"/>${m}</svg>`;
  };

  async function appel(route, corps) {
    const r = await fetch(API + route, corps
      ? { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Passeport': '1' }, body: JSON.stringify(corps) }
      : { credentials: 'same-origin', cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(d.erreur || 'Service du passeport injoignable pour le moment.'), { statut: r.status });
    return d;
  }
  const erreur = (m) => { const e = $('ppErreur'); e.textContent = m || ''; e.hidden = !m; };
  const montrer = (quoi) => { for (const id of ['ppAccueil', 'ppAccord', 'ppPasseport']) $(id).hidden = id !== quoi; };

  function chiffres(p) {
    const pct = p.lives.depuisArrivee ? Math.round((100 * p.lives.suivis) / p.lives.depuisArrivee) : 0;
    const cartes = p.cartes
      ? `<b>${p.cartes.possedees}<small> / ${p.cartes.total}</small></b><span>cartes</span>${p.cartes.collections.length ? `<em>${esc(p.cartes.collections.map((c) => `${c.nom} : ${c.possedees} / ${c.total}`).slice(0, 2).join(' · '))}</em>` : ''}<div class="pp-jauge"><i style="width:${p.cartes.total ? Math.round((100 * p.cartes.possedees) / p.cartes.total) : 0}%"></i></div>`
      : '<b>–</b><span>cartes</span><em>ouvre un paquet sur la chaîne</em>';
    return `<div class="pp-chiffre"><b>${p.lives.suivis}</b><span>lives suivis</span><em>${p.lives.depuisArrivee ? `sur ${p.lives.depuisArrivee} depuis ton arrivée` : 'ton premier arrive au prochain live'}</em><div class="pp-jauge"><i style="width:${pct}%"></i></div></div>`
      + `<div class="pp-chiffre"><b>${p.serie.actuelle}</b><span>lives d’affilée</span><em>record : ${p.serie.record}</em></div>`
      + `<div class="pp-chiffre">${cartes}</div>`
      + `<div class="pp-chiffre"><b>${p.lives.saison}</b><span>lives cette saison</span><em>quiz : bientôt relié</em></div>`;
  }

  function afficher(p, prive) {
    $('ppAvatar').src = p.avatar || 'favicon.svg';
    $('ppNom').textContent = p.nom;
    $('ppDepuis').textContent = p.premierLive ? `Premier live suivi : ${date(p.premierLive)}` : 'Pas encore de live suivi';
    $('ppRang').textContent = p.rang;
    $('ppChiffres').innerHTML = chiffres(p);
    $('ppBadgesNote').textContent = `${p.obtenus} obtenu${p.obtenus > 1 ? 's' : ''} sur ${p.badges.length} · les grisés disent comment les avoir`;
    $('ppBadges').innerHTML = p.badges.map((b) => `<div class="pp-badge${b.obtenu ? '' : ' ferme'}">${svgBadge(b)}<b>${esc(b.nom)}</b><span>${b.obtenu ? (b.le ? `obtenu le ${dateCourte(b.le)}` : 'obtenu') : (b.bientot ? 'arrive bientôt' : esc(b.texte))}</span></div>`).join('');
    $('ppSouvenirs').innerHTML = p.souvenirs.length
      ? p.souvenirs.map((s) => `<li><time datetime="${new Date(s.le).toISOString()}">${dateCourte(s.le)}</time>${esc(s.texte)}</li>`).join('')
      : '<li class="pp-vide">Tes souvenirs apparaîtront après ton premier live suivi.</li>';
    $('ppVie').hidden = !prive;
    montrer('ppPasseport');
  }

  function reglages(r, effaceLe) {
    document.querySelectorAll('[data-reglage]').forEach((c) => { c.checked = !!r[c.dataset.reglage]; });
    $('ppLien').hidden = !r.lien;
    if (r.lien) { const u = `${location.origin}${location.pathname}?p=${r.lien}`; $('ppLienA').href = u; $('ppLienA').textContent = u; }
    $('ppRetire').hidden = !(r.classement && r.retire);
    if (effaceLe) $('ppGarde').textContent = `Sans visite de ta part, tout sera effacé le ${date(effaceLe)}.`;
  }

  async function chargerMoi() {
    try {
      const d = await appel('moi');
      afficher(d.passeport, true); reglages(d.reglages, d.effaceLe);
    } catch (e) {
      if (e.statut === 401) montrer('ppAccueil'); else { montrer('ppAccueil'); erreur(e.message); }
    }
  }

  async function seConnecter() {
    erreur('');
    try {
      const { clientId } = await appel('config');
      const etat = Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');
      sessionStorage.setItem('pp_etat', etat);
      location.href = 'https://id.twitch.tv/oauth2/authorize?response_type=token&force_verify=false&scope='
        + `&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(location.origin + location.pathname)}&state=${etat}`;
    } catch (e) { erreur(location.hostname === 'aulit42369.fr' ? e.message : 'Le passeport ne marche que sur https://aulit42369.fr/Site/passeport.html.'); }
  }

  let attente = null;
  async function retourTwitch(h) {
    history.replaceState(null, '', location.pathname + location.search); // le jeton quitte l'adresse tout de suite
    let etat = null; try { etat = sessionStorage.getItem('pp_etat'); sessionStorage.removeItem('pp_etat'); } catch { /* stockage bloqué */ }
    if (h.get('error')) { montrer('ppAccueil'); erreur('Connexion annulée sur Twitch : rien n’a été gardé.'); return; }
    if (!etat || h.get('state') !== etat) { montrer('ppAccueil'); erreur('La connexion n’a pas pu être vérifiée. Réessaie.'); return; }
    try {
      const d = await appel('connexion', { jeton: h.get('access_token') });
      if (d.etat === 'consentement') {
        attente = d.attente;
        $('ppAccordNom').textContent = d.profil.nom;
        $('ppAccordAvatar').src = d.profil.avatar || 'favicon.svg';
        montrer('ppAccord');
        $('ppAccepter').focus();
      } else await chargerMoi();
    } catch (e) { montrer('ppAccueil'); erreur(e.message); }
  }

  async function chargerClassement() {
    const ol = $('ppClassement');
    try {
      const c = await appel('classement');
      $('ppClassTitre').textContent = `Classement de la saison ${c.saison.numero}`;
      const lignes = c.liste.map((e) => `<li><span class="pos">${e.pos}</span><span>${esc(e.nom)}</span><span class="pts">${e.lives} live${e.lives > 1 ? 's' : ''} · ${e.badges} badge${e.badges > 1 ? 's' : ''}</span></li>`);
      if (c.discrets) lignes.push(`<li><span class="masque">${lignes.length ? 'et ' : ''}${c.discrets} viewer${c.discrets > 1 ? 's' : ''} qui préfère${c.discrets > 1 ? 'nt' : ''} rester discret${c.discrets > 1 ? 's' : ''}</span></li>`);
      ol.innerHTML = lignes.join('') || '<li class="pp-vide">Personne dans le classement pour l’instant : il se remplit avec ceux qui cochent « Apparaître dans le classement ».</li>';
    } catch { ol.innerHTML = '<li class="pp-vide">Classement indisponible pour le moment.</li>'; }
  }

  // ---- branchements ----
  $('ppConnexion').addEventListener('click', seConnecter);
  $('ppRefuser').addEventListener('click', () => { attente = null; montrer('ppAccueil'); erreur('Pas de souci : rien n’a été gardé.'); });
  $('ppAccepter').addEventListener('click', async () => {
    try { await appel('accepter', { attente, compter: $('ppAccordCompter').checked }); attente = null; erreur(''); await chargerMoi(); } catch (e) { montrer('ppAccueil'); erreur(e.message); }
  });
  document.querySelectorAll('[data-reglage]').forEach((c) => c.addEventListener('change', async () => {
    try { const d = await appel('reglages', { [c.dataset.reglage]: c.checked }); reglages(d.reglages); chargerClassement(); } catch (e) { c.checked = !c.checked; erreur(e.message); }
  }));
  $('ppCopier').addEventListener('click', () => { navigator.clipboard?.writeText($('ppLienA').href).then(() => { $('ppCopier').textContent = 'Copié'; }); });
  $('ppEffacer').addEventListener('click', async () => {
    if (!confirm('Tout effacer ? Ton passeport, tes lives comptés et tes badges seront supprimés définitivement.')) return;
    try { await appel('effacer', {}); montrer('ppAccueil'); erreur('C’est effacé. Il ne reste plus rien à ton nom.'); chargerClassement(); } catch (e) { erreur(e.message); }
  });
  $('ppDeconnexion').addEventListener('click', async () => { try { await appel('deconnexion', {}); } catch { /* */ } montrer('ppAccueil'); });

  const h = new URLSearchParams(location.hash.slice(1));
  const lien = new URLSearchParams(location.search).get('p');
  if (h.has('access_token') || h.has('error')) retourTwitch(h);
  else if (lien) {
    appel('public/' + encodeURIComponent(lien)).then((d) => { $('ppIntro').textContent = `Le passeport de ${d.passeport.nom}, partagé par son propriétaire.`; afficher(d.passeport, false); })
      .catch((e) => { montrer('ppAccueil'); erreur(e.message); });
  } else chargerMoi();
  chargerClassement();
})();
