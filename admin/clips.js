/* admin/clips.js — Onglet Clips (dont ajout en lot). Chargé par admin.html avant admin.js (voir l'ordre là-bas). */
/* ── Clips ── */
function renderClips() {
  const list = document.getElementById('clipsList');
  if (clipsState.data.length === 0) {
    list.innerHTML = '<div class="empty-row">Aucun clip pour l\'instant.</div>';
    return;
  }
  list.innerHTML = '';
  const last = clipsState.data.length - 1;
  clipsState.data.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'entry-card';
    card.innerHTML = `
      <div class="entry-order">
        <button data-up="${i}" ${i === 0 ? 'disabled' : ''} title="Monter">▲</button>
        <button data-down="${i}" ${i === last ? 'disabled' : ''} title="Descendre">▼</button>
      </div>
      <div class="entry-body">
        <div class="entry-title">${escapeHtml(c.title)}</div>
        <div class="entry-sub">${escapeHtml(c.slug)}</div>
      </div>
      <div class="entry-actions">
        <button data-edit="${i}">Modifier</button>
        <button data-delete="${i}" class="danger">Supprimer</button>
      </div>`;
    list.appendChild(card);
  });
  list.querySelectorAll('[data-up]').forEach((btn) =>
    btn.addEventListener('click', () => moveClip(Number(btn.dataset.up), -1))
  );
  list.querySelectorAll('[data-down]').forEach((btn) =>
    btn.addEventListener('click', () => moveClip(Number(btn.dataset.down), 1))
  );
  list.querySelectorAll('[data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => openClipForm(Number(btn.dataset.edit)))
  );
  list.querySelectorAll('[data-delete]').forEach((btn) =>
    btn.addEventListener('click', () => deleteClip(Number(btn.dataset.delete)))
  );
}

async function moveClip(index, dir) {
  const target = index + dir;
  if (target < 0 || target >= clipsState.data.length) return;
  const next = [...clipsState.data];
  [next[index], next[target]] = [next[target], next[index]];
  showStatus('Réorganisation...', 'pending');
  try {
    const result = await writeJsonFile('data/clips.json', next, clipsState.sha, 'Réorganisation clips');
    clipsState = { data: next, sha: result.content.sha };
    renderClips();
    showStatus('Ordre mis à jour.', 'ok');
  } catch (e) {
    showStatus('Échec : ' + e.message, 'err');
  }
}

let editingClipIndex = null;
function openClipForm(index) {
  editingClipIndex = index;
  const c = index === null ? { slug: '', title: '' } : clipsState.data[index];
  document.getElementById('cfSlug').value = c.slug || '';
  document.getElementById('cfTitle').value = c.title || '';
  document.getElementById('clipForm').style.display = 'block';
  document.getElementById('cfPreviewBox').style.display = 'none';
}
function closeClipForm() {
  document.getElementById('clipForm').style.display = 'none';
  document.getElementById('cfPreviewBox').style.display = 'none';
  editingClipIndex = null;
}

/* Aperçu fidèle de la carte clip telle qu'elle apparaît sur
   clips.html (hors lecteur vidéo, remplacé par un cadre neutre —
   le slug n'a pas besoin d'être valide pour prévisualiser le titre). */
function renderClipPreview() {
  const title = document.getElementById('cfTitle').value.trim() || 'Titre du clip';
  const slug = document.getElementById('cfSlug').value.trim() || 'slug-du-clip';
  const badge = editingClipIndex === null ? ' <span class="badge-new">Nouveau</span>' : '';
  const card = document.getElementById('cfPreviewCard');
  card.innerHTML = `
    <div class="clip-preview-thumb">Aperçu vidéo</div>
    <div class="clip-footer">
      <div class="clip-title">${escapeHtml(title)}${badge}</div>
      <button type="button" class="share-btn" disabled>Partager</button>
    </div>
    <div class="clip-slug">${escapeHtml(slug)}</div>
  `;
}
document.getElementById('cfPreviewBtn').addEventListener('click', () => {
  const box = document.getElementById('cfPreviewBox');
  const opening = box.style.display === 'none';
  box.style.display = opening ? 'block' : 'none';
  if (opening) renderClipPreview();
});

/* Si un lien de clip complet est collé dans le champ "Slug" (le
   réflexe naturel en copiant depuis la barre d'adresse), on en
   extrait automatiquement le slug plutôt que de laisser l'URL
   entière — clips.twitch.tv/SLUG et twitch.tv/chaine/clip/SLUG,
   avec ou sans paramètres après. Un slug déjà saisi tel quel ne
   correspond à aucun des deux motifs et reste inchangé. */
