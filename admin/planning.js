/* admin/planning.js — Onglet Planning : semaine type + changements ponctuels. Chargé par admin.html avant admin.js (voir l'ordre là-bas). */
/* ── Planning ── */
const PLANNING_COLORS = [
  { value: '#00f5ff', label: 'Cyan' },
  { value: '#9b5cff', label: 'Violet' },
  { value: '#ff2d78', label: 'Magenta' },
  { value: '#4a5568', label: 'Gris (repos)' },
];

/* Aperçu « Une semaine sur 2 » : ce qui s'affichera les 4 prochains jours concernés. Même règle que planning.html
   (jeuDeLaSemaine) : semaines paires depuis la date de départ = jeu « une semaine sur 2 », les autres = « Jeu » ; vide = repos. */
const JOURS_SEMAINE = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
function apercuAlternance(d, auj = new Date()) {
  if (!d.biweekly) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.anchor || '')) return 'Choisis la date de départ pour voir les prochaines semaines.';
  const depart = new Date(d.anchor + 'T12:00:00');
  if (JOURS_SEMAINE[depart.getDay()] !== d.day) return `⚠ Le ${depart.toLocaleDateString('fr-FR')} n'est pas un ${d.day.toLowerCase()}.`;
  const idx = JOURS_SEMAINE.indexOf(d.day);
  const premier = new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() + ((idx - auj.getDay() + 7) % 7), 12);
  const dates = [0, 1, 2, 3].map((k) => new Date(premier.getFullYear(), premier.getMonth(), premier.getDate() + 7 * k, 12));
  return 'Le site affichera : ' + dates.map((j) => {
    const paire = Math.floor(Math.round((j - depart) / 86400000) / 7) % 2 === 0;
    const jeu = (paire ? d.altGame : d.game) || 'repos';
    return `${j.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} → ${jeu}`;
  }).map(escapeHtml).join(' · ');
}

function renderPlanning() {
  const container = document.getElementById('planningList');
  if (planningState.data.length === 0) {
    container.innerHTML = '<div class="empty-row">Rien à afficher — vérifie que data/planning.json existe dans le dépôt.</div>';
    return;
  }
  container.innerHTML = '';
  planningState.data.forEach((d, i) => {
    const row = document.createElement('div');
    row.className = 'planning-day-card';
    const options = PLANNING_COLORS.map(
      (c) => `<option value="${c.value}" ${d.color === c.value ? 'selected' : ''}>${c.label}</option>`
    ).join('');
    row.innerHTML = `
      <div class="planning-day-name">${escapeHtml(d.day)}</div>
      <label class="planning-on"><input type="checkbox" ${d.on ? 'checked' : ''} data-i="${i}" data-field="on"> Stream ce jour</label>
      <div class="planning-day-fields">
        <div class="field"><label>Début</label><input type="time" value="${escapeHtml(d.time || '')}" data-i="${i}" data-field="time"></div>
        <div class="field"><label>Fin</label><input type="time" value="${escapeHtml(d.end || '')}" data-i="${i}" data-field="end"></div>
        <div class="field"><label>Jeu</label><input type="text" value="${escapeHtml(d.game || '')}" data-i="${i}" data-field="game"></div>
        <div class="field"><label>Mention (ex : une semaine sur deux)</label><input type="text" value="${escapeHtml(d.note || '')}" data-i="${i}" data-field="note"></div>
        <div class="field"><label>Couleur</label><select data-i="${i}" data-field="color">${options}</select></div>
      </div>
      <div class="planning-alt${d.biweekly ? ' actif' : ''}">
        <label class="planning-on"><input type="checkbox" ${d.biweekly ? 'checked' : ''} data-i="${i}" data-field="biweekly"> Une semaine sur 2 : deux jeux en alternance</label>
        <div class="planning-alt-cols">
          <div class="field"><label>Jeu une semaine sur 2</label>
            <input type="text" value="${escapeHtml(d.altGame || '')}" data-i="${i}" data-field="altGame" placeholder="ex : 7D2D" ${d.biweekly ? '' : 'disabled'}>
            <small class="admin-note">Les autres semaines : le jeu de la case « Jeu » au-dessus (vide = repos).</small></div>
          <div class="field"><label>Date de départ de ce jeu</label>
            <input type="date" value="${escapeHtml(d.anchor || '')}" data-i="${i}" data-field="anchor" aria-label="Date d'un ${escapeHtml(d.day.toLowerCase())} où tu joues au jeu une semaine sur 2" ${d.biweekly ? '' : 'disabled'}>
            <small class="admin-note">Un ${escapeHtml(d.day.toLowerCase())} où tu joues à ce jeu ; la suite alterne toute seule.</small></div>
        </div>
        <p class="planning-apercu" data-apercu="${i}">${apercuAlternance(d)}</p>
      </div>`;
    container.appendChild(row);
  });
  container.querySelectorAll('[data-field]').forEach((el) => {
    el.addEventListener('change', () => {
      const i = Number(el.dataset.i);
      const field = el.dataset.field;
      const entry = planningState.data[i];
      if (field === 'on' || field === 'biweekly') entry[field] = el.checked;
      else entry[field] = el.value;
      const apercu = container.querySelector(`[data-apercu="${i}"]`);
      if (apercu) setTimeout(() => { apercu.textContent = apercuAlternance(entry); }); // après le traitement de « biweekly »
      if (field === 'biweekly') {
        // La date n'a de sens que si la case est cochée ; la mention publique suit la case tant qu'elle est vide ou automatique.
        const dateInput = container.querySelector(`[data-i="${i}"][data-field="anchor"]`);
        const noteInput = container.querySelector(`[data-i="${i}"][data-field="note"]`);
        const altInput = container.querySelector(`[data-i="${i}"][data-field="altGame"]`);
        dateInput.disabled = altInput.disabled = !el.checked;
        el.closest('.planning-alt').classList.toggle('actif', el.checked);
        if (el.checked && !entry.note) entry.note = noteInput.value = 'Une semaine sur 2';
        if (!el.checked) {
          delete entry.anchor;
          delete entry.altGame;
          dateInput.value = altInput.value = '';
          if (entry.note === 'Une semaine sur 2') entry.note = noteInput.value = '';
        }
      }
    });
  });
}

