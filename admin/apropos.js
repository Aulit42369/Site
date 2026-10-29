/* admin/apropos.js — Onglet À propos / FAQ. Chargé par admin.html avant admin.js (voir l'ordre là-bas). */
/* ── À propos / FAQ ── */
/* Contenu de départ = le texte actuel de apropos.html. data/apropos.json
   n'existe pas tant qu'on n'a pas enregistré une première fois ici ;
   il est alors créé avec ce contenu (modifié). */
const DEFAULT_APROPOS = {
  chaine: {
    title: 'La chaîne',
    paragraphs: [
      "Bienvenue dans mon univers : ici on fait du multigaming, du jeu coop, on rage, on rigole et on troll les copains. Installe-toi et viens dire des bêtises avec nous.",
      "Pas de planning de jeu figé — le choix se fait à l'ambiance du soir, entre amis.",
    ],
  },
  twitch: {
    title: 'Sur Twitch',
    intro: 'Quelques commandes utiles dans le tchat :',
    commands: [
      { cmd: '!commandes', desc: 'la liste complète' },
      { cmd: '!gameinfos', desc: 'infos sur le jeu en cours' },
      { cmd: '!discord', desc: 'le lien du serveur' },
      { cmd: '!wishliststeam', desc: 'la wishlist Steam' },
      { cmd: '!regles', desc: 'le règlement du chat' },
    ],
  },
  faq: [
    { q: 'Comment participer aux streams ou échanger avec la communauté ?', a: "Le plus simple est de rejoindre le [Discord](https://discord.com/invite/Amgaz5YNVg) : c'est là que ça se passe en dehors des lives. Le [planning](planning.html) donne les prochaines dates prévues." },
    { q: 'Y a-t-il des règles à respecter dans le chat ?', a: 'Oui — tape `!regles` dans le tchat Twitch pendant un live pour afficher le règlement complet du salon.' },
    { q: 'Peut-on proposer un jeu à faire en live ?', a: "Passe par le Discord pour proposer une idée : selon l'ambiance et le planning, ça peut atterrir au programme d'un prochain stream." },
    { q: 'Quel matériel utilises-tu pour streamer ?', a: "Le setup est amené à évoluer — rien d'exceptionnel, l'essentiel reste surtout de passer un bon moment ensemble." },
  ],
};

function normalizeApropos(d) {
  const def = JSON.parse(JSON.stringify(DEFAULT_APROPOS));
  if (!d || typeof d !== 'object' || Array.isArray(d)) return def;
  const str = (v, f) => (typeof v === 'string' ? v : f);
  const arr = (v, f) => (Array.isArray(v) ? v : f);
  return {
    chaine: {
      title: str(d.chaine && d.chaine.title, def.chaine.title),
      paragraphs: arr(d.chaine && d.chaine.paragraphs, def.chaine.paragraphs).map((p) => String(p)),
    },
    twitch: {
      title: str(d.twitch && d.twitch.title, def.twitch.title),
      intro: str(d.twitch && d.twitch.intro, def.twitch.intro),
      commands: arr(d.twitch && d.twitch.commands, def.twitch.commands).map((c) => ({ cmd: str(c && c.cmd, ''), desc: str(c && c.desc, '') })),
    },
    faq: arr(d.faq, def.faq).map((f) => ({ q: str(f && f.q, ''), a: str(f && f.a, '') })),
  };
}

let aproposState = { data: normalizeApropos(null), sha: null };

function apList(name) {
  const d = aproposState.data;
  return name === 'paragraphs' ? d.chaine.paragraphs : name === 'commands' ? d.twitch.commands : d.faq;
}

