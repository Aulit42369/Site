/* admin/passeports.js — Onglet Passeports (18/11/2026). Parle au service passeport (/Site/passeport-api/admin/…),
   qui vérifie la session de l'admin auprès de site-admin. Chargé par admin.html avant admin.js. */
const API_PP = '/Site/passeport-api/';
const PP_COULEURS = { cyan: 'Cyan', violet: 'Violet', or: 'Or', magenta: 'Magenta' };
const PP_MOTIFS = { etoile: 'Étoile', nombre: 'Nombre (le seuil)', flamme: 'Flamme', carte: 'Carte', bille: 'Bille', eclair: 'Éclair', fleche: 'Flèche', lune: 'Lune', couronne: 'Couronne', coeur: 'Cœur' };
let ppEtat = null;

async function ppAppel(route, corps) {
  const r = await fetch(API_PP + route, corps
    ? { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Passeport': '1' }, body: JSON.stringify(corps) }
    : { credentials: 'same-origin', cache: 'no-store' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erreur || ('Erreur ' + r.status));
  return d;
}

async function loadPasseports() {
  const box = document.getElementById('ppResume');
  try {
    ppEtat = await ppAppel('admin/resume');
  } catch (e) {
    box.innerHTML = '<div class="ap-empty">Service du passeport injoignable : ' + escapeHtml(e.message) + '</div>';
    return;
  }
  const rares = ppEtat.badges.filter((b) => b.actif).sort((a, b) => a.obtenus - b.obtenus).slice(0, 3).map((b) => b.nom).join(', ');
  box.innerHTML = '<div class="pp-chiffres">'
    + '<div><b>' + ppEtat.comptes + '</b><span>passeports ouverts</span></div>'
    + '<div><b>' + ppEtat.classes + '</b><span>dans le classement</span></div>'
    + '<div><b>' + ppEtat.comptent + '</b><span>comptent leurs lives</span></div>'
    + '<div><b>' + ppEtat.lives + '</b><span>lives relevés · saison ' + ppEtat.saison + '</span></div>'
    + '</div><p class="admin-note">Badges les plus rares : ' + escapeHtml(rares || '—') + '.</p>';
  const opts = (sel, liste, libelles) => { sel.innerHTML = liste.map((v) => '<option value="' + escapeHtml(v) + '">' + escapeHtml(libelles[v] || v) + '</option>').join(''); };
  opts(document.getElementById('ppRegle'), Object.keys(ppEtat.regles), ppEtat.regles);
  opts(document.getElementById('ppCouleur'), ppEtat.couleurs, PP_COULEURS);
  opts(document.getElementById('ppMotif'), ppEtat.motifs, PP_MOTIFS);
  document.getElementById('ppBadges').innerHTML = ppEtat.badges.map((b) =>
    '<div class="pp-badge' + (b.actif ? '' : ' off') + '"><div class="pp-nom"><strong>' + escapeHtml(b.nom) + '</strong>'
    + '<small>' + escapeHtml(b.id) + ' · ' + escapeHtml(ppEtat.regles[b.regle] || b.regle) + (b.seuil ? ' · seuil ' + b.seuil : '') + ' · obtenu par ' + b.obtenus + '</small></div>'
    + '<button type="button" data-pp-modif="' + escapeHtml(b.id) + '">Modifier</button>'
    + '<button type="button" data-pp-actif="' + escapeHtml(b.id) + '" data-actif="' + (b.actif ? '0' : '1') + '">' + (b.actif ? 'Retirer' : 'Remettre') + '</button></div>').join('');
  ppChercher();
}

async function ppAction(route, corps, ok) {
  try { await ppAppel(route, corps); showStatus(ok, 'ok'); await loadPasseports(); } catch (e) { showStatus(e.message, 'err'); }
}

let ppMinuteur = null;
async function ppChercher() {
  const q = document.getElementById('ppCherche').value.trim();
  const box = document.getElementById('ppViewers');
  if (!ppEtat) return;
  try {
    const { liste } = await ppAppel('admin/chercher?q=' + encodeURIComponent(q));
    if (!liste.length) { box.innerHTML = '<div class="ap-empty">' + (q ? 'Aucun passeport à ce pseudo.' : 'Aucun passeport ouvert pour l’instant.') + '</div>'; return; }
    const badges = ppEtat.badges.filter((b) => b.actif);
    box.innerHTML = liste.map((v) => '<div class="pp-viewer"><div class="pp-nom"><strong>' + escapeHtml(v.nom) + '</strong><small>' + escapeHtml(v.login) + ' · '
      + v.lives + ' lives · ' + v.obtenus + ' badges' + (v.classement ? (v.retire ? ' · retiré du classement' : ' · dans le classement') : '') + '</small></div>'
      + '<select data-pp-offrir="' + escapeHtml(v.login) + '" aria-label="Offrir ou reprendre un badge à ' + escapeHtml(v.nom) + '"><option value="">Offrir / reprendre un badge…</option>'
      + badges.map((b) => '<option value="' + escapeHtml(b.id) + '">' + (v.offerts.includes(b.id) ? 'Reprendre : ' : 'Offrir : ') + escapeHtml(b.nom) + '</option>').join('') + '</select>'
      + (v.classement ? '<button type="button" data-pp-retire="' + escapeHtml(v.login) + '" data-retire="' + (v.retire ? '0' : '1') + '">' + (v.retire ? 'Remettre au classement' : 'Retirer du classement') + '</button>' : '')
      + '<button type="button" class="danger" data-pp-effacer="' + escapeHtml(v.login) + '">Effacer le compte</button></div>').join('');
    box.querySelectorAll('[data-pp-offrir]').forEach((s) => s.addEventListener('change', () => {
      if (!s.value) return;
      const v = liste.find((x) => x.login === s.dataset.ppOffrir);
      const offrir = !v.offerts.includes(s.value);
      ppAction('admin/offrir', { login: v.login, badge: s.value, offrir }, offrir ? 'Badge offert.' : 'Badge repris.');
    }));
  } catch (e) { box.innerHTML = '<div class="ap-empty">' + escapeHtml(e.message) + '</div>'; }
}

document.getElementById('ppCherche').addEventListener('input', () => { clearTimeout(ppMinuteur); ppMinuteur = setTimeout(ppChercher, 300); });
document.getElementById('passeportsPanel').addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.ppActif) ppAction('admin/badge-actif', { id: b.dataset.ppActif, actif: b.dataset.actif === '1' }, b.dataset.actif === '1' ? 'Badge remis.' : 'Badge retiré (plus affiché, rien n’est perdu).');
  if (b.dataset.ppRetire) ppAction('admin/classement', { login: b.dataset.ppRetire, retire: b.dataset.retire === '1' }, 'Classement mis à jour.');
  if (b.dataset.ppEffacer && confirm('Effacer définitivement le passeport de ' + b.dataset.ppEffacer + ' (présences, badges, réglages) ?')) ppAction('admin/effacer', { login: b.dataset.ppEffacer }, 'Compte effacé.');
  if (b.dataset.ppModif) {
    const x = ppEtat.badges.find((y) => y.id === b.dataset.ppModif);
    document.getElementById('ppId').value = x.id; document.getElementById('ppNom').value = x.nom; document.getElementById('ppRegle').value = x.regle;
    document.getElementById('ppSeuil').value = x.seuil; document.getElementById('ppCouleur').value = x.couleur; document.getElementById('ppMotif').value = x.motif;
    document.getElementById('ppNom').focus();
  }
});
document.getElementById('ppBadgeForm').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const v = (id) => document.getElementById(id).value;
  ppAction('admin/badge', { id: v('ppId').trim(), nom: v('ppNom'), regle: v('ppRegle'), seuil: Number(v('ppSeuil')), couleur: v('ppCouleur'), motif: v('ppMotif') }, 'Badge enregistré.');
});
