/* Textes éditables depuis admin.html (onglet "À propos") : data/apropos.json.
   Le HTML ci-dessus sert de contenu de secours tant que le fichier
   n'existe pas ou est invalide. */
loadJson('data/apropos.json', null)
  .then(d => {
    if (!d || typeof d !== 'object' || Array.isArray(d)) return;
    const $ = id => document.getElementById(id);
    const isStr = v => typeof v === 'string';
    const c = d.chaine, t = d.twitch;
    if (c && isStr(c.title)) $('aboutTitle').textContent = c.title;
    if (c && Array.isArray(c.paragraphs)) {
      $('aboutParagraphs').innerHTML = c.paragraphs.filter(isStr).filter(p => p.trim())
        .map((p, i) => `<p${i ? ' style="margin-top:14px;"' : ''}>${renderRichText(p)}</p>`).join('');
    }
    if (t && isStr(t.title)) $('twitchTitle').textContent = t.title;
    if (t && isStr(t.intro)) {
      $('twitchIntro').textContent = t.intro;
      $('twitchIntro').style.display = t.intro.trim() ? '' : 'none';
    }
    if (t && Array.isArray(t.commands)) {
      $('twitchCommands').innerHTML = t.commands.filter(x => x && isStr(x.cmd) && x.cmd.trim())
        .map(x => `<li><code>${escapeHtml(x.cmd)}</code>${isStr(x.desc) && x.desc.trim() ? ' — ' + renderRichText(x.desc) : ''}</li>`).join('');
    }
    if (Array.isArray(d.faq)) {
      const items = d.faq.filter(f => f && isStr(f.q) && f.q.trim());
      $('faqList').innerHTML = items.map(f =>
        `<details class="faq-item"><summary>${escapeHtml(f.q)}</summary><p>${renderRichText(isStr(f.a) ? f.a : '')}</p></details>`).join('');
      $('faqSection').style.display = items.length ? '' : 'none';
    }
  });
