# Site Aulit42369 — parcours page par page

Rédigé le 28/10/2026 à partir des pages HTML, de `main.js` et `admin.js`.

## A. Éléments communs (toutes les pages publiques, `main.js`)
Menu (généré depuis `CORE_PAGES`, personnalisable dans l'admin) → bandeau « En direct » si `data/twitch-status.json` est récent et `live` → annonce (`data/site.json`, dates `from`/`until`, fermable pour la session) → contenu → pied de page (Mentions légales, Confidentialité, CGU, Contact, bouton « Cookies »). Textes surchargés par `data/pages.json`.

## B. Pages publiques
| Page | Ce que voit le visiteur | Données |
|---|---|---|
| `index.html` Accueil | Présentation de la chaîne (streamer Twitch francophone multigaming), statut live, abonnés, raccourcis vers les autres pages, Discord | `twitch-status.json`, `site.json`, `pages.json` |
| `planning.html` | Semaine type (7 cases, jeu, horaires « À partir de… », note) ; un changement ponctuel des 7 prochains jours remplace la case de son jour (badge « Changement ») | `planning.json`, `planning-exceptions.json` |
| `clips.html` | Liste des clips ; lecteur Twitch après accord, sinon remplaçant + « Regarder sur Twitch » | `clips.json` |
| `streamers.html` | Streamers recommandés, avatar, statut live | `streamers.json`, `twitch-status.json` |
| `jeux.html` | Jeux mobiles (jouable / bientôt), liens de jeu | `games.json` |
| `coulisses.html` | Projets et outils de stream (11 blocs + projets ajoutés dans l'admin) | `pages.json` (`extraProjects`) |
| `apropos.html` | Présentation, FAQ, commandes Twitch, derniers jeux joués | `apropos.json`, `recent-games.json` |
| `escape-fragments.html` | Présentation du jeu et classement (serveur Render) | `site.json` (`escapeServerUrl`) |
| `partenaires.html` | Kit média : présentation, 4 chiffres (« À venir » tant que vides), 4 formats, contact | textes `partenaires.*` |
| `contact.html` | Formulaire Formspree (messages FR, anti-spam) ; en cas d'erreur, renvoi vers Discord | — |
| `mentions-legales.html`, `confidentialite.html`, `cgu.html` | Textes légaux (noindex) ; Confidentialité : bouton d'opposition à GoatCounter | `pages.json` |
| `page.html?p=<slug>` | Page créée dans l'admin (blocs titre, texte, liste, bouton, image) | `custom-pages.json` |
| `404.html` | Page introuvable, fonctionne à toute profondeur (`<base href="/Site/">`) | — |

## C. Consentement Twitch
Première rencontre d'un lecteur Twitch → bandeau Accepter / Refuser → accord : les `iframe` reçoivent leur `src` ; refus : remplaçant + lien. Choix gardé 6 mois, modifiable via « Cookies ».

## D. Administration (`admin.html`, noindex)
1. Écran d'accès : saisie du jeton GitHub (case « Se souvenir de moi sur cet appareil »).
2. Onglets : **Streamers**, **Clips**, **Planning** (semaine type + changements ponctuels), **À propos**, **Textes des pages** (aperçu de la page en cadre), **Pages** (pages personnalisées, case « Publiée »), **Jeux**, **Liens & annonce** (réseaux, Discord, annonce, serveur Escape), **Santé du site** (statut Twitch, liens cassés, jeux récents, automatisations), **Historique** (commits).
3. Enregistrer → écriture du fichier `data/*.json` par l'API GitHub → la CI valide les données → GitHub Pages republie (1 à 2 min).