async function savePlanning() {
  const sansDate = planningState.data.find((d) => d.biweekly && !/^\d{4}-\d{2}-\d{2}$/.test(d.anchor || ''));
  if (sansDate) {
    showStatus(`${sansDate.day} : « Une semaine sur 2 » demande la date de départ (un ${sansDate.day.toLowerCase()} où tu joues au jeu une semaine sur 2).`, 'err');
    return;
  }
  showStatus('Enregistrement...', 'pending');
  try {
    const result = await writeJsonFile('data/planning.json', planningState.data, planningState.sha, 'Mise à jour planning');
    planningState.sha = result.content.sha;
    showStatus('Planning enregistré.', 'ok');
  } catch (e) {
    showStatus('Échec : ' + e.message, 'err');
  }
}

document.getElementById('savePlanningBtn').addEventListener('click', savePlanning);

/* ── Planning : changements ponctuels (data/planning-exceptions.json) ── */
let exState = { data: [], sha: null };
function normalizeEx(d) {
  if (!Array.isArray(d)) return [];
  return d.filter((e) => e && typeof e === 'object').map((e) => ({
    date: strOr(e.date), on: e.on !== false, game: strOr(e.game), time: strOr(e.time), end: strOr(e.end), note: strOr(e.note),
  }));
}
function renderExceptions() {
  const box = document.getElementById('exceptionsEditor');
  if (exState.data.length === 0) {
    box.innerHTML = '<div class="ap-empty">Aucun changement prévu.</div>';
    return;
  }
  const today = todayStr();
  box.innerHTML = exState.data.map((e, i) => `
    <div class="ap-row ex-row ${e.date && e.date < today ? 'past' : ''}">
      <div class="ap-fields">
        <div class="ap-inline">
          <div class="field"><label>Date ${e.date && e.date < today ? '<span class="ex-past-tag">· passée</span>' : ''}</label><input type="date" data-ex="${i}" data-f="date" value="${escapeHtml(e.date)}"></div>
          <div class="field"><label>Début</label><input type="time" data-ex="${i}" data-f="time" value="${escapeHtml(e.time)}"></div>
          <div class="field"><label>Fin</label><input type="time" data-ex="${i}" data-f="end" value="${escapeHtml(e.end)}"></div>
          <div class="field"><label>Jeu</label><input type="text" data-ex="${i}" data-f="game" value="${escapeHtml(e.game)}"></div>
        </div>
        <div class="field"><label>Précision (facultatif)</label><input type="text" data-ex="${i}" data-f="note" value="${escapeHtml(e.note)}" placeholder="ex : session spéciale avec les abonnés"></div>
        <label class="ap-check" style="margin:0;"><input type="checkbox" data-ex="${i}" data-f="on" ${e.on ? 'checked' : ''}> Il y a stream ce jour-là (décoché = pas de stream)</label>
      </div>
      <div class="ap-btns"><button type="button" class="danger" data-ex-del="${i}" title="Supprimer cette date">✕</button></div>
    </div>`).join('');
}
(function wireExceptions() {
  const box = document.getElementById('exceptionsEditor');
  box.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.ex === undefined) return;
    exState.data[Number(el.dataset.ex)][el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
  });
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ex-del]');
    if (!b) return;
    exState.data.splice(Number(b.dataset.exDel), 1);
    renderExceptions();
  });
  document.getElementById('addExceptionBtn').addEventListener('click', () => {
    exState.data.push({ date: '', on: true, game: '', time: '21:00', end: '00:00', note: '' });
    renderExceptions();
    const dates = box.querySelectorAll('[data-f="date"]');
    if (dates.length) dates[dates.length - 1].focus();
  });
})();
async function saveExceptions() {
  const clean = exState.data
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date))
    .map((e) => ({ date: e.date, on: !!e.on, game: e.game.trim(), time: e.time, end: e.end, note: e.note.trim() }))
    .sort((a, b) => a.date.localeCompare(b.date));
  showStatus('Enregistrement...', 'pending');
  try {
    const result = await writeJsonFile('data/planning-exceptions.json', clean, exState.sha, 'Mise à jour des changements ponctuels du planning');
    exState = { data: clean, sha: result.content.sha };
    renderExceptions();
    showStatus('Changements ponctuels enregistrés.', 'ok');
  } catch (err) {
    showStatus('Échec : ' + err.message, 'err');
  }
}
document.getElementById('saveExceptionsBtn').addEventListener('click', saveExceptions);
