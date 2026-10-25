# Mises à jour de la Régie mobile

Ce dossier est rempli par la Régie d'Olivier (page `/kit` → « Publier une mise à jour ») :

- `version.json` : la dernière version, ses notes, l'empreinte sha256 du zip et la signature Ed25519 d'Olivier ;
- `regie-maj-<version>.zip` : la mise à jour elle-même (sans aucun fichier personnel).

Les régies distribuées lisent `https://aulit42369.github.io/Site/regie/version.json` une fois par jour et n'installent rien sans signature valide ni sans un appui de la personne. Ne pas modifier ces fichiers à la main : la signature ne correspondrait plus et la mise à jour serait ignorée.

Ce n'est pas une page du site : rien à ajouter à `admin.html` ni au sitemap.
