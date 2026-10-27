# Site Aulit42369 — TRD (exigences techniques)

Rédigé le 28/10/2026. Référence détaillée : `ARCHITECTURE.md` et `docs/README.md`.

## 1. Pile
| Partie | Technique |
|---|---|
| Pages | HTML statique, un fichier par page, sans framework ni build côté visiteur |
| Script et style partagés | `main.js` → `main.min.js`, `style.css` → `style.min.css` (minifiés et versionnés `?v=` par la CI, `scripts/update-asset-versions.js`) |
| Admin | `admin.html` + `admin.js` : écrit dans `data/*.json` par l'API GitHub (jeton personnel) |
| Scripts CI | Node 20 (`scripts/`) : validation des données, parité admin, menus, liens, sitemap, statut Twitch, journal de direct |
| Tests | Playwright (`cd tests && node run-all.js`, 12 suites) sur une copie temporaire |
| Polices | Orbitron et Rajdhani hébergées (`fonts/`, `fonts.css`) |

## 2. Hébergement
- GitHub Pages, site **de projet** : `https://aulit42369.github.io/Site/` (branche `main`).
- Pas de dépôt racine `aulit42369.github.io` : le `robots.txt` du dossier `/Site/` n'est pas lu par les moteurs. Ne rien créer sans décision d'Olivier.
- Journal de direct sur la branche `journal-direct` (pas de republication du site).
- Services : Formspree (contact), GoatCounter (`aulit42369.goatcounter.com`), serveur Escape Fragments sur Render, API Twitch (via Actions uniquement).

## 3. Contraintes
- Nouvelle page : `CORE_PAGES` (`main.js`) + `TEXT_PAGES` (`admin.js`) + pied de page avec les 4 liens légaux, puis `sync-nav.js` et `generate-sitemap.js` (`check-admin-parity.js` échoue sinon).
- Ne jamais éditer les `.min` ni les `?v=` à la main.
- `data/` : écrit seulement par l'admin et la CI ; jamais à la main.
- Windows : `sync-nav.js --check` échoue en local (CRLF) mais passe en CI ; ne pas lancer `sync-nav.js` sans `--check` en local ; lancer les tests depuis `tests/`.
- `coulisses.html` : `features.test.js` attend exactement 11 blocs projet.
- `google9ad7f8bd44912903.html` : ne jamais supprimer.

## 4. Sécurité
- Aucun secret dans le dépôt (vérifié le 25/10, historique compris) ; secrets Twitch dans les secrets GitHub Actions.
- Jeton de l'admin en `sessionStorage` par défaut (« Se souvenir de moi » → `localStorage`). Piège : l'origine `aulit42369.github.io` est partagée par toutes les pages publiques.
- XSS : ~51 `innerHTML` relus le 27/10 ; échappement des données, liens et avatars limités à http(s).
- GoatCounter en version figée `count.v4.js` + SRI (`integrity`, `crossorigin`).
- Formspree protégé par le champ piège `_gotcha` et un délai minimal de 3 s.
- Admin et pages légales en `noindex` ; admin en `Disallow`.

## 5. Vie privée
Aucun cookie déposé par le site. Lecteurs Twitch (qui déposent des cookies) chargés **après accord** (`data-consent-src`) ; choix redemandé après 6 mois. Opposition à GoatCounter (`skipgc`) depuis la page Confidentialité.

## 6. Qualité
Workflows : Qualité (données, parité, menus, liens), Tests (Playwright), Plan du site, Minification, Liens, Lighthouse, Statut Twitch, Journal de direct.
