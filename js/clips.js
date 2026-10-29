/* ================================================================
   La liste des clips vient de data/clips.json — gérée via la page
   d'administration (admin.html), plus besoin d'éditer ce fichier
   à la main.
   ================================================================ */
const grid = document.getElementById('clipsGrid');
const empty = document.getElementById('emptyState');

/* Badge "Nouveau" pour les clips ajoutés il y a 7 jours ou moins.
   clip.dateAdded (AAAA-MM-JJ) est écrit par admin.html au moment de
   l'ajout ; absent sur les clips ajoutés avant cette fonctionnalité,
   qui n'affichent donc simplement pas le badge. */
function isRecentClip(dateStr) {
  if (!dateStr) return false;
  const added = new Date(dateStr + 'T00:00:00');
  const diffDays = (Date.now() - added.getTime()) / 86400000;
  return diffDays >= 0 && diffDays <= 7;
}

/* Données structurées « vidéo » pour Google (résultats Vidéos). shortcut: miniature = image de partage de la page,
   car data/clips.json n'a pas la miniature Twitch ; à remplacer par la vraie si l'admin l'enregistre un jour. */
function addClipsJsonLd(clips) {
  const items = clips.map((clip, i) => {
    const slug = encodeURIComponent(clip.slug);
    const video = {
      '@type': 'VideoObject',
      name: clip.title,
      description: 'Clip Twitch de la chaîne AULIT42369 : ' + clip.title,
      thumbnailUrl: 'https://aulit42369.github.io/Site/og/clips-og.png',
      embedUrl: `https://clips.twitch.tv/embed?clip=${slug}&parent=aulit42369.github.io`,
      url: `https://clips.twitch.tv/${slug}`,
      inLanguage: 'fr'
    };
    if (clip.dateAdded) video.uploadDate = clip.dateAdded;
    return { '@type': 'ListItem', position: i + 1, item: video };
  });
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'ItemList', name: 'Clips Twitch AULIT42369', itemListElement: items });
  document.head.appendChild(s);
}

loadJson('data/clips.json', [])
  .then(clips => {
    if (clips.length === 0) {
      empty.style.display = 'block';
      return;
    }
    addClipsJsonLd(clips);
    clips.forEach(clip => {
      const slug = encodeURIComponent(clip.slug);
      const clipUrl = `https://clips.twitch.tv/${slug}`;
      const badge = isRecentClip(clip.dateAdded) ? ' <span class="badge-new">Nouveau</span>' : '';
      const card = document.createElement('div');
      card.className = 'broadcast-frame clip-card';
      card.innerHTML = `
        <iframe data-consent-src="https://clips.twitch.tv/embed?clip=${slug}&parent=aulit42369.github.io" data-consent-link="${clipUrl}" title="Clip Twitch : ${escapeHtml(clip.title)}" allowfullscreen loading="lazy"></iframe>
        <div class="clip-footer">
          <div class="clip-title">${escapeHtml(clip.title)}${badge}</div>
          <button type="button" class="share-btn" aria-label="Partager ce clip">Partager</button>
        </div>
        <div class="clip-slug" tabindex="0" role="button" aria-label="Copier le slug du clip">${escapeHtml(clip.slug)}</div>
      `;
      grid.appendChild(card);
      applyConsent(card); // lecteur Twitch chargé seulement après accord (main.js)

      /* Bouton "Partager" : ne transmet que le titre et le lien du
         clip, jamais le slug — voir juste en dessous pour ça. */
      const shareBtn = card.querySelector('.share-btn');
      shareBtn.addEventListener('click', () => {
        if (navigator.share) {
          navigator.share({ title: clip.title, url: clipUrl }).catch(() => {});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(clipUrl).then(() => {
            const original = shareBtn.textContent;
            shareBtn.textContent = 'Lien copié !';
            setTimeout(() => { shareBtn.textContent = original; }, 1800);
          }).catch(() => {});
        }
      });

      /* Slug affiché sous la vidéo pour mon propre usage (le
         retrouver sans repasser par l'admin) — clic pour copier,
         complètement à part du bouton "Partager" ci-dessus. */
      const slugEl = card.querySelector('.clip-slug');
      const copySlug = () => {
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(clip.slug).then(() => {
          const original = slugEl.textContent;
          slugEl.textContent = 'Copié !';
          setTimeout(() => { slugEl.textContent = original; }, 1200);
        }).catch(() => {});
      };
      slugEl.addEventListener('click', copySlug);
      slugEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copySlug(); }
      });
    });
  });
