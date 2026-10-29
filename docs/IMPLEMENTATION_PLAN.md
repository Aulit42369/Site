# Site Aulit42369 — état et prochaines étapes

Mis à jour le 28/10/2026 à partir de `A_FAIRE.md`.

## 1. État actuel (en production)
- 10 pages publiques + 3 pages légales + pages personnalisées + 404 ; admin à 10 onglets.
- Conformité (25–26/10) : pages légales, consentement avant les lecteurs Twitch, GoatCounter sans cookie, polices hébergées, 404 à toute profondeur.
- SEO (25/10) : une requête principale par page, données structurées des clips.
- Sécurité (23–27/10) : jeton de l'admin en session, SRI GoatCounter, contrôle XSS.
- 27/10 : planning (heure de fin facultative, note, changements ponctuels dans la grille), kit média `partenaires.html`, journal de direct.
- 28/10 : six documents `docs/` (PRD, TRD, APP_FLOW, DESIGN_BRIEF, BACKEND_SCHEMA, IMPLEMENTATION_PLAN).
- Tests : `cd tests && node run-all.js` (12 suites vertes le 28/10).

## 2. Prochaines étapes (développement)
1. Premier bilan mensuel du journal de direct → chiffres du kit média (heures de live, spectateurs moyens, pic, catégories).
2. Si Olivier le décide : créer le dépôt racine `aulit42369.github.io` pour un vrai `robots.txt` (sinon rien : le `noindex` suffit).
3. Si un nouveau bloc est ajouté dans `coulisses.html` : mettre à jour `features.test.js` (11 blocs attendus).

## 3. Actions d'Olivier (dans l'admin)
- Kit média : saisir les 4 chiffres après le premier bilan ; relire les formats proposés.
- Textes des pages : supprimer les anciens textes légaux inutiles (`legal.2`, `legal.4`, `legal.13`, `legal.17`, `privacy.2`…`privacy.26`) ; relire Confidentialité / CGU.
- Vérifier qu'aucun texte enregistré n'écrase les nouveaux titres/accroches par défaut (Jeux, Escape, Clips, Streamers, Contact, Coulisses).
- Valider les horaires proposés (`docs/horaire-type-propose.md`).
- Décider si Lugh, TRI·RÉCUP ou CRA apparaissent dans Coulisses.
- Supprimer les messages du formulaire 12 mois après la réponse.

## 4. Règles de livraison
Nouvelle page ou changement de structure → aussi `admin.html` / `admin/*.js` (`TEXT_PAGES` dans `admin/textes.js`). Tests verts → commit + `git pull --rebase` + `git push` → la CI régénère `.min`, `?v=` et sitemap → vérifier en ligne.
