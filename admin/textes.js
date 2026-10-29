/* admin/textes.js — Onglet Textes des pages (+ projets supplémentaires de Coulisses). Chargé par admin.html avant admin.js (voir l'ordre là-bas). */
/* ── Textes des pages (data/pages.json) ── */
const TEXT_PAGES = [
  ['index.html', 'Accueil'], ['planning.html', 'Planning'], ['clips.html', 'Clips'], ['streamers.html', 'Streamers'],
  ['apropos.html', 'À propos'], ['coulisses.html', 'Coulisses'], ['contact.html', 'Contact'], ['mentions-legales.html', 'Mentions légales'],
  ['confidentialite.html', 'Confidentialité et cookies'], ['cgu.html', 'Conditions d’utilisation (CGU)'],
  ['escape-fragments.html', 'Escape Fragments (classement)'], ['jeux.html', 'Jeux (page et installation)'], ['partenaires.html', 'Partenaires (kit média)'],
];
function normalizePages(d) {
  const out = { texts: {}, extraProjects: [] };
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    if (d.texts && typeof d.texts === 'object') {
      Object.keys(d.texts).forEach((k) => { if (typeof d.texts[k] === 'string') out.texts[k] = d.texts[k]; });
    }
    if (Array.isArray(d.extraProjects)) {
      out.extraProjects = d.extraProjects.filter((p) => p && typeof p === 'object').map((p) => ({
        eyebrow: strOr(p.eyebrow), title: strOr(p.title), stack: strOr(p.stack),
        ptext: (Array.isArray(p.paragraphs) ? p.paragraphs.map(String) : []).join('\n\n'),
      }));
    }
  }
  return out;
}
let pagesState = { data: normalizePages(null), sha: null };
let textesModel = null;
let textesComplet = false; // toutes les pages relues : un texte stocké sans emplacement est un ancien texte, supprimé

/* HTML d'une page → texte à balisage simple (l'inverse de renderRichText de main.js) */
function domToMarkup(node) {
  let out = '';
  node.childNodes.forEach((n) => {
    if (n.nodeType === 3) out += n.nodeValue.replace(/\s+/g, ' ');
    else if (n.nodeType === 1) {
      const inner = domToMarkup(n);
      if (n.tagName === 'EM') out += '*' + inner + '*';
      else if (n.tagName === 'A') out += '[' + inner + '](' + (n.getAttribute('href') || '') + ')';
      else if (n.tagName === 'CODE') out += '`' + inner + '`';
      else if (n.tagName === 'BR') out += '\n';
      else out += inner;
    }
  });
  return out;
}
function markupOf(el) { return domToMarkup(el).replace(/ *\n */g, '\n').trim(); }

