# Reprise à la main — Site Aulit42369

Doc pratique pour qui reprend le code sans contexte. Complète `ARCHITECTURE.md`, `PRD.md`, `TRD.md`.

## 1. Sources vs fichiers générés (NE PAS éditer les générés)

| On édite (source) | Généré automatiquement | Par |
|---|---|---|
| `style.css` | `style.min.css` + le `?v=` dans tous les `.html` | `scripts/update-asset-versions.js` |
| `main.js` | `main.min.js` + `?v=` | idem |
| `admin.js` | (minifié) + `?v=` | idem |
| `admin/*.js` (un module par onglet) | (minifiés) + `?v=` | idem |

**Build** : `node scripts/update-asset-versions.js` (minifie CSS/JS avec CleanCSS + terser, recalcule les hash `?v=`, met à jour les 16 pages). Lancé aussi par la GitHub Action `.github/workflows/asset-versioning.yml` à chaque push touchant ces sources, et par le serveur OVH (`services/site-construire`). **Règle : modifier la source, pas le `.min`.**

## 2. Où vit chaque contenu (données)

Tout le contenu éditable est dans `data/*.json`, écrit par l'admin (`admin.html` + `admin/*.js`) via l'API `Site/admin-api/*` (service `site-admin`, port 4660 côté OVH) qui commit sur GitHub. Lecture côté public par `main.js` (`loadJson`).

| Fichier | Contenu | Onglet admin |
|---|---|---|
| `streamers.json` | fiches streamers (page Streamers) | Streamers |
| `clips.json` | clips `{slug, title}` ; le **1er** s'affiche sur l'accueil | Clips |
| `planning.json` + `planning-exceptions.json` | jours/horaires ; sert aussi au « Prochain live » de l'accueil | Planning |
| `apropos.json` | page À propos | À propos |
| `pages.json` | **tous les petits textes** (clé `data-edit`) : `texts` + `extraProjects` | Textes des pages |
| `custom-pages.json` | pages personnalisées | Pages |
| `games.json` | jeux mobiles | Jeux |
| `site.json` | réseaux, lien Discord global, annonce | Liens & annonce |
| `twitch-status.json` | statut live + jeu + abonnés (écrit par l'Action `twitch-status.yml`) | — (auto) |

## 3. Accueil (`index.html`) — design « Synthwave Broadcast »

Mise en page reprise de la maquette validée. CSS **inline scopé `.sw-home`** (n'affecte que l'accueil) ; l'habillage broadcast partagé (cartes anguleuses, titres) est dans `style.css` (bloc en fin de fichier) et vaut pour toutes les pages.

Blocs et leur alimentation (tout est dans `main.js`, chaque bloc commenté) :
- **Ticker** (`#tickerTrack`) : reconstruit depuis `#tickerSource` (texte éditable `data-edit="index.ticker"`, messages séparés par `|`), dupliqué pour un défilement sans couture.
- **Hero** : `#liveBanner` (livebug, passe en direct via `data/twitch-status.json`), titre chromé `.sw-title`, soleil + grille dans `.sw-horizon` (le soleil est AU-DESSUS de la grille ; le conteneur clippe l'horizon, pas le hero → le halo du titre n'est pas coupé). Moniteur Twitch = iframe `data-consent-src` (chargée après accord cookies).
- **Scoreboard** (`.sw-score`) — **automatique** : `#sStatut` (En direct / Hors ligne) et `#sJeu` (jeu en cours) depuis `twitch-status.json` ; `#followerCount` (abonnés) idem ; `#nextLive` = prochain jour `on:true` du planning, formaté « Mer 21:00 ».
- **Carte « Clips marquants »** (`#latestClip`) : titre du 1er clip de `clips.json`.
- **Cartes « famille »** : liens vers les autres pages, titres/sous-titres éditables (`data-edit="index.fam1t"`…`fam5s"`).

**Champs éditables de l'accueil** : attribut `data-edit="index.…"` (sur-titre, accroche, boutons, cartes « La chaîne », bloc Discord, ticker, famille). Édités via l'admin → onglet **Textes des pages** (enregistrés dans `pages.json`).

## 4. Admin (`admin.html` + `admin/*.js`)

Onglets : Streamers, Clips, Planning, À propos, Textes des pages, Pages, Jeux, Liens & annonce, Santé, Historique, **Aide**. Chaque onglet = un panel `#<nom>Panel` + un module `admin/<nom>.js`. L'onglet actif est géré par `admin.js` (liste `TAB_NAMES`). **Historique** = restauration de n'importe quelle version (chaque enregistrement est une sauvegarde GitHub). **Aide** = guide utilisateur intégré (où/quoi/comment).

## 5. Pièges (voir aussi `PIEGES.md`)
- Toujours modifier la **source** (`style.css`, `main.js`, `admin*.js`) puis laisser le build régénérer les `.min` et `?v=`.
- En cas de conflit sur les `?v=` au push (l'Action a régénéré en parallèle) : résoudre, puis **relancer le build** pour des hash cohérents avant de repousser.
- Le `.min` et les `?v=` sont des artefacts : ne jamais les éditer à la main.
