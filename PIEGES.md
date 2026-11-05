
- **05/11/2026** : `node --test tests/*.test.js` lancé depuis la racine modifie et supprime des fichiers de `data/` (apropos, pages, site, planning-exceptions, clips) et 12 tests échouent déjà sans aucune modif. Après un essai : `git checkout -- data` avant tout commit.

- **Données de l'admin sur le serveur (05/11/2026)** : `data/streamers|clips|planning|planning-exceptions|apropos|pages|custom-pages|games|site.json` ne se modifient plus dans ce dépôt (ni à la main, ni par l'agence, ni par Claude) : le serveur fait foi (`/srv/site-data`, API `/Site/admin-api/` avec session ou clé de l'agence) et le workflow `donnees-serveur.yml` écrase ici toute modification. Les autres fichiers de `data/` (twitch-status, recent-games, broken-links…) restent écrits par leurs workflows.
