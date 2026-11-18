/* ================================================================
   La liste des clips vient de data/clips.json (gérée dans l'admin).
   18/11 (audit 45) : une carte = titre, vignette 16:9 et bouton lecture.
   Le lecteur Twitch / YouTube ne se charge qu'au clic, et seulement après
   accord (une seule explication en tête de liste, bouton « Accepter les
   lecteurs vidéo »). Shorts YouTube : même carte, le lecteur passe en 9:16.
   Miniature : copie sur le site (img/clips/, liste img/clips/miniatures.json,
   écrite par scripts/miniatures-clips.js pendant la construction du serveur) :
   aucune image tierce. Sans miniature copiée : vignette dessinée (jeu + teinte).
   ================================================================ */
const grid = document.getElementById('clipsGrid');
const empty = document.getElementById('emptyState');

function isRecentClip(dateStr) {
  if (!dateStr) return false;
  const diffDays = (Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / 86400000;
  return diffDays >= 0 && diffDays <= 7;
}

/* Données structurées « vidéo » pour Google (miniature copiée si elle existe, sinon l'image de partage de la page) */
function addClipsJsonLd(clips, minis) {
  const items = clips.filter(clip => clip.slug).map((clip, i) => {
    const slug = encodeURIComponent(clip.slug);
    const video = {
      '@type': 'VideoObject', name: clip.title, description: 'Clip Twitch de la chaîne AULIT42369 : ' + clip.title,
      thumbnailUrl: minis[clip.slug] ? 'https://aulit42369.fr/Site/img/clips/' + encodeURIComponent(minis[clip.slug]) : 'https://aulit42369.fr/Site/og/clips-og.jpg?v=13',
      embedUrl: `https://clips.twitch.tv/embed?clip=${slug}&parent=aulit42369.github.io&parent=aulit42369.fr`,
      url: `https://clips.twitch.tv/${slug}`, inLanguage: 'fr'
    };
    if (clip.dateAdded) video.uploadDate = clip.dateAdded;
    return { '@type': 'ListItem', position: i + 1, item: video };
  });
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'ItemList', name: 'Clips Twitch AULIT42369', itemListElement: items });
  document.head.appendChild(s);
}

