/* Projets supplémentaires (texte seul) ajoutés depuis l'admin, onglet
   « Textes des pages » : data/pages.json → extraProjects. Ils
   s'affichent à la suite des projets ci-dessus. */
window.pagesDataPromise.then(d => {
  const list = d && Array.isArray(d.extraProjects) ? d.extraProjects : [];
  const wrap = document.querySelector('main section.tight .container');
  const colors = ['--cyan', '--magenta', '--violet'];
  let n = 0;
  list.forEach(p => {
    if (!p || typeof p.title !== 'string' || !p.title.trim()) return;
    const paragraphs = (Array.isArray(p.paragraphs) ? p.paragraphs : []).filter(x => typeof x === 'string' && x.trim());
    const block = document.createElement('div');
    block.className = 'project-block project-text-only';
    block.innerHTML = '<div>' +
      (p.eyebrow ? '<div class="project-eyebrow" style="color:var(' + colors[n % 3] + ');">// ' + escapeHtml(p.eyebrow) + '</div>' : '') +
      '<h2>' + renderRichText(p.title) + '</h2>' +
      '<div class="project-desc">' + paragraphs.map(x => '<p>' + renderRichText(x) + '</p>').join('') + '</div>' +
      (p.stack ? '<div class="project-stack">' + escapeHtml(p.stack) + '</div>' : '') +
      '</div>';
    wrap.appendChild(block);
    n++;
  });
  buildToc(wrap);
});

/* Sommaire : un lien par projet (y compris ceux de l'admin), d'après son sur-titre « // Nom ». */
function buildToc(wrap) {
  const blocks = [...wrap.querySelectorAll(':scope > .project-block')];
  const links = blocks.map((block, i) => {
    const label = (block.querySelector('.project-eyebrow') || block.querySelector('h2') || {}).textContent || '';
    const name = label.replace(/^\s*\/\/\s*/, '').trim();
    if (!name) return '';
    if (!block.id) block.id = 'projet-' + (i + 1);
    return '<a href="#' + block.id + '">' + escapeHtml(name) + '</a>';
  }).filter(Boolean);
  if (links.length < 2) return;
  const toc = document.createElement('nav');
  toc.className = 'coulisses-toc';
  toc.setAttribute('aria-label', 'Projets de la page');
  toc.innerHTML = links.join('');
  wrap.insertBefore(toc, wrap.firstChild);

  /* Sur téléphone (CSS ≤ 700 px), une fois le sommaire sorti de l'écran : bouton « Sommaire » collant qui l'ouvre en panneau. */
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'toc-bouton';
  btn.textContent = 'Sommaire';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'tocPanneau');
  const panneau = document.createElement('nav');
  panneau.id = 'tocPanneau';
  panneau.className = 'toc-panneau';
  panneau.hidden = true;
  panneau.setAttribute('aria-label', 'Sommaire des projets');
  panneau.innerHTML = links.join('');
  const fermer = (rendreFocus) => {
    if (panneau.hidden) return;
    panneau.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (rendreFocus) btn.focus();
  };
  btn.addEventListener('click', () => {
    if (!panneau.hidden) return fermer(false);
    panneau.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    panneau.querySelector('a').focus();
  });
  panneau.addEventListener('click', (e) => { if (e.target.closest('a')) fermer(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermer(true); });
  new IntersectionObserver(([e]) => {
    const visible = !e.isIntersecting && e.boundingClientRect.top < 0;
    btn.classList.toggle('visible', visible);
    if (!visible) fermer(false);
  }).observe(toc);
  document.body.append(btn, panneau);
}

/* Chaînes de pastilles (schémas) : pliées sur deux lignes quand elles ne tiennent pas dans leur colonne (voir style.css, .est-plie). */
document.querySelectorAll('.ap-chaine').forEach((ol) => {
  const ajuster = () => {
    ol.classList.remove('est-plie');
    if (ol.scrollWidth > ol.clientWidth + 1) ol.classList.add('est-plie');
  };
  ajuster();
  if ('ResizeObserver' in window) new ResizeObserver(ajuster).observe(ol.parentElement);
  if (document.fonts) document.fonts.ready.then(ajuster);
});
