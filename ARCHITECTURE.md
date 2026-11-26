# Architecture — Site AULIT42369

> **Hébergement (05/11/2026)** : Source du code : serveur `ssh://ubuntu@148.113.156.76/srv/git/Site.git` (remote `origin` ; chaque `git push` part aussi en copie sur GitHub tant qu'il existe). Le serveur construit et publie tout seul (`site-construire` : minification + `?v=`, plan du site, statut Twitch toutes les 10 min, journal de direct) : les workflows GitHub qui écrivaient sont désactivés. Ne plus compter sur GitHub Actions.

Site statique GitHub Pages : https://aulit42369.github.io/Site/ (site de **projet**, sous `/Site/`).
Documentation technique détaillée : `docs/README.md`.

## 1. Modules
| Fichier | Rôle |
|---|---|
| `*.html` (16 pages) | Une page = un fichier. Pages légales : `mentions-legales.html`, `confidentialite.html`, `cgu.html` (noindex, hors sitemap). `page.html` = gabarit des pages créées dans l'admin. `404.html` = page d'erreur (`<base href="/Site/">`). |
| `main.js` → `main.min.js` | Script partagé : menu, bandeau direct, textes éditables, annonce, **consentement aux lecteurs Twitch**, retour en haut. Depuis le 17/11 : met en pause (classe `.anim-pause`) les animations en boucle dont l'élément est hors de l'écran (IntersectionObserver). |
| `style.css` → `style.min.css` | Feuille partagée (tokens couleur, pied de page, pages légales, bandeau de consentement). Micro-interactions (11/11) : courbes `--out/--in/--spring`, menu, gélatine, focus, `.rv`… ; celles de l'accueil sont dans le `<style>` d'`index.html`, celles du planning dans `planning.html` + `js/planning.js`. Mouvement réduit : bloc `prefers-reduced-motion` de `style.css`. Fin de fichier (17/11) : places réservées pendant le chargement des données (CLS) et bloc « téléphone » `(max-width: 760px), (pointer: coarse)` sans aucun `backdrop-filter` (plaques opaques via `--verre`). |
| `js/<page>.js` | Script propre à une page (anciens scripts inline, sortis le 29/10 pour la CSP). Chargé juste après `main.min.js`. Depuis le 16/11 : `js/accueil-vivant.js` (accueil : dernier live / prochain live avec compte à rebours, ou live en cours ; corrige aussi la case « Prochain live » du tableau de score, qui ignore la semaine sur 2) et `js/clips-recherche.js` (Clips : recherche, pastilles par jeu déduit du titre, clip au hasard). |
| Idée 42 (18/11) | `js/jours-feries.js` : `window.ferieDe(date)` / `window.feriesDu(depuis, jours)`, jours fériés calculés (aucun appel tiers, rien à mettre à jour). Utilisé par `js/planning.js` (étiquettes « Jour férié · … ») et par l'admin (`admin/planning.js`, rappel `#feriesAlerte` à 14 jours). Chargé par `planning.html` et `admin.html`. |
| Audit 43-46 (18/11) | `js/accueil-vivant.js` exporte `window.prochainLive` / `window.dureeLive` : **seul calcul du prochain live** (accueil + `planning.html`, qui charge ce fichier avant `js/planning.js`). Tableau de score de l'accueil (`#score`, cases `#cStatut` en live seulement, `#cDernier`, `#cProchain`). `js/clips.js` : vignette + lecteur créé au clic (jamais d'iframe au chargement, accord demandé dans la carte). `scripts/miniatures-clips.js` (serveur) → `img/clips/<id>.jpg` + `img/clips/miniatures.json` lu par `js/clips.js` (sans entrée : vignette dessinée). Système commun : bloc « Système commun 18/11 » en fin de `style.css` (jetons `--t-*`, `--r-*`, `--contenu`, `--gouttiere`, `.lien-action`, `.etiquette`, `.porteur`). |
| `admin.html` / `admin.js` + `admin/*.js` | Administration : depuis le 05/11/2026, mot de passe vérifié par le serveur (service `site-admin`, dépôt `serveur-aulit/site-admin`, API `/Site/admin-api/`) ; les 9 fichiers qu'elle modifie (streamers, clips, planning, planning-exceptions, apropos, pages, custom-pages, games, site) vivent dans `/srv/site-data` sur le serveur (dépôt git local = historique), Caddy les sert à `/Site/data/`. Le workflow `donnees-serveur.yml` en recopie une version ici tous les quarts d'heure : ne jamais les modifier dans ce dépôt. noindex + `Disallow` robots. Découpée le 29/10 : `admin/commun.js` (jeton, API GitHub, statut, état, `Collection`) puis un fichier par onglet (`streamers`, `clips`, `planning`, `apropos`, `site`, `textes`, `sante`, `historique`, `pages`, `jeux`), et `admin.js` en **dernier** (Ctrl+S, sauvegarde, onglets, connexion, `init()`). Scripts classiques : les fonctions/constantes de haut niveau sont partagées ; l'ordre des `<script>` dans `admin.html` compte. |
| `scripts/` | Vérifications CI (données, parité admin, menus, liens), sitemap, minification. |
| `tests/` | Tests Playwright (`node tests/run-all.js`) sur une copie temporaire. |

