/* ================================================================
   AULIT42369 — script partagé
   Menu mobile, chargé sur toutes les pages du site.
   ================================================================ */

/* Échappe le texte injecté dans du HTML (via innerHTML) sur les pages
   qui affichent du contenu saisi dans admin.html (streamers, clips,
   planning) : un pseudo ou un titre contenant "<" ou "&" ne doit pas
   être interprété comme du HTML. Utilisée par ces pages — voir leur
   script en bas de fichier, chargé après celui-ci. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* Si le Discord a été changé dans l'admin (onglet « Liens & annonce »),
   toute invitation Discord du site pointe vers la nouvelle adresse —
   voir applySiteConfig() plus bas. */
function siteDiscordUrl(u) {
  if (window.__siteDiscord && /^https:\/\/(discord\.com\/invite|discord\.gg)\//i.test(u)) return window.__siteDiscord;
  return u;
}

/* Texte riche minimal pour les contenus saisis dans admin.html
   (À propos, textes des pages) : échappe tout le HTML d'abord, puis
   n'autorise que [texte](lien) (http(s):// ou une page du site en
   .html), *mot* (mot en couleur d'accent), `code` et les retours à la
   ligne. Rien d'autre ne peut devenir une balise. */
function renderRichText(str) {
  let out = escapeHtml(str);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, label, url) => {
    const u = siteDiscordUrl(url.replace(/&amp;/g, '&'));
    if (/^https?:\/\//i.test(u)) {
      return '<a href="' + escapeHtml(u) + '" target="_blank" rel="noopener">' + label + '</a>';
    }
    if (/^[a-z0-9_-]+\.html(#[\w-]*)?$/i.test(u)) {
      return '<a href="' + escapeHtml(u) + '">' + label + '</a>';
    }
    return all;
  });
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*([^*\n]+)\*/g, '<em class="accent">$1</em>');
  return out.replace(/\n/g, '<br>');
}

/* Lien d'accès rapide au contenu : invisible tant qu'il n'a pas le
   focus, visible dès qu'on y arrive au clavier (touche Tab). Permet
   de sauter directement au contenu de la page sans repasser par tout
   le menu à chaque fois — utile au clavier et aux lecteurs d'écran.
   Ajouté en JS (comme le reste de ce fichier) plutôt que dans chaque
   page HTML. */
const mainEl = document.querySelector('main');
if (mainEl) {
  if (!mainEl.id) mainEl.id = 'main-content';
  mainEl.setAttribute('tabindex', '-1');

  const skipLink = document.createElement('a');
  skipLink.className = 'skip-link';
  skipLink.href = '#' + mainEl.id;
  skipLink.textContent = 'Aller au contenu';
  document.body.insertBefore(skipLink, document.body.firstChild);
}

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

/* Le planning GitHub Actions ("toutes les 10 min") n'est qu'indicatif
   — GitHub peut largement espacer les exécutions automatiques sans
   prévenir. Si la donnée est trop vieille, on ne fait plus confiance
   à "live" : mieux vaut ne pas afficher "en direct" que d'afficher un
   direct terminé depuis des heures. Les autres infos (abonnés, etc.)
   ne posent pas ce problème et restent affichées même si anciennes. */
function isStatusFresh(data) {
  const STALE_AFTER_MS = 30 * 60 * 1000; // 30 min
  const updatedAt = data._updated_at ? new Date(data._updated_at).getTime() : NaN;
  return !Number.isNaN(updatedAt) && (Date.now() - updatedAt) < STALE_AFTER_MS;
}

const liveBanner = document.getElementById('liveBanner');
const followerStat = document.getElementById('followerStat');
const followerCount = document.getElementById('followerCount');
if (liveBanner || followerCount) {
  fetch('data/twitch-status.json')
    .then(r => (r.ok ? r.json() : Promise.reject()))
    .then(data => {
      const chaine = data.aulit42369;
      if (!chaine) return;
      if (liveBanner && chaine.live && isStatusFresh(data)) {
        liveBanner.classList.add('is-live');
        if (chaine.game) {
          const label = liveBanner.querySelector('.label');
          if (label) label.textContent = 'En direct — ' + chaine.game;
        }
        if (chaine.gameArt) {
          const art = document.createElement('img');
          art.className = 'live-banner-art';
          art.alt = '';
          art.src = chaine.gameArt;
          const dot = liveBanner.querySelector('.dot');
          liveBanner.insertBefore(art, dot.nextSibling);
        }
      }
      if (followerCount && typeof chaine.followers === 'number') {
        followerCount.textContent = chaine.followers.toLocaleString('fr-FR');
        if (followerStat) followerStat.style.display = '';
      }
    })
    .catch(() => {});
}

