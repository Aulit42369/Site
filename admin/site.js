/* admin/site.js — Onglet Liens & annonce. Chargé par admin.html avant admin.js (voir l'ordre là-bas). */
/* ── Liens & annonce (data/site.json) ── */
const DEFAULT_SITE = {
  socials: [
    { label: 'Discord', url: 'https://discord.com/invite/Amgaz5YNVg' },
    { label: 'YouTube', url: 'https://www.youtube.com/@Aulit42369' },
    { label: 'Instagram', url: 'https://www.instagram.com/aulit42369/?hl=fr' },
  ],
  announcement: { enabled: false, text: '', linkLabel: '', linkUrl: '', tone: 'info', from: '', until: '' },
  escapeServerUrl: '',
};
function normalizeSite(d) {
  const def = JSON.parse(JSON.stringify(DEFAULT_SITE));
  if (!d || typeof d !== 'object' || Array.isArray(d)) return def;
  const a = d.announcement && typeof d.announcement === 'object' ? d.announcement : {};
  return {
    escapeServerUrl: strOr(d.escapeServerUrl),
    socials: Array.isArray(d.socials) ? d.socials.map((s) => ({ label: strOr(s && s.label), url: strOr(s && s.url) })) : def.socials,
    announcement: {
      enabled: !!a.enabled, text: strOr(a.text), linkLabel: strOr(a.linkLabel), linkUrl: strOr(a.linkUrl),
      tone: a.tone === 'alerte' ? 'alerte' : 'info', from: strOr(a.from), until: strOr(a.until),
    },
  };
}
let siteState = { data: normalizeSite(null), sha: null };
function announcementStatus(a) {
  if (!a.text.trim()) return 'Aucun texte saisi.';
  if (!a.enabled) return 'Désactivée — rien ne s\'affiche sur le site (le texte reste lisible dans data/site.json).';
  const t = todayStr();
  if (a.from && t < a.from) return 'Programmée — elle apparaîtra le ' + frDate(a.from) + ' (le texte est déjà lisible dans data/site.json).';
  if (a.until && t > a.until) return 'Expirée — elle ne s\'affiche plus.';
  return 'Affichée sur toutes les pages' + (a.until ? ' jusqu\'au ' + frDate(a.until) + ' inclus' : ' (sans date de fin)') + '.';
}
function updateAnnPreview() {
  const a = siteState.data.announcement;
  const prev = document.getElementById('annPreview');
  if (!prev) return;
  prev.className = 'announce' + (a.tone === 'alerte' ? ' announce-alerte' : '');
  prev.innerHTML = '<span>' + escapeHtml(a.text || 'Ton message apparaîtra ici') + '</span>' +
    (a.linkUrl ? '<span class="announce-link">' + escapeHtml(a.linkLabel || 'En savoir plus') + '</span>' : '');
  document.getElementById('annStatus').textContent = announcementStatus(a);
}
function renderSite() {
  const d = siteState.data, a = d.announcement;
  const last = d.socials.length - 1;
  const socials = d.socials.map((s, i) => `
    <div class="ap-row">
      <div class="ap-fields">
        <div class="field"><label>Nom affiché</label><input type="text" data-sl="${i}" data-f="label" value="${escapeHtml(s.label)}"></div>
        <div class="field"><label>Adresse (https://…)</label><input type="text" data-sl="${i}" data-f="url" value="${escapeHtml(s.url)}"></div>
      </div>
      <div class="ap-btns">
        <button type="button" data-sact="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} title="Monter">▲</button>
        <button type="button" data-sact="down" data-i="${i}" ${i === last ? 'disabled' : ''} title="Descendre">▼</button>
        <button type="button" class="danger" data-sact="del" data-i="${i}" title="Supprimer ce lien">✕</button>
      </div>
    </div>`).join('') || '<div class="ap-empty">Aucun lien — le pied de page garde ses liens d\'origine.</div>';
  document.getElementById('siteEditor').innerHTML = `
    <div class="ap-section">
      <h2>Liens du pied de page</h2>
      ${socials}
      <button type="button" class="ap-add" data-sact="add">+ Ajouter un lien</button>
    </div>
    <div class="ap-section">
      <h2>Jeu Escape Fragments</h2>
      <div class="field"><label>Adresse du serveur du jeu (https://…)</label><input type="text" data-esc="escapeServerUrl" value="${escapeHtml(d.escapeServerUrl)}" placeholder="https://escape-fragments.onrender.com"></div>
      <p class="admin-note" style="margin:0;">Sert à la page « Classement des agents ». Vide = adresse par défaut (https://escape-fragments.onrender.com). L'état du serveur est visible dans « Santé du site ».</p>
    </div>
    <div class="ap-section">
      <h2>Bandeau d'annonce</h2>
      <label class="ap-check"><input type="checkbox" data-ann="enabled" ${a.enabled ? 'checked' : ''}> Afficher le bandeau</label>
      <div class="field"><label>Message</label><input type="text" data-ann="text" maxlength="200" value="${escapeHtml(a.text)}" placeholder="ex : Pas de stream ce soir — retour demain 21h !"></div>
      <div class="ap-inline" style="margin-bottom:16px;">
        <div class="field"><label>Style</label><select data-ann="tone"><option value="info" ${a.tone === 'info' ? 'selected' : ''}>Information</option><option value="alerte" ${a.tone === 'alerte' ? 'selected' : ''}>Alerte (rose)</option></select></div>
        <div class="field"><label>Texte du lien (facultatif)</label><input type="text" data-ann="linkLabel" value="${escapeHtml(a.linkLabel)}" placeholder="ex : Voir le planning"></div>
        <div class="field"><label>Adresse du lien</label><input type="text" data-ann="linkUrl" value="${escapeHtml(a.linkUrl)}" placeholder="https://… ou planning.html"></div>
      </div>
      <div class="ap-inline" style="margin-bottom:16px;">
        <div class="field"><label>Affichée à partir du (facultatif)</label><input type="date" data-ann="from" value="${escapeHtml(a.from)}"></div>
        <div class="field"><label>Jusqu'au, inclus (facultatif)</label><input type="date" data-ann="until" value="${escapeHtml(a.until)}"></div>
      </div>
      <div class="preview-label">Aperçu</div>
      <div id="annPreview" class="announce"></div>
      <p class="admin-note" id="annStatus" style="margin:12px 0 0;"></p>
    </div>`;
  updateAnnPreview();
}
(function wireSite() {
  const ed = document.getElementById('siteEditor');
  ed.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.esc) {
      siteState.data.escapeServerUrl = el.value;
    } else if (el.dataset.sl !== undefined) {
      siteState.data.socials[Number(el.dataset.sl)][el.dataset.f] = el.value;
    } else if (el.dataset.ann) {
      siteState.data.announcement[el.dataset.ann] = el.type === 'checkbox' ? el.checked : el.value;
      updateAnnPreview();
    }
  });
  ed.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sact]');
    if (!b) return;
    const list = siteState.data.socials, i = Number(b.dataset.i), act = b.dataset.sact;
    if (act === 'add') list.push({ label: '', url: '' });
    else if (act === 'del') list.splice(i, 1);
    else if (act === 'up' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
    else if (act === 'down' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
    renderSite();
    if (act === 'add') {
      const f = ed.querySelectorAll('[data-sl][data-f="label"]');
      if (f.length) f[f.length - 1].focus();
    }
  });
})();
async function saveSite() {
  const d = siteState.data, a = d.announcement;
  const socials = d.socials.map((s) => ({ label: s.label.trim(), url: s.url.trim() })).filter((s) => s.label || s.url);
  const bad = socials.find((s) => !s.label || !/^https?:\/\//i.test(s.url));
  if (bad) return showStatus('Chaque lien a besoin d\'un nom et d\'une adresse qui commence par https://', 'err');
  const linkUrl = a.linkUrl.trim();
  if (linkUrl && !/^https?:\/\//i.test(linkUrl) && !/^[a-z0-9_-]+\.html$/i.test(linkUrl)) {
    return showStatus('Adresse du lien de l\'annonce : https://… ou une page du site (ex : planning.html).', 'err');
  }
  if (a.from && a.until && a.until < a.from) return showStatus('La date de fin est avant la date de début.', 'err');
  const esc = d.escapeServerUrl.trim().replace(/\/+$/, '');
  if (esc && !/^https:\/\/[^\s]+$/i.test(esc)) return showStatus('Adresse du serveur du jeu : elle doit commencer par https://', 'err');
  const clean = {
    escapeServerUrl: esc,
    socials,
    announcement: { enabled: !!a.enabled, text: a.text.trim(), linkLabel: a.linkLabel.trim(), linkUrl, tone: a.tone === 'alerte' ? 'alerte' : 'info', from: a.from, until: a.until },
  };
  showStatus('Enregistrement...', 'pending');
  try {
    const result = await writeJsonFile('data/site.json', clean, siteState.sha, 'Mise à jour liens et annonce');
    siteState = { data: normalizeSite(clean), sha: result.content.sha };
    renderSite();
    showStatus('Liens et annonce enregistrés.', 'ok');
  } catch (err) {
    showStatus('Échec : ' + err.message, 'err');
  }
}
document.getElementById('saveSiteBtn').addEventListener('click', saveSite);
