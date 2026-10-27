# Architecture — Site AULIT42369

Site statique GitHub Pages : https://aulit42369.github.io/Site/ (site de **projet**, sous `/Site/`).
Documentation technique détaillée : `docs/README.md`.

## 1. Modules
| Fichier | Rôle |
|---|---|
| `*.html` (16 pages) | Une page = un fichier. Pages légales : `mentions-legales.html`, `confidentialite.html`, `cgu.html` (noindex, hors sitemap). `page.html` = gabarit des pages créées dans l'admin. `404.html` = page d'erreur (`<base href="/Site/">`). |
| `main.js` → `main.min.js` | Script partagé : menu, bandeau direct, textes éditables, annonce, **consentement aux lecteurs Twitch**, retour en haut. |
| `style.css` → `style.min.css` | Feuille partagée (tokens couleur, pied de page, pages légales, bandeau de consentement). |
| `admin.html` / `admin.js` | Administration (jeton GitHub, écrit dans `data/`). noindex + `Disallow` robots. |
| `scripts/` | Vérifications CI (données, parité admin, menus, liens), sitemap, minification. |
| `tests/` | Tests Playwright (`node tests/run-all.js`) sur une copie temporaire. |

## 2. Sources de vérité uniques
- Liste des pages : `CORE_PAGES` (`main.js`) → menus (`sync-nav.js`), sitemap, parité admin.
- Textes éditables : HTML par défaut (`data-edit`) + surcharges `data/pages.json` ; pages listées dans `TEXT_PAGES` (`admin.js`).
- Styles : `style.css` uniquement (les styles des pages légales y ont été regroupés le 25/10).
- `.min` et `?v=` : générés par `scripts/update-asset-versions.js` (CI), ne pas éditer à la main.

## 3. Persistance
- Données du site : `data/*.json` (jamais touché à la main ni par les outils hors admin/CI).
- Navigateur du visiteur (stockage local, aucun cookie) : `aulit_consent_tiers` + `aulit_consent_date` (choix Twitch, redemandé après 6 mois), `skipgc` (opposition à GoatCounter, bouton de la page Confidentialité), `custom-nav` (menu), `announce-closed` (sessionStorage). Admin : jeton GitHub (sessionStorage par défaut).

- Journal de direct : branche `journal-direct` (fichiers `journal/AAAA-MM.jsonl`, une ligne JSON par relevé de 5 min en live), écrite par `journal-direct.yml`. Public comme le reste du dépôt (données déjà visibles sur Twitch).

## 4. Sécurité
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
`tests/*.test.js` (11 suites). `lancement.test.js` couvre : consentement (rien de Twitch avant accord, refus mémorisé, bouton « Cookies »), liens légaux sur toutes les pages, absence de défilement horizontal à 360 px, formulaire (messages FR, anti-spam).

## 8. Risques connus
- Fichiers locaux en CRLF (Windows) : `sync-nav.js --check` échoue en local mais passe en CI (LF). Ne pas lancer `sync-nav.js` sans `--check` en local.
- Ne pas lancer les tests depuis la racine du dépôt : ils y déposent des captures (désormais ignorées par `.gitignore`).
- Nouvelle iframe tierce : toujours `data-consent-src` (+ `applyConsent(élément)` si créée en JS), jamais `src` direct.
- `coulisses.html` : `features.test.js` attend exactement 11 blocs projet ; un bloc ajouté dans le HTML demande de mettre ce test à jour (les projets ajoutés dans l'admin, `extraProjects`, ne comptent pas).
- Nouvelle page : `CORE_PAGES` + `TEXT_PAGES` + pied de page avec les 4 liens légaux.

- **Fichier `google9ad7f8bd44912903.html` (25/10)** : validation Google Search Console (propriété + sitemap envoyé). Site : fichier non nécessaire (propriété déjà validée avant), mais même règle pour tout fichier google*.html. Ne jamais le supprimer ni le renommer, sinon la propriété perd sa validation.
