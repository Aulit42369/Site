/* admin/pages.js — Onglet Pages personnalisées. Chargé par admin.html avant admin.js (voir l'ordre là-bas). */
/* ── Pages personnalisées (data/custom-pages.json) ── */
const BLOCK_TYPES = [['heading', 'Titre'], ['text', 'Texte'], ['list', 'Liste'], ['button', 'Bouton'], ['image', 'Image']];
function normalizeCustom(d) {
  const pages = d && typeof d === 'object' && Array.isArray(d.pages) ? d.pages : [];
  return {
    pages: pages.filter((p) => p && typeof p === 'object').map((p) => ({
      slug: strOr(p.slug), title: strOr(p.title), intro: strOr(p.intro),
      published: p.published !== false, menu: !!p.menu,
      blocks: (Array.isArray(p.blocks) ? p.blocks : []).filter((b) => b && typeof b === 'object').map((b) => ({
        type: BLOCK_TYPES.some((t) => t[0] === b.type) ? b.type : 'text',
        text: strOr(b.text), label: strOr(b.label), url: strOr(b.url), alt: strOr(b.alt),
        itemsText: (Array.isArray(b.items) ? b.items.filter((x) => typeof x === 'string') : []).join('\n'),
      })),
    })),
  };
}
const customCol = new Collection('custom-pages', normalizeCustom);
function slugify(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
const okLink = (u) => /^https?:\/\//i.test(u) || /^[a-z0-9_-]+\.html(\?[\w=&%-]*)?(#[\w-]*)?$/i.test(u);
const okImage = (u) => !u.includes('..') && (/^https:\/\//i.test(u) || /^[A-Za-z0-9_./-]+\.(png|jpe?g|gif|webp|svg)$/i.test(u));
let savedSlugs = new Set();
function blockFields(b, pi, bi) {
  const f = (name, label, val, ph, area) => `<div class="field"><label>${label}</label>${area
    ? `<textarea rows="3" data-pi="${pi}" data-bi="${bi}" data-bf="${name}" placeholder="${escapeHtml(ph || '')}">${escapeHtml(val)}</textarea>`
    : `<input type="text" data-pi="${pi}" data-bi="${bi}" data-bf="${name}" value="${escapeHtml(val)}" placeholder="${escapeHtml(ph || '')}">`}</div>`;
  if (b.type === 'heading') return f('text', 'Titre', b.text);
  if (b.type === 'text') return f('text', 'Texte (*mot* en couleur, [mot](lien), Entrée = retour à la ligne)', b.text, '', true);
  if (b.type === 'list') return f('itemsText', 'Éléments (un par ligne)', b.itemsText, '', true);
  if (b.type === 'button') return f('label', 'Texte du bouton', b.label) + f('url', 'Adresse (https://… ou page.html)', b.url);
  return f('url', 'Adresse de l\'image (https://… ou images/fichier.png)', b.url) + f('alt', 'Description (légende + accessibilité)', b.alt);
}
function renderPagesEditor() {
  const pages = customCol.data.pages;
  const open = new Set([...document.querySelectorAll('#pagesEditor details[open]')].map((d) => d.dataset.pi));
  document.getElementById('pagesEditor').innerHTML = pages.map((p, pi) => `
    <details class="tx-group" data-pi="${pi}" ${open.has(String(pi)) ? 'open' : ''}>
      <summary>${escapeHtml(p.title || 'Nouvelle page')}<span class="tx-count">${p.published ? 'publiée' : 'brouillon'}${p.menu ? ' · menu' : ''} · ${p.blocks.length} bloc${p.blocks.length > 1 ? 's' : ''}</span></summary>
      <div class="tx-body">
        <div class="ap-inline">
          <div class="field"><label>Titre de la page</label><input type="text" data-pi="${pi}" data-pf="title" value="${escapeHtml(p.title)}"></div>
          <div class="field"><label>Identifiant (adresse)</label><input type="text" data-pi="${pi}" data-pf="slug" value="${escapeHtml(p.slug)}" placeholder="auto d'après le titre"></div>
        </div>
        <div class="field"><label>Introduction (facultatif)</label><textarea rows="2" data-pi="${pi}" data-pf="intro">${escapeHtml(p.intro)}</textarea></div>
        <label class="ap-check"><input type="checkbox" data-pi="${pi}" data-pf="published" ${p.published ? 'checked' : ''}> Publiée (affichée sur le site — un brouillon n'est pas affiché, mais son texte reste lisible dans data/custom-pages.json)</label>
        <label class="ap-check"><input type="checkbox" data-pi="${pi}" data-pf="menu" ${p.menu ? 'checked' : ''}> Dans le menu de navigation</label>
        ${p.blocks.map((b, bi) => `
          <div class="ap-row">
            <div class="ap-fields">
              <div class="field"><label>Bloc ${bi + 1}</label><select data-pi="${pi}" data-bi="${bi}" data-bf="type">${BLOCK_TYPES.map(([v, l]) => `<option value="${v}" ${b.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
              ${blockFields(b, pi, bi)}
            </div>
            <div class="ap-btns">
              <button type="button" data-pact="bup" data-pi="${pi}" data-bi="${bi}" ${bi === 0 ? 'disabled' : ''} title="Monter">▲</button>
              <button type="button" data-pact="bdown" data-pi="${pi}" data-bi="${bi}" ${bi === p.blocks.length - 1 ? 'disabled' : ''} title="Descendre">▼</button>
              <button type="button" class="danger" data-pact="bdel" data-pi="${pi}" data-bi="${bi}" title="Supprimer ce bloc">✕</button>
            </div>
          </div>`).join('')}
        <button type="button" class="ap-add" data-pact="badd" data-pi="${pi}">+ Ajouter un bloc</button>
        <div class="form-actions" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
          ${savedSlugs.has(p.slug) ? `<a class="btn btn-secondary" href="page.html?p=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">Voir la page</a>` : '<span class="admin-note" style="margin:0;">Enregistre pour pouvoir voir la page en ligne.</span>'}
          <button type="button" class="btn btn-secondary danger" data-pact="pdel" data-pi="${pi}">Supprimer cette page</button>
        </div>
      </div>
    </details>`).join('') || '<div class="ap-empty">Aucune page personnalisée pour l\'instant.</div>';
}
(function wirePages() {
  const ed = document.getElementById('pagesEditor');
  ed.addEventListener('input', (e) => {
    const el = e.target;
    const p = customCol.data.pages[Number(el.dataset.pi)];
    if (!p) return;
    if (el.dataset.pf) p[el.dataset.pf] = el.type === 'checkbox' ? el.checked : el.value;
    else if (el.dataset.bf) {
      p.blocks[Number(el.dataset.bi)][el.dataset.bf] = el.value;
      if (el.dataset.bf === 'type') renderPagesEditor();
    }
    if (el.dataset.pf === 'title') {
      const s = el.closest('details').querySelector('summary');
      s.firstChild.textContent = el.value || 'Nouvelle page';
    }
  });
  ed.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pact]');
    if (!b) return;
    const pages = customCol.data.pages, pi = Number(b.dataset.pi), bi = Number(b.dataset.bi), act = b.dataset.pact;
    const p = pages[pi];
    if (act === 'pdel') { if (!confirm('Supprimer la page « ' + (p.title || 'sans titre') + ' » ?')) return; pages.splice(pi, 1); }
    else if (act === 'badd') p.blocks.push({ type: 'text', text: '', label: '', url: '', alt: '', itemsText: '' });
    else if (act === 'bdel') p.blocks.splice(bi, 1);
    else if (act === 'bup' && bi > 0) [p.blocks[bi - 1], p.blocks[bi]] = [p.blocks[bi], p.blocks[bi - 1]];
    else if (act === 'bdown' && bi < p.blocks.length - 1) [p.blocks[bi + 1], p.blocks[bi]] = [p.blocks[bi], p.blocks[bi + 1]];
    renderPagesEditor();
  });
})();
document.getElementById('addPageBtn').addEventListener('click', () => {
  customCol.data.pages.push({ slug: '', title: '', intro: '', published: false, menu: false, blocks: [{ type: 'text', text: '', label: '', url: '', alt: '', itemsText: '' }] });
  markDirty('custom-pages');
  renderPagesEditor();
  const all = document.querySelectorAll('#pagesEditor details');
  const last = all[all.length - 1];
  last.open = true;
  last.querySelector('input').focus();
});
async function savePages() {
  const out = [];
  const seen = new Set();
  for (const [i, p] of customCol.data.pages.entries()) {
    const title = p.title.trim();
    const slug = (p.slug.trim() || slugify(title)).toLowerCase();
    const name = title || 'Page ' + (i + 1);
    if (!title) return showStatus('« ' + name + ' » : le titre est obligatoire.', 'err');
    if (!/^[a-z0-9-]{1,60}$/.test(slug)) return showStatus('« ' + name + ' » : identifiant invalide (lettres minuscules, chiffres et tirets).', 'err');
    if (seen.has(slug)) return showStatus('Deux pages ont le même identifiant « ' + slug + ' ».', 'err');
    seen.add(slug);
    const blocks = [];
    for (const [bi, b] of p.blocks.entries()) {
      const where = '« ' + name + ' », bloc ' + (bi + 1);
      if (b.type === 'heading' || b.type === 'text') {
        if (!b.text.trim()) continue;
        blocks.push({ type: b.type, text: b.text.trim() });
      } else if (b.type === 'list') {
        const items = b.itemsText.split('\n').map((x) => x.trim()).filter(Boolean);
        if (items.length) blocks.push({ type: 'list', items });
      } else if (b.type === 'button') {
        if (!b.label.trim() && !b.url.trim()) continue;
        if (!b.label.trim() || !okLink(b.url.trim())) return showStatus(where + ' : un bouton a besoin d\'un texte et d\'une adresse (https://… ou page.html).', 'err');
        blocks.push({ type: 'button', label: b.label.trim(), url: b.url.trim() });
      } else if (b.type === 'image') {
        if (!b.url.trim()) continue;
        if (!okImage(b.url.trim())) return showStatus(where + ' : adresse d\'image invalide (https://… ou images/fichier.png).', 'err');
        blocks.push({ type: 'image', url: b.url.trim(), alt: b.alt.trim() });
      }
    }
    out.push({ slug, title, intro: p.intro.trim(), published: !!p.published, menu: !!p.menu, blocks });
  }
  const lines = out.map((p) => '• ' + p.title + ' — ' + (p.published ? 'publiée' : 'brouillon') + (p.menu ? ', dans le menu' : '')).join('\n');
  // Site statique + dépôt public : un brouillon est masqué à l'affichage, pas secret.
  const draftWarn = out.some((p) => !p.published) ? '\n\nAttention : le texte des brouillons reste lisible par tous dans data/custom-pages.json (et dans l\'historique GitHub). N\'y mets rien de confidentiel.' : '';
  if (!confirm('Enregistrer ' + out.length + ' page' + (out.length > 1 ? 's' : '') + ' ?\n\n' + lines + draftWarn)) return;
  showStatus('Enregistrement...', 'pending');
  try {
    await customCol.save({ pages: out }, 'Mise à jour des pages personnalisées');
    savedSlugs = new Set(out.map((p) => p.slug));
    renderPagesEditor();
    showStatus('Pages enregistrées. Elles apparaissent sur le site dans la minute qui suit (le plan du site est mis à jour automatiquement).', 'ok');
  } catch (err) {
    showStatus('Échec : ' + err.message, 'err');
  }
}
document.getElementById('savePagesBtn').addEventListener('click', savePages);