## 2. Sources de vérité uniques
- Liste des pages : `CORE_PAGES` (`main.js`) → menus (`sync-nav.js`), sitemap, parité admin. Le lien Discord en fin de menu (`NAV_DISCORD`, `main.js`) est recopié tel quel par `sync-nav.js` dans le menu statique.
- Affichage des horaires et des jeux : `heureFr()` (« 21:00 » → « 21 h ») et `nomDeJeu()` (« 7D2D » → « 7 Days to Die ») dans `main.js`, utilisés par le planning et l'accueil.
- Textes éditables : HTML par défaut (`data-edit`) + surcharges `data/pages.json` ; pages listées dans `TEXT_PAGES` (`admin.js`). Les textes fixes de l'accueil vivant sont dans `<div id="vivantTextes" hidden>` d'`index.html` (clés `index.vivant.*`), lus par le script. Coulisses : un texte court par outil (`coulisses.<bloc>.court`), étapes `…etapeN.t/.d`, chiffres `…chiffreN.n/.l` ; les anciennes clés `…descN` ne servent plus.
- Styles : `style.css` uniquement (les styles des pages légales y ont été regroupés le 25/10).
- `.min` et `?v=` : générés par `scripts/update-asset-versions.js` (CI), ne pas éditer à la main. Couvre aussi `admin/*.js` et `js/*.js` (un hash par fichier).
- `sitemap.xml` : `lastmod` = date du dernier commit git de chaque page (repli : date du fichier). Régénéré par la CI (`sitemap.yml`, checkout complet) à chaque push qui touche une page HTML ou `data/custom-pages.json`.

## 3. Persistance
- Données du site : `data/*.json` (jamais touché à la main ni par les outils hors admin/CI).
- Navigateur du visiteur (stockage local, aucun cookie) : `aulit_consent_tiers` + `aulit_consent_date` (choix Twitch, redemandé après 6 mois), `skipgc` (opposition à GoatCounter, bouton de la page Confidentialité), `custom-nav` (menu), `announce-closed` (sessionStorage). Admin : aucun stockage côté navigateur (session = cookie HttpOnly `__Host-site-admin` posé par le serveur, 30 jours).

- Journal de direct : branche `journal-direct` (fichiers `journal/AAAA-MM.jsonl`, une ligne JSON par relevé de 5 min en live), écrite par `journal-direct.yml`. Public comme le reste du dépôt (données déjà visibles sur Twitch).

