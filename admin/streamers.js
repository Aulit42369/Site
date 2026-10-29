/* admin/streamers.js — Onglet Streamers. Chargé par admin.html avant admin.js (voir l'ordre là-bas). */
/* ── Streamers ── */
function renderStreamers() {
  const list = document.getElementById('streamersList');
  if (streamersState.data.length === 0) {
    list.innerHTML = '<div class="empty-row">Aucun streamer pour l\'instant.</div>';
    return;
  }
  list.innerHTML = '';
  const last = streamersState.data.length - 1;
  streamersState.data.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'entry-card';
    card.innerHTML = `
      <div class="entry-order">
        <button data-up="${i}" ${i === 0 ? 'disabled' : ''} title="Monter">▲</button>
        <button data-down="${i}" ${i === last ? 'disabled' : ''} title="Descendre">▼</button>
      </div>
      <div class="entry-body">
        <div class="entry-title">${escapeHtml(s.name)}</div>
        <div class="entry-sub">${escapeHtml(s.description || '')}</div>
      </div>
      <div class="entry-actions">
        <button data-edit="${i}">Modifier</button>
        <button data-delete="${i}" class="danger">Supprimer</button>
      </div>`;
    list.appendChild(card);
  });
  list.querySelectorAll('[data-up]').forEach((btn) =>
    btn.addEventListener('click', () => moveStreamer(Number(btn.dataset.up), -1))
  );
  list.querySelectorAll('[data-down]').forEach((btn) =>
    btn.addEventListener('click', () => moveStreamer(Number(btn.dataset.down), 1))
  );
  list.querySelectorAll('[data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => openStreamerForm(Number(btn.dataset.edit)))
  );
  list.querySelectorAll('[data-delete]').forEach((btn) =>
    btn.addEventListener('click', () => deleteStreamer(Number(btn.dataset.delete)))
  );
}

async function moveStreamer(index, dir) {
  const target = index + dir;
  if (target < 0 || target >= streamersState.data.length) return;
  const next = [...streamersState.data];
  [next[index], next[target]] = [next[target], next[index]];
  showStatus('Réorganisation...', 'pending');
  try {
    const result = await writeJsonFile('data/streamers.json', next, streamersState.sha, 'Réorganisation streamers');
    streamersState = { data: next, sha: result.content.sha };
    renderStreamers();
    showStatus('Ordre mis à jour.', 'ok');
  } catch (e) {
    showStatus('Échec : ' + e.message, 'err');
  }
}

let editingStreamerIndex = null;
function openStreamerForm(index) {
  editingStreamerIndex = index;
  const s = index === null ? { name: '', url: '', description: '', avatar: '' } : streamersState.data[index];
  document.getElementById('sfName').value = s.name || '';
  document.getElementById('sfUrl').value = s.url || '';
  document.getElementById('sfDesc').value = s.description || '';
  document.getElementById('sfAvatar').value = s.avatar || '';
  document.getElementById('streamerForm').style.display = 'block';
  document.getElementById('sfPreviewBox').style.display = 'none';
}
function closeStreamerForm() {
  document.getElementById('streamerForm').style.display = 'none';
  document.getElementById('sfPreviewBox').style.display = 'none';
  editingStreamerIndex = null;
}

/* Aperçu fidèle de la carte streamer telle qu'elle apparaît sur
   streamers.html, à partir des valeurs en cours du formulaire (pas
   encore enregistrées). S'actualise en direct pendant la saisie une
   fois ouvert. */