function renderApropos() {
  const d = aproposState.data;
  const btns = (list, i, last, label) => `
    <div class="ap-btns">
      <button type="button" data-act="up" data-list="${list}" data-i="${i}" ${i === 0 ? 'disabled' : ''} title="Monter">▲</button>
      <button type="button" data-act="down" data-list="${list}" data-i="${i}" ${i === last ? 'disabled' : ''} title="Descendre">▼</button>
      <button type="button" class="danger" data-act="del" data-list="${list}" data-i="${i}" title="Supprimer ${label}">✕</button>
    </div>`;

  const paragraphs = d.chaine.paragraphs.map((p, i) => `
    <div class="ap-row">
      <div class="ap-fields"><div class="field"><label>Paragraphe ${i + 1}</label><textarea data-list="paragraphs" data-i="${i}" rows="3">${escapeHtml(p)}</textarea></div></div>
      ${btns('paragraphs', i, d.chaine.paragraphs.length - 1, 'ce paragraphe')}
    </div>`).join('') || '<div class="ap-empty">Aucun paragraphe.</div>';

  const commands = d.twitch.commands.map((c, i) => `
    <div class="ap-row">
      <div class="ap-fields">
        <div class="field"><label>Commande</label><input type="text" data-list="commands" data-field="cmd" data-i="${i}" value="${escapeHtml(c.cmd)}"></div>
        <div class="field"><label>Description</label><input type="text" data-list="commands" data-field="desc" data-i="${i}" value="${escapeHtml(c.desc)}"></div>
      </div>
      ${btns('commands', i, d.twitch.commands.length - 1, 'cette commande')}
    </div>`).join('') || '<div class="ap-empty">Aucune commande.</div>';

  const faq = d.faq.map((f, i) => `
    <div class="ap-row">
      <div class="ap-fields">
        <div class="field"><label>Question ${i + 1}</label><input type="text" data-list="faq" data-field="q" data-i="${i}" value="${escapeHtml(f.q)}"></div>
        <div class="field"><label>Réponse</label><textarea data-list="faq" data-field="a" data-i="${i}" rows="3">${escapeHtml(f.a)}</textarea></div>
      </div>
      ${btns('faq', i, d.faq.length - 1, 'cette question')}
    </div>`).join('') || '<div class="ap-empty">Aucune question — la section FAQ est masquée sur le site.</div>';

  document.getElementById('aproposEditor').innerHTML = `
    <div class="ap-section">
      <h2>Carte « La chaîne »</h2>
      <div class="field" style="margin-bottom:16px;"><label>Titre</label><input type="text" data-path="chaine.title" value="${escapeHtml(d.chaine.title)}"></div>
      ${paragraphs}
      <button type="button" class="ap-add" data-act="add" data-list="paragraphs">+ Ajouter un paragraphe</button>
    </div>
    <div class="ap-section">
      <h2>Carte « Sur Twitch »</h2>
      <div class="field" style="margin-bottom:12px;"><label>Titre</label><input type="text" data-path="twitch.title" value="${escapeHtml(d.twitch.title)}"></div>
      <div class="field" style="margin-bottom:16px;"><label>Phrase d'introduction</label><input type="text" data-path="twitch.intro" value="${escapeHtml(d.twitch.intro)}"></div>
      ${commands}
      <button type="button" class="ap-add" data-act="add" data-list="commands">+ Ajouter une commande</button>
    </div>
    <div class="ap-section">
      <h2>Questions fréquentes</h2>
      ${faq}
      <button type="button" class="ap-add" data-act="add" data-list="faq">+ Ajouter une question</button>
    </div>`;
}

(function wireApropos() {
  const editor = document.getElementById('aproposEditor');
  // frappe : met à jour l'état sans redessiner (garde le curseur)
  editor.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.path) {
      const [section, key] = el.dataset.path.split('.');
      aproposState.data[section][key] = el.value;
    } else if (el.dataset.list) {
      const list = apList(el.dataset.list);
      const i = Number(el.dataset.i);
      if (el.dataset.list === 'paragraphs') list[i] = el.value;
      else list[i][el.dataset.field] = el.value;
    }
  });
  // boutons : ajouter / supprimer / déplacer (redessine)
  editor.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const list = apList(btn.dataset.list);
    const i = Number(btn.dataset.i);
    const act = btn.dataset.act;
    if (act === 'add') {
      list.push(btn.dataset.list === 'paragraphs' ? '' : btn.dataset.list === 'commands' ? { cmd: '', desc: '' } : { q: '', a: '' });
    } else if (act === 'del') {
      list.splice(i, 1);
    } else if (act === 'up' && i > 0) {
      [list[i - 1], list[i]] = [list[i], list[i - 1]];
    } else if (act === 'down' && i < list.length - 1) {
      [list[i + 1], list[i]] = [list[i], list[i + 1]];
    }
    renderApropos();
    if (act === 'add') {
      const fields = editor.querySelectorAll(`[data-list="${btn.dataset.list}"]`);
      const last = fields[fields.length - (btn.dataset.list === 'paragraphs' ? 1 : 2)];
      if (last) last.focus();
    }
  });
})();

async function saveApropos() {
  const d = aproposState.data;
  const clean = {
    chaine: { title: d.chaine.title.trim(), paragraphs: d.chaine.paragraphs.map((p) => p.trim()).filter(Boolean) },
    twitch: {
      title: d.twitch.title.trim(),
      intro: d.twitch.intro.trim(),
      commands: d.twitch.commands.map((c) => ({ cmd: c.cmd.trim(), desc: c.desc.trim() })).filter((c) => c.cmd),
    },
    faq: d.faq.map((f) => ({ q: f.q.trim(), a: f.a.trim() })).filter((f) => f.q),
  };
  showStatus('Enregistrement...', 'pending');
  try {
    const result = await writeJsonFile('data/apropos.json', clean, aproposState.sha, 'Mise à jour page À propos / FAQ');
    aproposState = { data: clean, sha: result.content.sha };
    renderApropos();
    showStatus('Page À propos enregistrée.', 'ok');
  } catch (e) {
    showStatus('Échec : ' + e.message, 'err');
  }
}
document.getElementById('saveAproposBtn').addEventListener('click', saveApropos);
