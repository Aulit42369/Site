# Documentation technique

- `bridge-live-dispatch.js` — module à brancher sur ton bridge pour que le bandeau « En direct » réagisse en ~1 minute au lieu de 10 (voir l'en-tête du fichier pour l'installation). Ce dossier n'est pas utilisé par le site : il n'y a rien à faire tant que tu ne l'intègres pas.

## Garde-fous automatiques (GitHub Actions)

| Workflow | Quand | Ce qu'il fait |
|---|---|---|
| Qualité | à chaque push touchant pages / data / scripts | valide `data/*.json`, vérifie la parité site ↔ admin, la cohérence des menus et les liens |
| Tests (navigateur) | à chaque push touchant pages / JS / tests | lance `tests/run-all.js` (admin + pages publiques) sur une copie temporaire |
| Plan du site | quand `data/custom-pages.json` change | régénère `sitemap.xml` |
| Minification | quand `style.css`, `main.js` ou `admin.js` change | régénère les `.min` et les `?v=` |

## Ajouter une page au site

1. Ajoute-la dans `CORE_PAGES` (`main.js`), crée le fichier `.html` avec des `data-edit` sur ses textes.
2. `node scripts/sync-nav.js` (menus) puis `node scripts/generate-sitemap.js`.
3. Ajoute-la dans `TEXT_PAGES` (`admin.js`) — sinon `scripts/check-admin-parity.js` échoue (c'est voulu).

Une page créée depuis l'admin (onglet « Pages ») n'a rien de tout ça à faire.

## Lancer les tests en local

```
cd tests && npm install && npx playwright install chromium && node run-all.js
```
