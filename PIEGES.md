
- **05/11/2026** (corrigé le 14/11) : `node --test tests/*.test.js` lancé depuis la racine modifiait et supprimait des fichiers de `data/` (les tests prenaient le vrai dépôt quand `TEST_ROOT` manquait). Depuis le 14/11, `tests/lib.js` refuse de tourner sans la copie temporaire de `run-all.js` (« [garde-fou des tests] », test `garde-donnees.test.js`). Seule commande : `cd tests && node run-all.js`. Si `data/` a quand même bougé : `git checkout -- data`.

- **Données de l'admin sur le serveur (05/11/2026)** : `data/streamers|clips|planning|planning-exceptions|apropos|pages|custom-pages|games|site.json` ne se modifient plus dans ce dépôt (ni à la main, ni par l'agence, ni par Claude) : le serveur fait foi (`/srv/site-data`, API `/Site/admin-api/` avec session ou clé de l'agence) et le workflow `donnees-serveur.yml` écrase ici toute modification. Les autres fichiers de `data/` (twitch-status, recent-games, broken-links…) restent écrits par leurs workflows.

- **Sauts de page (CLS, 17/11)** : tout bloc rempli par JS après lecture de `data/*.json` doit avoir sa place réservée (hauteur mini tant qu'il est vide, ou texte de secours de la même longueur) ; ne jamais masquer en `display:none` un bouton qui apparaîtra ensuite (Escape : boutons visibles avec l'adresse par défaut). Nouvelle police de titre : lui donner aussi la police de secours `Saira secours` / `Plex Sans secours` (fonts.css), sinon la page saute au chargement. Mesure : `tests/perf-41-47.test.js` (données retardées de 700 ms).
- **Flou au téléphone (17/11)** : aucun `backdrop-filter` sous 760 px ni sur écran tactile (bloc de fin de `style.css`, `!important`). Un nouveau panneau en verre y devient opaque s'il utilise `var(--verre)` ; sinon lui donner un fond opaque dans ce bloc.

- **18/11/2026 : course avec la construction automatique du serveur.** Le serveur recalcule `style.min.css`, `main.min.js` et les
  `?v=` à chaque construction (toutes les quelques minutes, avec le statut Twitch), et ses hachages diffèrent de ceux calculés
  sur le PC (fins de ligne). Conséquences vues : conflits sur les `?v=` à chaque `git pull`, et un `git pull --rebase` (mode
  fork-point, après un `git stash`) qui a ÉCARTÉ le commit local (récupéré par `git cherry-pick` depuis le reflog). Le push part
  vers 2 adresses (serveur puis GitHub) : l'une peut accepter et l'autre refuser.
  À faire : ne pas lancer `update-asset-versions.js` avant un push (le serveur le fait) ; récupérer avec
  `git fetch origin && git rebase --no-fork-point origin/main` ; sur un conflit de `?v=`, prendre la version du serveur ;
  si GitHub refuse, `git fetch https://github.com/Aulit42369/Site.git main` puis fusion (jamais de force).
