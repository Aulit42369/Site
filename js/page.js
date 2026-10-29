/* ================================================================
   Page personnalisée : son contenu (titre, introduction, blocs) vient
   de data/custom-pages.json, géré dans l'admin (onglet « Pages »).
   Adresse : page.html?p=identifiant
   ================================================================ */
const cpSlug = (new URLSearchParams(location.search).get('p') || '').toLowerCase();
const cpOkLink = (u) => typeof u === 'string' && (/^https?:\/\//i.test(u) || /^[a-z0-9_-]+\.html(\?[\w=&%-]*)?(#[\w-]*)?$/i.test(u));
const cpOkImage = (u) => typeof u === 'string' && !u.includes('..') && (/^https:\/\//i.test(u) || /^[A-Za-z0-9_./-]+\.(png|jpe?g|gif|webp|svg)$/i.test(u));

function cpRenderBlock(b) {
  if (!b || typeof b !== 'object') return '';
  const t = typeof b.text === 'string' ? b.text : '';
  switch (b.type) {
    case 'heading': return t.trim() ? '<h2>' + escapeHtml(t) + '</h2>' : '';
    case 'text': return t.trim() ? '<p>' + renderRichText(t) + '</p>' : '';
    case 'list': {
      const items = (Array.isArray(b.items) ? b.items : []).filter((x) => typeof x === 'string' && x.trim());
      return items.length ? '<ul class="cp-list">' + items.map((x) => '<li>' + renderRichText(x) + '</li>').join('') + '</ul>' : '';
    }
    case 'button': {
      if (!cpOkLink(b.url) || typeof b.label !== 'string' || !b.label.trim()) return '';
      const ext = /^https?:/i.test(b.url);
      return '<p><a class="btn btn-primary" href="' + escapeHtml(b.url) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + escapeHtml(b.label) + '</a></p>';
    }
    case 'image': {
      if (!cpOkImage(b.url)) return '';
      const alt = typeof b.alt === 'string' ? b.alt : '';
      return '<figure><img src="' + escapeHtml(b.url) + '" alt="' + escapeHtml(alt) + '" loading="lazy">' + (alt ? '<figcaption>' + escapeHtml(alt) + '</figcaption>' : '') + '</figure>';
    }
    default: return '';
  }
}

window.customPagesPromise.then((d) => {
  const pages = d && Array.isArray(d.pages) ? d.pages.filter(isValidCustomPage) : [];
  const page = pages.find((p) => p.slug === cpSlug);
  const title = document.getElementById('cpTitle');
  if (!page) {
    document.title = 'Page introuvable | Aulit42369';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    title.textContent = 'Page introuvable';
    document.getElementById('cpBlocks').innerHTML = '<p>Cette page n\'existe pas ou n\'est plus publiée. <a href="index.html">Retour à l\'accueil</a>.</p>';
    return;
  }
  title.textContent = page.title;
  document.title = page.title + ' | Aulit42369';
  const intro = typeof page.intro === 'string' ? page.intro.trim() : '';
  if (intro) {
    const el = document.getElementById('cpIntro');
    el.innerHTML = renderRichText(intro);
    el.style.display = '';
  }
  const blocks = Array.isArray(page.blocks) ? page.blocks : [];
  document.getElementById('cpBlocks').innerHTML = blocks.map(cpRenderBlock).join('');
  const firstText = blocks.find((b) => b && b.type === 'text' && typeof b.text === 'string' && b.text.trim());
  const desc = (intro || (firstText && firstText.text) || '').replace(/[*`\[\]()]/g, '').slice(0, 160);
  if (desc) {
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', desc);
  }
});
