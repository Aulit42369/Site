# Documentation technique

- Documents produit et techniques (28/10) : `PRD.md`, `TRD.md`, `APP_FLOW.md`, `DESIGN_BRIEF.md`, `BACKEND_SCHEMA.md`, `IMPLEMENTATION_PLAN.md`.

- `bridge-live-dispatch.js` — module à brancher sur ton bridge pour que le bandeau « En direct » réagisse en ~1 minute au lieu de 10 (voir l'en-tête du fichier pour l'installation). Ce dossier n'est pas utilisé par le site : il n'y a rien à faire tant que tu ne l'intègres pas.

## Garde-fous automatiques (GitHub Actions)

| Workflow | Quand | Ce qu'il fait |
|---|---|---|
| Qualité | à chaque push touchant pages / data / scripts | valide `data/*.json`, vérifie la parité site ↔ admin, la cohérence des menus et les liens |
| Tests (navigateur) | à chaque push touchant pages / JS / tests | lance `tests/run-all.js` (admin + pages publiques) sur une copie temporaire |
| Plan du site | quand `data/custom-pages.json` change | régénère `sitemap.xml` |
| Minification | quand `style.css`, `main.js`, `admin.js`, `admin/` ou `js/` change | régénère les `.min` et les `?v=` |

## Ajouter une page au site

1. Ajoute-la dans `CORE_PAGES` (`main.js`), crée le fichier `.html` avec des `data-edit` sur ses textes.
2. `node scripts/sync-nav.js` (menus) puis `node scripts/generate-sitemap.js`.
3. Ajoute-la dans `TEXT_PAGES` (`admin/textes.js`) — sinon `scripts/check-admin-parity.js` échoue (c'est voulu).

Une page créée depuis l'admin (onglet « Pages ») n'a rien de tout ça à faire.

## Lancer les tests en local

```
cd tests && npm install && npx playwright install chromium && node run-all.js
```

## Sécurité de l'admin (23/10)

- **Jeton GitHub** (`admin/commun.js`, `getToken` / `setToken` / `expireRememberedToken`) : gardé par défaut en `sessionStorage` (oublié à la fermeture de l'onglet, invisible des autres onglets du site). Case « Se souvenir de moi sur cet appareil » → `localStorage` + drapeau `aulit_admin_token_remember`, **7 jours maximum** (effacé à l'ouverture de l'admin au-delà). Un ancien jeton laissé en `localStorage` sans ce drapeau est déplacé en `sessionStorage` au chargement.
- **Piège** : l'origine `aulit42369.github.io` est partagée par toutes les pages publiques (et tous les dépôts Pages du compte). Tout script qu'elles chargent peut lire le `localStorage` — et le `sessionStorage` de l'onglet admin, car l'aperçu de l'onglet Textes ouvre une page publique en iframe de même origine.
- **GoatCounter** : chargé en version figée `count.v4.js` avec `integrity` (SRI) + `crossorigin="anonymous"` sur les 12 pages publiques. Si GoatCounter sort une nouvelle version, ne PAS remettre `count.js` : recalculer le hash (`curl -s https://gc.zgo.at/count.vX.js | openssl dgst -sha384 -binary | openssl base64 -A`) et le mettre partout. Vérifié par `tests/admin-token.test.js`.
- **Brouillons et annonces programmées ne sont pas secrets** (piège) : le site est statique et le dépôt public. Une page décochée « Publiée » reste entière dans `data/custom-pages.json`, une annonce désactivée ou programmée reste dans `data/site.json` (et tout reste dans l'historique git). Le filtre `published !== false` / `announcementActive` (`main.js`) ne fait que masquer l'affichage. L'admin le dit désormais (texte de l'onglet Pages, case « Publiée », confirmation d'enregistrement, état du bandeau). Vérifié par `tests/admin-features.test.js`. Pour un vrai brouillon privé, il faudrait le garder hors du dépôt (voir la question ouverte du 23/10).
