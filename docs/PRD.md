# Site Aulit42369 — PRD (besoin produit)

Rédigé le 28/10/2026 à partir du code (`main.js`, `admin.js`, pages HTML) et des docs (`ARCHITECTURE.md`, `A_FAIRE.md`, `docs/README.md`).

## 1. Besoin
Aulit42369, streamer Twitch francophone multigaming, a besoin d'un site vitrine qui :
- présente la chaîne et donne envie de venir en live (statut « en direct », planning, clips) ;
- regroupe ses projets (jeux mobiles, Escape Fragments, outils de stream « Coulisses ») ;
- offre un kit média aux marques (`partenaires.html`) et un formulaire de contact ;
- se met à jour **sans toucher au code**, depuis une page d'administration.

## 2. Utilisateurs
| Qui | Accès | Ce qu'il fait |
|---|---|---|
| Visiteurs (viewers, curieux) | Pages publiques | Découvrent la chaîne, le planning, les clips, les streamers recommandés, les jeux |
| Marques, partenaires | `partenaires.html`, `contact.html` | Lisent le kit média, écrivent |
| Olivier (admin) | `admin.html` + jeton GitHub | Édite données, textes, pages, annonce ; surveille la santé du site |
| Agence Aulit (outil local d'Olivier) | API GitHub (`GITHUB_TOKEN_SITE`) | Pose des changements ponctuels du planning |

## 3. Fonctions
- **Pages publiques** (`CORE_PAGES` de `main.js`) : Accueil, Planning, Clips, Streamers, Jeux, Coulisses, À propos, Escape Fragments, Partenaires, Contact ; pages légales (mentions légales, confidentialité et cookies, CGU) ; pages personnalisées (`page.html?p=…`) ; 404.
- **Commun à toutes les pages** : menu, bandeau « En direct » (statut relevé toutes les 10 min), annonce programmable, textes éditables (`data-edit`), consentement avant tout lecteur Twitch, bouton « Cookies », retour en haut, statistiques GoatCounter sans cookie.
- **Admin** : onglets Streamers, Clips, Planning, À propos, Textes des pages, Pages, Jeux, Liens & annonce, Santé du site, Historique.
- **Automatismes** (GitHub Actions) : statut Twitch, jeux récents, liens cassés, journal de direct (relevé toutes les 5 min en live), sitemap, minification, contrôles qualité, tests.

## 4. Hors périmètre
- Pas de compte visiteur, pas de commentaires, pas de boutique, pas de tarifs sur le kit média.
- Pas de serveur à soi : GitHub Pages + GitHub Actions + services tiers (Formspree, GoatCounter, Render pour Escape Fragments).
- Brouillons et annonces programmées **non secrets** (dépôt public).
- `robots.txt` lu par les moteurs : impossible sans dépôt racine `aulit42369.github.io` (non créé ; `noindex` des pages fait foi).

## 5. Indicateurs
GoatCounter (visites), Lighthouse (workflow), bilans mensuels du journal de direct (heures de live, spectateurs moyens, pic, catégories : chiffres du kit média encore « À venir »). Objectifs à 6 mois (fin avril 2027), cibles modestes : garder au moins 5 sessions de live bilantées dans le journal de direct par mois ; remplacer les 3 chiffres « À venir » du kit média par les vrais bilans ; atteindre 300 visites GoatCounter par mois ; Lighthouse ≥ 90 en accessibilité et en bonnes pratiques sur toutes les pages. Appui : petite chaîne francophone, outils de mesure déjà en place sur le site. (proposé par Claude le 29/10/2026, à corriger si besoin)