/* Vignette dessinée (repli sans miniature) : teinte choisie par le nom du jeu, toujours la même pour un même jeu */
const TEINTES = ['vt-a', 'vt-b', 'vt-c', 'vt-d'];
function teinte(txt) { let h = 0; for (const c of String(txt)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return TEINTES[h % TEINTES.length]; }
function decouper(titre) { // « R.E.P.O.   -   Poules!!! » → « R.E.P.O. » (même règle que js/clips-recherche.js)
  const m = /^(.+?)\s+-\s+(.+)$/.exec(String(titre || '').trim());
  return m ? { jeu: m[1].trim() } : { jeu: '' };
}

const ok = () => typeof consentGet === 'function' && consentGet() === 'oui';
let enAttente = null; // carte dont on a demandé la lecture avant d'accepter

function lire(card) {
  const media = card.querySelector('.clip-media');
  media.classList.toggle('vertical', card.dataset.vertical === '1');
  media.innerHTML = `<iframe src="${card.dataset.lecteur}" title="${escapeHtml(card.dataset.nomLecteur)}" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
}

function demanderAccord(card) {
  const media = card.querySelector('.clip-media');
  if (media.querySelector('.clip-accord')) return;
  enAttente = card;
  media.insertAdjacentHTML('beforeend', `<div class="clip-accord" role="group" aria-label="Lecteur en pause">
    <p>Ce clip se lit dans le lecteur ${card.dataset.source}, qui dépose ses cookies.</p>
    <div><button type="button" class="btn btn-primary" data-consent="oui">Accepter et lire</button>
    <a class="lien-action" href="${escapeHtml(card.dataset.lien)}" target="_blank" rel="noopener">Regarder sur ${card.dataset.source} →</a></div></div>`);
  media.querySelector('.clip-accord .btn').focus();
}

/* l'explication des cookies, une seule fois en tête de liste, sous la recherche (js/clips-recherche.js, chargé après) ;
   posée dès DOMContentLoaded, sans attendre les données, pour ne pas faire sauter la page */
if (!ok()) document.addEventListener('DOMContentLoaded', () => {
  if (ok() || document.getElementById('clipsCookies') || empty.style.display === 'block') return;
  grid.insertAdjacentHTML('beforebegin', `<div class="clips-cookies" id="clipsCookies">
    <p><strong>Lecteurs vidéo en pause.</strong> Les clips se lisent dans les lecteurs de Twitch et de YouTube, qui déposent leurs propres cookies.
    Le site, lui, n’en dépose aucun. Sans accord, chaque clip reste regardable directement sur Twitch ou YouTube.</p>
    <button type="button" class="btn btn-secondary" data-consent="oui">Accepter les lecteurs vidéo</button></div>`);
});

Promise.all([loadJson('data/clips.json', []), loadJson('img/clips/miniatures.json', {})]).then(([clips, minis]) => {
  if (!Array.isArray(clips) || clips.length === 0) { empty.style.display = 'block'; const n = document.getElementById('clipsCookies'); if (n) n.remove(); return; }
  if (!minis || typeof minis !== 'object') minis = {};
  addClipsJsonLd(clips, minis);

  clips.forEach(clip => {
    const yt = clip.youtube && /^[\w-]{11}$/.test(clip.youtube) ? clip.youtube : '';
    if (!yt && !clip.slug) return;
    const slug = encodeURIComponent(clip.slug || '');
    const source = yt ? 'YouTube' : 'Twitch';
    const lien = yt ? `https://www.youtube.com/shorts/${yt}` : `https://clips.twitch.tv/${slug}`;
    const { jeu } = decouper(clip.title);
    const jeuCarte = (typeof clip.game === 'string' && clip.game.trim()) || jeu;
    const avantDeuxPoints = /^([^:]{3,28}) : /.exec(clip.title); // Shorts : « Killing Floor 3 : … » → « Killing Floor 3 »
    const mini = typeof minis[yt || clip.slug] === 'string' && /^[\w-]+\.jpg$/.test(minis[yt || clip.slug]) ? minis[yt || clip.slug] : '';
    const card = document.createElement('article');
    card.className = 'clip-card';
    if (typeof clip.game === 'string' && clip.game.trim()) card.dataset.jeu = clip.game.trim(); // pastilles (js/clips-recherche.js)
    Object.assign(card.dataset, {
      source, lien, vertical: yt ? '1' : '0',
      lecteur: yt ? `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1` : `https://clips.twitch.tv/embed?clip=${slug}&parent=aulit42369.github.io&parent=aulit42369.fr&autoplay=true`,
      nomLecteur: (yt ? 'Vidéo YouTube' : 'Clip Twitch') + ' : ' + clip.title
    });
    card.innerHTML = `
      <h2 class="clip-title">${escapeHtml(clip.title.replace(/\s+/g, ' '))}</h2>
      <div class="clip-media">
        <button type="button" class="clip-play ${teinte(jeuCarte || clip.title)}${mini ? ' a-mini' : ''}" aria-label="Lire : ${escapeHtml(clip.title)}">
          ${mini ? `<img class="clip-mini" src="img/clips/${encodeURIComponent(mini)}" alt="" width="480" height="270" loading="lazy" decoding="async">` : ''}
          <span class="vt-jeu" aria-hidden="true">${escapeHtml(jeuCarte || (avantDeuxPoints && avantDeuxPoints[1]) || (yt ? 'Short' : 'Clip'))}</span>
          <span class="vt-marque" aria-hidden="true">AULIT42369 · ${yt ? 'YouTube' : 'Twitch'}</span>
          <span class="vt-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg></span>
        </button>
      </div>
      <div class="clip-pied">
        <span class="etiquette">${yt ? 'Short YouTube' : 'Clip Twitch'}</span>
        ${isRecentClip(clip.dateAdded) ? '<span class="etiquette etiquette--accent">Nouveau</span>' : ''}
        <button type="button" class="lien-action share-btn" aria-label="Partager ce clip">Partager</button>
      </div>`;
    grid.appendChild(card);

    card.querySelector('.clip-play').addEventListener('click', () => (ok() ? lire(card) : demanderAccord(card)));
    const shareBtn = card.querySelector('.share-btn');
    shareBtn.addEventListener('click', () => {
      if (navigator.share) navigator.share({ title: clip.title, url: lien }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(lien).then(() => {
        const original = shareBtn.textContent;
        shareBtn.textContent = 'Lien copié !';
        setTimeout(() => { shareBtn.textContent = original; }, 1800);
      }).catch(() => {});
    });
  });
});

/* après « Accepter » (main.js enregistre le choix) : on retire l'explication et on lance le clip demandé */
document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-consent="oui"]')) return;
  setTimeout(() => {
    if (!ok()) return;
    const n = document.getElementById('clipsCookies'); if (n) n.remove();
    if (enAttente) { lire(enAttente); enAttente = null; }
  }, 0);
});
