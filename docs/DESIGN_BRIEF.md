# Site Aulit42369 — brief de design (identité réelle)

Relevé le 28/10/2026 dans `style.css` (`:root`, « tokens de la charte graphique ») et `fonts.css`. Charte source : `F:\Stream\files\pour publication` : version de référence = fichier `aulit42369_charte_graphique.html` daté du 30/07/2026 (proposé par Claude le 29/10/2026, à corriger si besoin).

## 1. Ambiance
Cyber / néon sur fond quasi noir bleuté, fond quadrillé discret, halos lumineux cyan et violet. Ton direct, joueur et tutoyant : « Viens rigoler en direct ! », jeux coop entre potes.

## 2. Couleurs
| Jeton | Valeur | Usage |
|---|---|---|
| `--bg` | `#070a10` | fond |
| `--surface` / `--surface2` | `#0d1220` / `#080c18` | blocs, cartes |
| `--line` | `#1a2540` | bordures |
| `--white` | `#e8eaf6` | texte |
| `--muted` / `--dim` | `#8892a8` / `#75849e` | texte secondaire |
| `--cyan` | `#00f5ff` | couleur principale, halo `--glow-c` |
| `--violet` | `#9b5cff` | couleur secondaire, halo `--glow-v` |
| `--magenta` | `#ff2d78` | accent (direct, alertes) |

Halos : `0 0 8px` + `0 0 24px` à 35 % d'opacité. Largeur de contenu `--max: 1180px`. Thème sombre uniquement.

## 3. Typographie
- **Orbitron** 700 et 900 (hébergée) : titres, logo, chiffres.
- **Rajdhani** 400 à 700 (hébergée) : texte courant 17 px, interligne 1,6, graisse 500.

## 4. Composants
Menu commun, bandeau « En direct », annonce, cartes de streamers / jeux / clips, cases du planning (jour actif, repos, badge « Changement »), bandeau de consentement, pied de page avec liens légaux et « Cookies », bouton de retour en haut. Images de partage dans `og/` et `og-image.*`, icône `favicon.svg`, `apple-touch-icon.png`, dossier `icons/`.

## 5. Règles
- Toute couleur passe par les jetons de `style.css` (une seule feuille, les styles des pages légales y sont regroupés).
- Contraste vérifié (jours de repos du planning corrigés le 25/10) ; pas de défilement horizontal à 360 px (testé).
- Aspect distinct de La Cabane (violet nuit + rose/cyan) : les deux identités ne se mélangent pas.