/* ================================================================
   Réglages du site gérés depuis l'admin (onglet « Liens & annonce »)
   data/site.json : { socials: [{label, url}], announcement: {...} }
   Absent ou invalide → le HTML d'origine reste tel quel.
   ================================================================ */
const isHttpUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);

function applySocials(socials) {
  if (!Array.isArray(socials)) return;
  const list = socials.filter((s) => s && typeof s.label === 'string' && s.label.trim() && isHttpUrl(s.url));
  if (list.length === 0) return;
  const discord = list.find((s) => /^discord$/i.test(s.label.trim()));
  if (discord) window.__siteDiscord = discord.url;
  document.querySelectorAll('.site-footer .socials').forEach((box) => {
    box.innerHTML = list.map((s) =>
      '<a href="' + escapeHtml(s.url) + '" target="_blank" rel="noopener">' + escapeHtml(s.label) + '</a>').join('');
  });
  if (discord) {
    document.querySelectorAll('a[href^="https://discord.com/invite/"], a[href^="https://discord.gg/"]').forEach((a) => {
      a.setAttribute('href', discord.url);
    });
  }
}

/* Date AAAA-MM-JJ de l'admin → fin de journée / début de journée locale */
function announcementActive(a) {
  if (!a || !a.enabled || typeof a.text !== 'string' || !a.text.trim()) return false;
  const now = Date.now();
  if (a.from && /^\d{4}-\d{2}-\d{2}$/.test(a.from) && now < new Date(a.from + 'T00:00:00').getTime()) return false;
  if (a.until && /^\d{4}-\d{2}-\d{2}$/.test(a.until) && now > new Date(a.until + 'T23:59:59').getTime()) return false;
  return true;
}

function applyAnnouncement(a) {
  if (!announcementActive(a)) return;
  const key = 'announce-closed';
  try { if (sessionStorage.getItem(key) === a.text) return; } catch (e) {}
  const bar = document.createElement('div');
  bar.className = 'announce' + (a.tone === 'alerte' ? ' announce-alerte' : '');
  bar.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.className = 'announce-text';
  text.textContent = a.text;
  bar.appendChild(text);
  if (isHttpUrl(a.linkUrl) || (typeof a.linkUrl === 'string' && /^[a-z0-9_-]+\.html$/i.test(a.linkUrl))) {
    const link = document.createElement('a');
    link.className = 'announce-link';
    link.href = a.linkUrl;
    link.textContent = (typeof a.linkLabel === 'string' && a.linkLabel.trim()) || 'En savoir plus';
    if (isHttpUrl(a.linkUrl)) { link.target = '_blank'; link.rel = 'noopener'; }
    bar.appendChild(link);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'announce-close';
  close.setAttribute('aria-label', "Fermer l'annonce");
  close.textContent = '×';
  close.addEventListener('click', () => {
    bar.remove();
    try { sessionStorage.setItem(key, a.text); } catch (e) {}
  });
  bar.appendChild(close);
  const header = document.querySelector('.site-header');
  if (header) header.parentNode.insertBefore(bar, header);
  else document.body.insertBefore(bar, document.body.firstChild);
}

fetch('data/site.json')
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null)
  .then((cfg) => {
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return;
    applySocials(cfg.socials);
    applyAnnouncement(cfg.announcement);
  });

/* Textes des pages modifiables depuis l'admin (onglet « Textes des
   pages ») : data/pages.json { texts: { clé: "texte" }, extraProjects: [...] }.
   Les éléments concernés portent data-edit="clé" ; leur contenu HTML
   sert de texte par défaut et n'est remplacé que si la clé existe. */
window.pagesDataPromise = document.querySelector('[data-edit], [data-uses-pages]')
  ? fetch('data/pages.json').then((r) => (r.ok ? r.json() : null)).catch(() => null)
  : Promise.resolve(null);
window.pagesDataPromise.then((d) => {
  if (!d || typeof d !== 'object' || !d.texts || typeof d.texts !== 'object') return;
  document.querySelectorAll('[data-edit]').forEach((el) => {
    const v = d.texts[el.dataset.edit];
    if (typeof v === 'string' && v.trim()) el.innerHTML = renderRichText(v);
  });
});

/* Bouton "retour en haut", sur toutes les pages. Le survol et
   l'apparition sont des transitions CSS (déjà neutralisées en
   mouvement réduit par style.css) ; le défilement fluide déclenché
   ici est du JS, donc on vérifie nous-mêmes la préférence avant de
   l'utiliser. */
const backToTop = document.createElement('button');
backToTop.id = 'backToTop';
backToTop.type = 'button';
backToTop.setAttribute('aria-label', 'Retourner en haut de la page');
backToTop.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>';
document.body.appendChild(backToTop);

window.addEventListener('scroll', () => {
  backToTop.classList.toggle('show', window.scrollY > 500);
}, { passive: true });

backToTop.addEventListener('click', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
});