function renderStreamerPreview() {
  const name = document.getElementById('sfName').value.trim() || 'Nom du streamer';
  const desc = document.getElementById('sfDesc').value.trim() || 'Description à venir.';
  const rawUrl = document.getElementById('sfUrl').value.trim();
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : '#';
  const avatar = document.getElementById('sfAvatar').value.trim();
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const card = document.getElementById('sfPreviewCard');
  card.innerHTML = `
    <div class="streamer-avatar" id="sfPreviewAvatar">${escapeHtml(initial)}</div>
    <div class="streamer-name">${escapeHtml(name)}</div>
    <p class="streamer-desc">${escapeHtml(desc)}</p>
    <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="btn btn-secondary">Voir la chaîne</a>
  `;
  if (/^https?:\/\//i.test(avatar)) {
    const avatarEl = document.getElementById('sfPreviewAvatar');
    const img = new Image();
    img.onload = () => {
      avatarEl.style.backgroundImage = `url("${encodeURI(avatar).replace(/["')]/g, encodeURIComponent)}")`;
      avatarEl.style.backgroundSize = 'cover';
      avatarEl.style.backgroundPosition = 'center';
      avatarEl.textContent = '';
    };
    img.src = avatar;
  }
}
document.getElementById('sfPreviewBtn').addEventListener('click', () => {
  const box = document.getElementById('sfPreviewBox');
  const opening = box.style.display === 'none';
  box.style.display = opening ? 'block' : 'none';
  if (opening) renderStreamerPreview();
});
['sfName', 'sfUrl', 'sfDesc', 'sfAvatar'].forEach((id) => {
  document.getElementById(id).addEventListener('input', () => {
    if (document.getElementById('sfPreviewBox').style.display !== 'none') renderStreamerPreview();
  });
});

async function saveStreamer() {
  const name = document.getElementById('sfName').value.trim();
  const url = document.getElementById('sfUrl').value.trim();
  const description = document.getElementById('sfDesc').value.trim();
  const avatar = document.getElementById('sfAvatar').value.trim();
  if (!name || !url || !description) {
    showStatus('Pseudo, URL et description sont obligatoires.', 'err');
    return;
  }
  const entry = { name, url, description };
  if (avatar) entry.avatar = avatar;

  const next = [...streamersState.data];
  if (editingStreamerIndex === null) next.push(entry);
  else next[editingStreamerIndex] = entry;

  showStatus('Enregistrement...', 'pending');
  try {
    const result = await writeJsonFile('data/streamers.json', next, streamersState.sha,
      (editingStreamerIndex === null ? 'Ajout streamer : ' : 'Modification streamer : ') + name);
    streamersState = { data: next, sha: result.content.sha };
    renderStreamers();
    closeStreamerForm();
    showStatus('Enregistré.', 'ok');
  } catch (e) {
    showStatus('Échec : ' + e.message, 'err');
  }
}

async function deleteStreamer(index) {
  const s = streamersState.data[index];
  if (!confirm(`Supprimer "${s.name}" ?`)) return;
  const next = streamersState.data.filter((_, i) => i !== index);
  showStatus('Suppression...', 'pending');
  try {
    const result = await writeJsonFile('data/streamers.json', next, streamersState.sha, 'Suppression streamer : ' + s.name);
    streamersState = { data: next, sha: result.content.sha };
    renderStreamers();
    showStatus('Supprimé.', 'ok');
  } catch (e) {
    showStatus('Échec : ' + e.message, 'err');
  }
}

/* Signale les streamers dont le lien Twitch ne répond plus (compte
   supprimé ou renommé) — détecté côté GitHub Action, voir
   scripts/update-twitch-status.js, écrit dans data/broken-links.json.
   Purement informatif : rien n'est modifié ni supprimé ici. */
async function checkBrokenLinks() {
  const warning = document.getElementById('brokenLinksWarning');
  try {
    const res = await fetch('data/broken-links.json');
    if (!res.ok) return;
    const broken = await res.json();
    if (!Array.isArray(broken) || broken.length === 0) return;
    const names = streamersState.data
      .filter((s) => {
        try {
          const username = new URL(s.url).pathname.split('/').filter(Boolean).pop().toLowerCase();
          return broken.includes(username);
        } catch {
          return false;
        }
      })
      .map((s) => s.name);
    if (names.length === 0) return;
    warning.textContent = '⚠ Lien Twitch introuvable pour : ' + names.join(', ') + ' (chaîne supprimée ou renommée ? à vérifier).';
    warning.style.display = 'block';
  } catch {
    // silencieux : purement informatif, ne doit jamais bloquer le reste de l'admin
  }
}
