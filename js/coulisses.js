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
});
