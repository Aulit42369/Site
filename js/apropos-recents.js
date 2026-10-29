/* "Récemment sur la chaîne" — lit data/recent-games.json, tenu à
   jour par la même GitHub Action que le reste (rien à gérer à la
   main). Reste simplement caché si le fichier n'existe pas encore
   ou est vide. */
loadJson('data/recent-games.json', [])
  .then(games => {
    if (!Array.isArray(games) || games.length === 0) return;
    const list = document.getElementById('recentGamesList');
    /* un jeu n'apparaît qu'une fois (le plus récent d'abord), même si
       le fichier contient des doublons */
    const seen = new Set();
    games.filter(g => {
      const k = g && typeof g.game === 'string' ? g.game.trim().toLowerCase() : '';
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    }).forEach(g => {
      const tag = document.createElement('span');
      tag.className = 'game-tag';
      if (g.art) {
        const art = document.createElement('img');
        art.className = 'game-tag-art';
        art.alt = '';
        art.src = g.art;
        tag.appendChild(art);
      }
      tag.appendChild(document.createTextNode(g.game));
      list.appendChild(tag);
    });
    document.getElementById('recentGames').style.display = 'block';
  });