async function loadTextes() {
  if (textesModel) return;
  const box = document.getElementById('textesEditor');
  box.innerHTML = '<div class="ap-empty">Chargement des pages…</div>';
  try {
    const t = Date.now();
    const groups = [];
    let lues = 0;
    for (const [file, title] of TEXT_PAGES) {
      const res = await fetch(file + '?t=' + t, { cache: 'no-store' });
      if (!res.ok) continue;
      lues++;
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      const fields = [...doc.querySelectorAll('[data-edit]')].map((el) => {
        const key = el.getAttribute('data-edit');
        const def = markupOf(el);
        const ov = pagesState.data.texts[key];
        const rawLabel = el.getAttribute('data-edit-label') || key;
        const label = /élément \d+$/.test(rawLabel) ? rawLabel.replace(/élément \d+$/, '« ' + def.slice(0, 45).replace(/[`*\[\]]/g, '') + (def.length > 45 ? '…' : '') + ' »') : rawLabel;
        return { key, label, def, value: typeof ov === 'string' && ov.trim() ? ov : def };
      });
      if (fields.length) groups.push({ file, title, fields });
    }
    textesModel = groups;
    textesComplet = lues === TEXT_PAGES.length;
    renderTextes();
  } catch (e) {
    box.innerHTML = '<div class="ap-empty">Impossible de charger les pages : ' + escapeHtml(e.message) + '</div>';
  }
}
function renderTextes() {
  const box = document.getElementById('textesEditor');
  const openFiles = new Set([...box.querySelectorAll('details[open]')].map((d) => d.dataset.file));
  box.innerHTML = textesModel.map((g) => {
    const modified = g.fields.filter((f) => f.value !== f.def).length;
    return `<details class="tx-group" data-file="${escapeHtml(g.file)}" ${openFiles.has(g.file) ? 'open' : ''}><summary>${escapeHtml(g.title)}<span class="tx-count">${g.fields.length} textes${modified ? ' · ' + modified + ' modifié' + (modified > 1 ? 's' : '') : ''}</span></summary>
      <div class="tx-body"><div style="margin-bottom:12px;"><button type="button" class="btn btn-secondary" data-preview="${escapeHtml(g.file)}">Aperçu de la page avec ces textes</button></div><div class="tx-preview" data-prev-for="${escapeHtml(g.file)}"></div>${g.fields.map((f) => `
        <div class="field tx-field ${f.value !== f.def ? 'modified' : ''}">
          <label>${escapeHtml(f.label)}<button type="button" class="tx-reset" data-reset="${escapeHtml(f.key)}">Rétablir</button></label>
          <textarea data-tk="${escapeHtml(f.key)}" rows="${Math.min(10, Math.max(1, Math.ceil(f.value.length / 80) + (f.value.match(/\n/g) || []).length))}">${escapeHtml(f.value)}</textarea>
        </div>`).join('')}</div></details>`;
  }).join('') || '<div class="ap-empty">Aucun texte éditable trouvé.</div>';
}
function textField(key) {
  for (const g of textesModel || []) for (const f of g.fields) if (f.key === key) return f;
  return null;
}
function previewPage(file) {
  const g = (textesModel || []).find((x) => x.file === file);
  const holder = document.querySelector('[data-prev-for="' + file + '"]');
  if (!g || !holder) return;
  holder.innerHTML = '';
  const fr = document.createElement('iframe');
  fr.title = 'Aperçu ' + file;
  fr.style.cssText = 'width:100%;height:520px;border:1px solid var(--line);border-radius:4px;background:#070a10;margin-bottom:14px;';
  fr.addEventListener('load', () => {
    const w = fr.contentWindow;
    Promise.resolve(w.pagesDataPromise).then(() => {
      g.fields.forEach((f) => {
        if (!f.value.trim()) return;
        const el = w.document.querySelector('[data-edit="' + f.key.replace(/"/g, '') + '"]');
        if (el && typeof w.renderRichText === 'function') el.innerHTML = w.renderRichText(f.value);
      });
    }).catch(() => {});
  });
  fr.src = file;
  holder.appendChild(fr);
}
(function wireTextes() {
  const box = document.getElementById('textesEditor');
  box.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.dataset.tk) return;
    const f = textField(el.dataset.tk);
    if (!f) return;
    f.value = el.value;
    el.closest('.tx-field').classList.toggle('modified', el.value.trim() !== '' && el.value !== f.def);
  });
  box.addEventListener('click', (e) => {
    const pv = e.target.closest('[data-preview]');
    if (pv) { previewPage(pv.dataset.preview); return; }
    const b = e.target.closest('[data-reset]');
    if (!b) return;
    const f = textField(b.dataset.reset);
    if (!f) return;
    f.value = f.def;
    const wrap = b.closest('.tx-field');
    wrap.querySelector('textarea').value = f.def;
    wrap.classList.remove('modified');
  });
})();

/* projets supplémentaires de la page Coulisses */
function renderExtra() {
  const list = pagesState.data.extraProjects;
  const last = list.length - 1;
  const rows = list.map((p, i) => `
    <div class="ap-row">
      <div class="ap-fields">
        <div class="field"><label>Sur-titre (ex : Mon nouvel outil)</label><input type="text" data-xp="${i}" data-f="eyebrow" value="${escapeHtml(p.eyebrow)}"></div>
        <div class="field"><label>Titre (<code>*mot*</code> = mot en couleur)</label><input type="text" data-xp="${i}" data-f="title" value="${escapeHtml(p.title)}"></div>
        <div class="field"><label>Description (une ligne vide = nouveau paragraphe)</label><textarea data-xp="${i}" data-f="ptext" rows="5">${escapeHtml(p.ptext)}</textarea></div>
        <div class="field"><label>Technologies (facultatif)</label><input type="text" data-xp="${i}" data-f="stack" value="${escapeHtml(p.stack)}"></div>
      </div>
      <div class="ap-btns">
        <button type="button" data-xact="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} title="Monter">▲</button>
        <button type="button" data-xact="down" data-i="${i}" ${i === last ? 'disabled' : ''} title="Descendre">▼</button>
        <button type="button" class="danger" data-xact="del" data-i="${i}" title="Supprimer ce projet">✕</button>
      </div>
    </div>`).join('') || '<div class="ap-empty">Aucun projet supplémentaire.</div>';
  document.getElementById('extraEditor').innerHTML = `
    <div class="ap-section" style="margin-top:20px;">
      <h2>Projets supplémentaires (page Coulisses)</h2>
      <p class="admin-note" style="margin-bottom:16px;">Texte seul (sans schéma), affichés à la suite des projets existants.</p>
      ${rows}
      <button type="button" class="ap-add" data-xact="add">+ Ajouter un projet</button>
    </div>`;
}
(function wireExtra() {
  const box = document.getElementById('extraEditor');
  box.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.xp === undefined) return;
    pagesState.data.extraProjects[Number(el.dataset.xp)][el.dataset.f] = el.value;
  });
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-xact]');
    if (!b) return;
    const list = pagesState.data.extraProjects, i = Number(b.dataset.i), act = b.dataset.xact;
    if (act === 'add') list.push({ eyebrow: '', title: '', ptext: '', stack: '' });
    else if (act === 'del') list.splice(i, 1);
    else if (act === 'up' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
    else if (act === 'down' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
    renderExtra();
    if (act === 'add') {
      const f = box.querySelectorAll('[data-f="eyebrow"]');
      if (f.length) f[f.length - 1].focus();
    }
  });
})();
async function saveTextes() {
  const texts = {};
  if (textesModel) {
    const known = new Set();
    textesModel.forEach((g) => g.fields.forEach((f) => {
      known.add(f.key);
      if (f.value.trim() && f.value !== f.def) texts[f.key] = f.value;
    }));
    // garde les modifications de pages qu'on n'a pas pu relire
    if (!textesComplet) Object.keys(pagesState.data.texts).forEach((k) => { if (!known.has(k)) texts[k] = pagesState.data.texts[k]; });
  } else {
    Object.assign(texts, pagesState.data.texts);
  }
  const extraProjects = pagesState.data.extraProjects.map((p) => ({
    eyebrow: p.eyebrow.trim(), title: p.title.trim(), stack: p.stack.trim(),
    paragraphs: p.ptext.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean),
  })).filter((p) => p.title);
  const clean = { texts, extraProjects };
  const before = pagesState.data.texts;
  const changed = Object.keys(texts).filter((k) => before[k] !== texts[k]);
  const reset = Object.keys(before).filter((k) => !(k in texts));
  const extraChanged = JSON.stringify(extraProjects) !== JSON.stringify(pagesState.data.extraProjects.map((p) => ({ eyebrow: p.eyebrow.trim(), title: p.title.trim(), stack: p.stack.trim(), paragraphs: p.ptext.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean) })).filter((p) => p.title));
  if (!changed.length && !reset.length && !extraChanged) return showStatus('Aucune modification à enregistrer.', 'pending');
  const labelOf = (k) => { const f = textField(k); return f ? f.label : k; };
  const summary = [].concat(changed.slice(0, 8).map((k) => '• modifié : ' + labelOf(k)), reset.slice(0, 4).map((k) => (textField(k) ? '• rétabli : ' : '• ancien texte supprimé : ') + labelOf(k)), extraChanged ? ['• projets supplémentaires Coulisses'] : []);
  if (changed.length > 8 || reset.length > 4) summary.push('• … et d\'autres');
  if (!confirm('Enregistrer ' + (changed.length + reset.length + (extraChanged ? 1 : 0)) + ' changement(s) ?\n\n' + summary.join('\n'))) return;
  showStatus('Enregistrement...', 'pending');
  try {
    const result = await writeJsonFile('data/pages.json', clean, pagesState.sha, 'Mise à jour des textes des pages');
    pagesState = { data: normalizePages(clean), sha: result.content.sha };
    renderExtra();
    if (textesModel) renderTextes();
    showStatus('Textes enregistrés.', 'ok');
  } catch (err) {
    showStatus('Échec : ' + err.message, 'err');
  }
}
document.getElementById('saveTextesBtn').addEventListener('click', saveTextes);