function extractClipSlug(value) {
  const v = value.trim();
  let m = v.match(/clips\.twitch\.tv\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  m = v.match(/twitch\.tv\/[^/\s]+\/clip\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  return null;
}
document.getElementById('cfSlug').addEventListener('input', (e) => {
  const extracted = extractClipSlug(e.target.value);
  if (extracted && extracted !== e.target.value.trim()) {
    e.target.value = extracted;
  }
});

['cfSlug', 'cfTitle'].forEach((id) => {
  document.getElementById(id).addEventListener('input', () => {
    if (document.getElementById('cfPreviewBox').style.display !== 'none') renderClipPreview();
  });
});

async function saveClip() {
  const slug = document.getElementById('cfSlug').value.trim();
  const title = document.getElementById('cfTitle').value.trim();
  if (!slug || !title) {
    showStatus('Slug et titre sont obligatoires.', 'err');
    return;
  }
  /* Un nouveau clip est daté du jour (pour le badge "Nouveau" sur
     clips.html, 7 jours) ; une modification garde la date d'origine
     du clip au lieu de la rajeunir. */
  const entry = editingClipIndex === null
    ? { slug, title, dateAdded: new Date().toISOString().slice(0, 10) }
    : { ...clipsState.data[editingClipIndex], slug, title };
  const next = editingClipIndex === null
    ? [entry, ...clipsState.data]
    : clipsState.data.map((c, i) => (i === editingClipIndex ? entry : c));

  showStatus('Enregistrement...', 'pending');
  try {
    const result = await writeJsonFile('data/clips.json', next, clipsState.sha,
      (editingClipIndex === null ? 'Ajout clip : ' : 'Modification clip : ') + title);
    clipsState = { data: next, sha: result.content.sha };
    renderClips();
    closeClipForm();
    showStatus('Enregistré.', 'ok');
  } catch (e) {
    showStatus('Échec : ' + e.message, 'err');
  }
}

async function deleteClip(index) {
  const c = clipsState.data[index];
  if (!confirm(`Supprimer "${c.title}" ?`)) return;
  const next = clipsState.data.filter((_, i) => i !== index);
  showStatus('Suppression...', 'pending');
  try {
    const result = await writeJsonFile('data/clips.json', next, clipsState.sha, 'Suppression clip : ' + c.title);
    clipsState = { data: next, sha: result.content.sha };
    renderClips();
    showStatus('Supprimé.', 'ok');
  } catch (e) {
    showStatus('Échec : ' + e.message, 'err');
  }
}

/* ── Ajout de plusieurs clips d'un coup ── */
document.getElementById('bulkClipsBtn').addEventListener('click', async () => {
  const lines = document.getElementById('bulkClips').value.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return showStatus('Colle au moins une ligne « lien | titre ».', 'err');
  const known = new Set(clipsState.data.map((c) => c.slug));
  const added = [], skipped = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const line of lines) {
    const [rawLink, ...rest] = line.split('|');
    const link = rawLink.trim();
    const slug = extractClipSlug(link) || (/^[A-Za-z0-9_-]+$/.test(link) ? link : null);
    const title = rest.join('|').trim();
    if (!slug || !title) { skipped.push(line); continue; }
    if (known.has(slug)) { skipped.push(line + ' (déjà présent)'); continue; }
    known.add(slug);
    added.push({ slug, title, dateAdded: today });
  }
  if (!added.length) return showStatus('Rien à ajouter. Lignes ignorées : ' + skipped.join(' ; '), 'err');
  const next = [...added.reverse(), ...clipsState.data];
  showStatus('Enregistrement...', 'pending');
  try {
    const result = await writeJsonFile('data/clips.json', next, clipsState.sha, 'Ajout de ' + added.length + ' clips');
    clipsState = { data: next, sha: result.content.sha };
    renderClips();
    document.getElementById('bulkClips').value = '';
    showStatus(added.length + ' clip' + (added.length > 1 ? 's' : '') + ' ajouté' + (added.length > 1 ? 's' : '') + (skipped.length ? ' — ignoré : ' + skipped.join(' ; ') : '') + '.', 'ok');
  } catch (err) {
    showStatus('Échec : ' + err.message, 'err');
  }
});
