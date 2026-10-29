# Architecture — Site AULIT42369

Site statique GitHub Pages : https://aulit42369.github.io/Site/ (site de **projet**, sous `/Site/`).
Documentation technique détaillée : `docs/README.md`.

## 1. Modules
| Fichier | Rôle |
|---|---|
| `*.html` (16 pages) | Une page = un fichier. Pages légales : `mentions-legales.html`, `confidentialite.html`, `cgu.html` (noindex, hors sitemap). `page.html` = gabarit des pages créées dans l'admin. `404.html` = page d'erreur (`<base href="/Site/">`). |
| `main.js` → `main.min.js` | Script partagé : menu, bandeau direct, textes éditables, annonce, **consentement aux lecteurs Twitch**, retour en haut. |
| `style.css` → `style.min.css` | Feuille partagée (tokens couleur, pied de page, pages légales, bandeau de consentement). |
| `js/<page>.js` | Script propre à une page (anciens scripts inline, sortis le 29/10 pour la CSP). Chargé juste après `main.min.js`. |
| `admin.html` / `admin.js` + `admin/*.js` | Administration (jeton GitHub, écrit dans `data/`). noindex + `Disallow` robots. Découpée le 29/10 : `admin/commun.js` (jeton, API GitHub, statut, état, `Collection`) puis un fichier par onglet (`streamers`, `clips`, `planning`, `apropos`, `site`, `textes`, `sante`, `historique`, `pages`, `jeux`), et `admin.js` en **dernier** (Ctrl+S, sauvegarde, onglets, connexion, `init()`). Scripts classiques : les fonctions/constantes de haut niveau sont partagées ; l'ordre des `<script>` dans `admin.html` compte. |
| `scripts/` | Vérifications CI (données, parité admin, menus, liens), sitemap, minification. |
| `tests/` | Tests Playwright (`node tests/run-all.js`) sur une copie temporaire. |

## 2. Sources de vérité uniques
- Liste des pages : `CORE_PAGES` (`main.js`) → menus (`sync-nav.js`), sitemap, parité admin.
- Textes éditables : HTML par défaut (`data-edit`) + surcharges `data/pages.json` ; pages listées dans `TEXT_PAGES` (`admin.js`).
- Styles : `style.css` uniquement (les styles des pages légales y ont été regroupés le 25/10).
- `.min` et `?v=` : générés par `scripts/update-asset-versions.js` (CI), ne pas éditer à la main. Couvre aussi `admin/*.js` et `js/*.js` (un hash par fichier).
- `sitemap.xml` : `lastmod` = date du dernier commit git de chaque page (repli : date du fichier). Régénéré par la CI (`sitemap.yml`, checkout complet) à chaque push qui touche une page HTML ou `data/custom-pages.json`.

## 3. Persistance
- Données du site : `data/*.json` (jamais touché à la main ni par les outils hors admin/CI).
- Navigateur du visiteur (stockage local, aucun cookie) : `aulit_consent_tiers` + `aulit_consent_date` (choix Twitch, redemandé après 6 mois), `skipgc` (opposition à GoatCounter, bouton de la page Confidentialité), `custom-nav` (menu), `announce-closed` (sessionStorage). Admin : jeton GitHub (sessionStorage par défaut ; « Se souvenir de moi » = localStorage **7 jours max**, effacé à l'ouverture de l'admin si `aulit_admin_token_at` est dépassé ou absent).

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
- Nouvelle iframe tierce : toujours `data-consent-src` (+ `applyConsent(élément)` si créée en JS), jamais `src` direct.
- `coulisses.html` : `features.test.js` attend exactement 11 blocs projet ; un bloc ajouté dans le HTML demande de mettre ce test à jour (les projets ajoutés dans l'admin, `extraProjects`, ne comptent pas).
- Nouvelle page : `CORE_PAGES` + `TEXT_PAGES` + pied de page avec les 4 liens légaux + la balise CSP (copier celle d'`index.html`) + son script dans `js/<page>.js` (jamais inline).
- Admin : nouvelle fonction appelée **au chargement** (hors clic) depuis un autre fichier = ce fichier doit être chargé avant dans `admin.html`. `check-admin-parity.js` lit `admin.js` + `admin/*.js` et compare `DEFAULT_GAMES` de `js/jeux.js` et `admin/jeux.js`.

- **Fichier `google9ad7f8bd44912903.html` (25/10)** : validation Google Search Console (propriété + sitemap envoyé). Site : fichier non nécessaire (propriété déjà validée avant), mais même règle pour tout fichier google*.html. Ne jamais le supprimer ni le renommer, sinon la propriété perd sa validation.
