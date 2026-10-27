# Site Aulit42369 — données et automatismes

Rédigé le 28/10/2026 à partir de `scripts/validate-data.js`, `admin.js`, `scripts/update-twitch-status.js`, `scripts/journal-direct.js` et `.github/workflows/`. Le contenu de `data/` n'a pas été ouvert : seuls les champs décrits par le code sont listés.

## 1. Vue d'ensemble
```
admin.html (jeton GitHub) ──API GitHub──> data/*.json (branche main) ──GitHub Pages──> pages publiques (fetch des JSON)
Agence Aulit (GITHUB_TOKEN_SITE) ──────> data/planning-exceptions.json
GitHub Actions twitch-status.yml (10 min) ──Twitch Helix──> data/twitch-status.json, recent-games.json, broken-links.json
GitHub Actions journal-direct.yml (5 min) ──Twitch──> branche journal-direct : journal/AAAA-MM.jsonl
```
Pas de serveur ni de base de données : les fichiers JSON du dépôt sont la base.

## 2. Fichiers `data/` (saisis dans l'admin)
| Fichier | Forme | Champs |
|---|---|---|
| `streamers.json` (requis) | tableau | `name`, `url` (https), `description`, `avatar` |
| `clips.json` (requis) | tableau | `slug` (unique, `[A-Za-z0-9_-]`), `title`, `dateAdded` (AAAA-MM-JJ) |
| `planning.json` (requis) | tableau de 7 jours | `day`, `on` (booléen), `game`, `time` / `end` (HH:MM, fin facultative), `note` |
| `planning-exceptions.json` | tableau | `date` (AAAA-MM-JJ), `on`, `game`, `time`, `end`, `note` |
| `apropos.json` | objet | `schemaVersion`, `faq[{q, a}]`, `twitch.commands[{cmd, …}]` |
| `pages.json` | objet | `schemaVersion`, `texts{clé: texte}` (surcharges des `data-edit`), `extraProjects[{title, …}]` |
| `site.json` | objet | `schemaVersion`, `socials[{label, url}]`, `escapeServerUrl` (https), `announcement{…, linkUrl, from, until}`, lien Discord |
| `games.json` | objet | `schemaVersion`, `games[{id, name, tagline, description, tags, accent, url, playUrl, status: jouable|bientot}]` |
| `custom-pages.json` | objet | `schemaVersion`, `pages[{slug, title, published, blocks[{type: heading|text|list|button|image, …}]}]` |

Validation : `scripts/validate-data.js` (workflow Qualité) refuse tout fichier mal formé.

## 3. Fichiers `data/` écrits par les automatismes
| Fichier | Écrit par | Champs |
|---|---|---|
| `twitch-status.json` | `update-twitch-status.js` (toutes les 10 min) | `{<login>: {avatar, live, game?}}` ; pour `aulit42369` en plus `gameArt`, `followers` ; `_updated_at` (ISO) |
| `recent-games.json` | idem | 8 derniers jeux `[{game, date}]`, sans doublon |
| `broken-links.json` | idem | pseudos de `streamers.json` introuvables sur Twitch |

## 4. Hors `data/`
- **Journal de direct** : branche `journal-direct`, `journal/AAAA-MM.jsonl` (mois à Paris), une ligne `{t, titre, jeu, spectateurs}` par relevé de 5 min en live. Sert aux bilans mensuels (kit média).
- **Sitemap** : `sitemap.xml` régénéré quand `custom-pages.json` change.
- **Navigateur du visiteur** : `aulit_consent_tiers`, `aulit_consent_date`, `skipgc`, `custom-nav` (localStorage), `announce-closed` (sessionStorage). Admin : jeton (sessionStorage, ou localStorage + `aulit_admin_token_remember`).

## 5. Secrets et services
- Secrets GitHub Actions : `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` (jeton d'application, Client Credentials).
- Formspree : adresse publique `formspree.io/f/…` ; messages dans Gmail et le tableau Formspree.
- Escape Fragments : serveur Render (`escapeServerUrl`).
- Aucun relais Cloudflare pour ce site.
