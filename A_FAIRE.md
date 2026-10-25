# À faire — Site AULIT42369

## Fait
- 25/10 — Checklist « 20 points avant lancement » : pages Confidentialité et cookies + CGU (éditables dans l'admin), liens légaux + bouton « Cookies » dans tous les pieds de page, consentement avant chargement des lecteurs Twitch, twitter:card partout, méta des mentions légales, 404 fonctionnelle à toute profondeur (`<base href="/Site/">`), contraste des jours de repos du planning, formulaire de contact (longueurs, messages FR, erreur en ligne, anti-spam délai 3 s), captures de tests retirées du dépôt public, test `lancement.test.js`.

## En cours
- (rien)

## À faire
- Créer le dépôt racine `aulit42369.github.io` seulement si on veut un vrai `robots.txt` lu par les moteurs (sinon rien à faire : `noindex` suffit).
- Relire les textes des pages Confidentialité / CGU (onglet « Textes des pages » de l'admin) et ajuster si besoin.

## Décisions prises
- Pages légales en `noindex` et hors sitemap, comme les mentions légales existantes.
- Pas de bandeau sur les pages sans lecteur Twitch : seul le lecteur dépose des cookies ; le choix reste modifiable partout via « Cookies » dans le pied de page.
- Analytics : GoatCounter déjà en place (sans cookie) → aucun nouvel outil.
