# DESIGN_BRIEF — Identité visuelle commune « Néon Broadcast / Synthwave »

Charte unique pour harmoniser tous les portails & outils d'Aulit42369
(Site, La Cabane, Étagère, pages AulitBot, Lugh, CRA). Les 4 jeux gardent
leur univers propre mais reçoivent des **clins d'œil de famille** (même
typo d'UI, même duo d'accents).

> **Règle d'or : re-skin, jamais reconstruction.** On change la couche
> visuelle (couleurs, typos, forme des composants, mise en page). On ne
> touche JAMAIS à la logique, aux données, aux routes ni aux
> fonctionnalités. Chaque site est **vérifié** (il marche encore) avant
> publication.

---

## 1. Direction

Fond nuit + duo néon **cyan + magenta** (froid), accent chaud **ambre/or**
(complément), structure **broadcast esport** (titres condensés, panneaux
anguleux, HUD, barres de stats) et touche **Y2K / synthwave** (titre
chromé, soleil rétro + grille horizon sur les vitrines).

Deux intensités :
- **Vitrines** (Site, pages publiques) → version **riche** : titre chromé,
  grille/soleil, ticker, scoreboard, glow.
- **Outils** (Cabane, Lugh, Étagère, admin bot, CRA) → version **sobre** :
  mêmes couleurs/typos/panneaux, mais **sans** soleil/grille/ticker/chrome,
  glow minimal, boutons plats. Un outil doit être reposant à l'usage.

## 2. Couleurs (jetons)

| Jeton | Hex | Rôle |
|---|---|---|
| `--bg` | `#070a10` → `#0a0912` | fond nuit (bleu-noir, jamais noir pur) |
| `--surface` / `--surface2` | `#0d1220` / `#080c18` | panneaux |
| `--line` | `#1a2540` | filets / bordures |
| `--cyan` | `#00f5ff` (Site) / `#2ee6e0` (maquettes) | **accent principal** |
| `--magenta` | `#ff2d78` | **accent secondaire (duo)** |
| `--violet` | `#9b5cff` | pont du dégradé, dominante de La Cabane |
| `--amber` | `#ffb24e` | **accent chaud** (coucher de soleil), en touches |
| `--white` / `--muted` | `#e8eaf6` / `#8892a8` | texte / texte atténué |

**Couleur dominante par outil** (chacun garde son identité dans la famille) :
Site = cyan · La Cabane = violet · Étagère = cyan · AulitBot = magenta ·
Lugh = cyan · CRA = violet.

Semantic (bon/attention/critique) séparé des accents : `--ok #53e39b`, etc.

## 3. Typographies (auto-hébergées, OFL, `font-src 'self'`)

- **Saira Condensed** — titres, nav, chiffres, étiquettes HUD (display condensé).
- **IBM Plex Sans** — texte courant.
- **IBM Plex Mono** — données / étiquettes techniques.

Fichiers woff2 dans `fonts/` (via @fontsource). **Astuce de bascule** : on
ré-aliase les anciens noms de police au niveau de `fonts.css`
(`@font-face{font-family:'Orbitron';src:saira…}` et `'Rajdhani':IBM Plex`)
→ toutes les pages basculent sans toucher à leur HTML. Voir `fonts.css`.

## 4. Composants

- **Panneau anguleux** : `clip-path` à coin biseauté + crochets d'angle
  (`::before/::after` bord cyan), éventuel liseré haut en dégradé.
- **Boutons** : primaire plein cyan (glossy sur vitrines), secondaire
  contour cyan→magenta au survol ; coins coupés.
- **Étiquette HUD** : `// texte` en IBM Plex Mono, repère magenta.
- **Scoreboard** (vitrines) : cellules en parallélogramme, gros chiffres
  Saira italiques, liseré cyan/magenta.
- **Ticker** (vitrines) : bandeau défilant + pastille « À l'antenne ».
- **Titre chromé** (vitrines) : dégradé `#fff→cyan→violet→magenta` en
  `background-clip:text`.
- **Soleil + grille horizon** (vitrines) : soleil à lamelles posé **au-dessus**
  d'une grille en perspective. ⚠️ Placement à caler **en prod** dans une
  bande d'horizon dédiée (pas de bande = soleil retiré, cf. accueil).

## 5. Méthode d'application par site

1. Reskin via **thème** (jetons CSS) → les pages héritent. Mobilier spécifique
   (soleil/grille/chrome) en **CSS inline scopé** à la page concernée.
2. Polices : remplacer `fonts.css` par la version aliasée.
3. Vérifier **chaque** page (rendu + console) en local avant publication.
4. Publier (`git push`), vérifier en ligne.
5. Ne jamais perdre une fonctionnalité ; au moindre doute, on garde l'existant.

## 6. Accessibilité (rappel règle 13)

Contrastes lisibles, `:focus-visible` visible, `prefers-reduced-motion`
respecté (ticker/animations coupés), alt sur les images, structure de titres,
`lang`, pas de police tierce.

## 7. État d'avancement

- **Site** : polices basculées + accueil habillé (titre chromé + grille). ✅ en ligne.
- À faire : La Cabane, Étagère, pages AulitBot, Lugh, CRA (version sobre),
  puis caler le soleil des vitrines et, en option, unifier via vrais jetons
  `--f-display/--f-body/--f-mono` + nav/boutons condensés partout.
