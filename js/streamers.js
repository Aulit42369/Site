/* ================================================================
   La liste des streamers vient de data/streamers.json — gérée via
   la page d'administration (admin.html), plus besoin d'éditer ce
   fichier à la main. avatar/statut live viennent de
   data/twitch-status.json (voir main.js).
   ================================================================ */
const grid = document.getElementById('streamersGrid');
const empty = document.getElementById('emptyState');

function twitchUsername(url) {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).pop() || '';
  } catch {
    return '';
  }
}

/* Avatar affiché en 64 px : Twitch publie aussi chaque photo en 70x70 et 150x150 (vérifié le 17/11) ;
   on prend la plus petite suffisante (~3-34 Ko au lieu de ~100 Ko). URL d'une autre forme : gardée telle quelle. */
function smallTwitchAvatar(url) {
  return url.replace(/-profile_image-300x300\.(png|jpe?g)$/i, '-profile_image-' + (window.devicePixelRatio > 1.1 ? '150x150' : '70x70') + '.$1');
}

function applyAvatarPhoto(avatarEl, photoUrl, isRetry) {
  if (typeof photoUrl !== 'string' || !/^https?:\/\//i.test(photoUrl)) return;
  const small = isRetry ? photoUrl : smallTwitchAvatar(photoUrl);
  const img = new Image();
  if (small !== photoUrl) img.onerror = () => applyAvatarPhoto(avatarEl, photoUrl, true); // petite taille absente : photo d'origine
  img.onload = () => {
    photoUrl = small;
    avatarEl.style.backgroundImage = `url("${encodeURI(photoUrl).replace(/["')]/g, encodeURIComponent)}")`;
    avatarEl.style.backgroundSize = 'cover';
    avatarEl.style.backgroundPosition = 'center';
    avatarEl.textContent = '';
  };
  img.src = small;
}

function applyLiveState(badgeEl, isLive) {
  badgeEl.querySelector('.label').textContent = isLive ? 'En direct' : 'Hors ligne';
  badgeEl.classList.add(isLive ? 'is-live' : 'is-offline');
}

/* isStatusFresh() vient de main.js (chargé juste au-dessus, avant ce
   script) — inutile de la redéfinir ici, c'est la même fonction. */
function renderStreamers(streamers, statusData) {
  if (streamers.length === 0) {
    empty.style.display = 'block';
    return;
  }
  const fresh = isStatusFresh(statusData);
  streamers.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'card streamer-card';
    const initial = s.name.trim().charAt(0).toUpperCase();
    const avatarId = 'streamer-avatar-' + i;
    const liveId = 'streamer-live-' + i;
    card.innerHTML = `
      <div class="streamer-live-badge" id="${liveId}"><span class="dot"></span><span class="label"></span></div>
      <div class="streamer-avatar" id="${avatarId}">${escapeHtml(initial)}</div>
      <div class="streamer-name">${escapeHtml(s.name)}</div>
      <p class="streamer-desc">${escapeHtml(s.description)}</p>
      <a href="${escapeHtml(/^https?:\/\//i.test(s.url) ? s.url : '#')}" target="_blank" rel="noopener" class="btn btn-secondary">Voir la chaîne</a>
    `;
    grid.appendChild(card);

    const avatarEl = document.getElementById(avatarId);
    const username = twitchUsername(s.url).toLowerCase();
    const info = statusData[username];

    if (s.avatar) {
      applyAvatarPhoto(avatarEl, s.avatar);
    } else if (info && info.avatar) {
      applyAvatarPhoto(avatarEl, info.avatar);
    }

    if (info) {
      applyLiveState(document.getElementById(liveId), !!info.live && fresh);
    }
  });
}

Promise.all([
  loadJson('data/streamers.json', []),
  loadJson('data/twitch-status.json', {}),
]).then(([streamers, statusData]) => renderStreamers(streamers, statusData));