## 4. Sécurité
- **CSP sur toutes les pages** (balise `<meta http-equiv="Content-Security-Policy">`, même politique qu'`index.html` ; `admin.html` a la sienne, plus stricte). Aucun script inline ni `on*=` : tout script va dans un fichier (`js/`, `admin/`). Pas de hash `sha256` : les fichiers sont en CRLF en local et LF en ligne, un hash ne tiendrait pas. Contrôlé par `tests/csp.test.js` (statique + navigateur, écoute des violations).
- Aucun secret dans le dépôt (vérifié le 25/10, historique compris). Secrets Twitch uniquement dans les secrets GitHub Actions.
- Formspree (`formspree.io/f/…`) : adresse publique par nature, protégée par le champ piège `_gotcha` + délai minimal de 3 s côté page.
- Dépôt public : brouillons et annonces programmées ne sont pas secrets (voir `docs/README.md`).

## 5. Identité
- URL : `aulit42369.github.io/Site/`. Pas de dépôt racine `aulit42369.github.io` → `robots.txt` du dossier n'est **pas** lu par les moteurs (seul celui de la racine du domaine compte) ; le `noindex` des pages fait foi.
- GoatCounter : `aulit42369.goatcounter.com`, script figé `count.v4.js` + SRI.

## 6. Dépendances externes
| Service | Usage | Si coupé |
|---|---|---|
| Twitch (lecteur, clips) | iframes chargées **seulement après accord** (`data-consent-src`) | remplaçant + lien « Regarder sur Twitch » |
| GoatCounter | statistiques sans cookie | rien ne casse |
| Formspree | formulaire de contact | message d'erreur en ligne, renvoi vers Discord |
| Serveur Escape Fragments (Render) | classement | message « indisponible » |
| GitHub API (Actions) | statut Twitch toutes les 10 min | bandeau « en direct » masqué si donnée périmée |

## 7. Plan de tests
`tests/*.test.js` (13 suites, dont `csp.test.js`). `lancement.test.js` couvre : consentement (rien de Twitch avant accord, refus mémorisé, bouton « Cookies »), liens légaux sur toutes les pages, absence de défilement horizontal à 360 px, formulaire (messages FR, anti-spam).

## 8. Risques connus
- Fichiers locaux en CRLF (Windows) : `sync-nav.js --check` échoue en local mais passe en CI (LF). Ne pas lancer `sync-nav.js` sans `--check` en local.
- Ne pas lancer les tests depuis la racine du dépôt : ils y déposent des captures (désormais ignorées par `.gitignore`).
- Nouvelle page ou nouveau bloc : utiliser les jetons du système commun (`var(--t-xs…xxl)`, `var(--r-petit|carte|pilule)`, `.btn-primary` / `.btn-secondary` / `.lien-action`, `.etiquette`) ; jamais de taille en px/rem en dur hors des mini-écrans décoratifs (`role="img"` / `aria-hidden`). Une page dont le `<style>` vient après `style.min.css` l'emporte à spécificité égale : y mettre les jetons, pas des valeurs.
- Nouvelle police ou nouvelle page : garder les 2 `<link rel="preload">` de polices (Saira 800, Plex Sans 400) avant `fonts.css`, sinon le titre de 64 px change de nombre de lignes au chargement (CLS).
- Nouvelle iframe tierce : toujours `data-consent-src` (+ `applyConsent(élément)` si créée en JS), jamais `src` direct.
- `coulisses.html` : `features.test.js`, `audit-39-48.test.js` et `idees-27-28.test.js` attendent exactement 23 blocs projet (26/11/2026) ; un bloc ajouté dans le HTML demande de mettre ces tests à jour (les projets ajoutés dans l'admin, `extraProjects`, ne comptent pas).
- Menu : 8 entrées au maximum (29/10 : à 10, il débordait sur les grands écrans). Une page secondaire va en `menu: false` + lien dans `.footer-nav` du pied de page (toutes les pages).
- Nouvelle page : `CORE_PAGES` + `TEXT_PAGES` + pied de page avec les 4 liens légaux + la balise CSP (copier celle d'`index.html`) + son script dans `js/<page>.js` (jamais inline).
- Admin : nouvelle fonction appelée **au chargement** (hors clic) depuis un autre fichier = ce fichier doit être chargé avant dans `admin.html`. `check-admin-parity.js` lit `admin.js` + `admin/*.js` et compare `DEFAULT_GAMES` de `js/jeux.js` et `admin/jeux.js`.

- **Fichier `google9ad7f8bd44912903.html` (25/10)** : validation Google Search Console (propriété + sitemap envoyé). Site : fichier non nécessaire (propriété déjà validée avant), mais même règle pour tout fichier google*.html. Ne jamais le supprimer ni le renommer, sinon la propriété perd sa validation.
