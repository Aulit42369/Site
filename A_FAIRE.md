# À faire — Site AULIT42369

## Fait
- 26/10 : `coulisses.html` mise à jour (textes par défaut) : Régie Mobile (kit /kit, mises à jour signées, Raid · La Cabane, confirmations intégrées, APK ≈ 700 Ko ; schéma avec « Mises à jour · GitHub Pages » et « La Cabane »), Jeux mobiles (Défi du jour commun, partage image story, carte des autres jeux, langues 7/6/2/2, Android prêt pour Google Play), La Cabane (vitrine publique, relais Cloudflare des inscriptions, Lighthouse), Bot Discord (relais à adresse fixe, tableau de santé), Ce site (Confidentialité/CGU, consentement Twitch, données structurées, Lighthouse, Search Console). Nouvelles clés : `coulisses.p1.desc3`, `p5.desc3`, `p6.desc3`, `p9.desc3`, `p10.desc3` (découvertes automatiquement par l'admin). Lugh, TRI·RÉCUP et CRA volontairement absents (décision d'Olivier à venir).
- 25/10 : `clips.html` ajoute des données structurées `ItemList` de `VideoObject` (une par clip : titre, lien, lecteur intégré, date d'ajout). Miniature = `og/clips-og.png` faute de miniature Twitch dans `data/clips.json` : l'affichage dans l'onglet Vidéos de Google n'est pas garanti.
- 25/10 — Checklist « 20 points avant lancement » : pages Confidentialité et cookies + CGU (éditables dans l'admin), liens légaux + bouton « Cookies » dans tous les pieds de page, consentement avant chargement des lecteurs Twitch, twitter:card partout, méta des mentions légales, 404 fonctionnelle à toute profondeur (`<base href="/Site/">`), contraste des jours de repos du planning, formulaire de contact (longueurs, messages FR, erreur en ligne, anti-spam délai 3 s), captures de tests retirées du dépôt public, test `lancement.test.js`.
- 25/10 — Passe SEO éditoriale des 9 pages publiques : une requête principale par page (« streamer Twitch francophone », « planning stream », « clips Twitch », « streamers francophones à suivre », « jeux mobiles gratuits », « outils de stream sur mesure », « chaîne Twitch multigaming », « escape room Twitch », « contact ») dans `<title>` (format « … | Aulit42369 », ≤ 60 caractères), description (140-160), Open Graph et `<h1>` ; textes par défaut des accroches ajustés ; description `Person` du JSON-LD ; titre des pages créées dans l'admin au même format (`page.html`). `sitemap.xml` non touché (régénéré par la CI, sans `lastmod`).

## En cours
- (rien)

## À faire
- Créer le dépôt racine `aulit42369.github.io` seulement si on veut un vrai `robots.txt` lu par les moteurs (sinon rien à faire : `noindex` suffit).
- Relire les textes des pages Confidentialité / CGU (onglet « Textes des pages » de l'admin) et ajuster si besoin.
- Vérifier dans l'admin (onglet « Textes des pages ») qu'aucun texte enregistré n'écrase les nouveaux titres/accroches par défaut : `jeux.title`, `escape.title`, `clips.lead`, `streamers.lead`, `jeux.lead`, `escape.lead`, `contact.lead`, `coulisses.eyebrow` (le contenu de `data/` n'a pas été lu).
- Vérifier dans l'admin (onglet « Textes des pages », page Coulisses) qu'aucun texte enregistré n'écrase les nouveaux textes par défaut : `coulisses.p1.desc1`, `p1.desc2`, `p1.status`, `p1.stack`, `p9.desc2`, `p9.status`, `p5.desc2`, `p5.stack`, `p6.desc2`, `p6.stack`, `p10.desc2`. Un texte enregistré y masque la mise à jour : le vider (ou le remplacer) pour retrouver le nouveau texte. Décider si Lugh, TRI·RÉCUP ou CRA doivent apparaître dans Coulisses.

## Décisions prises
- Pages légales en `noindex` et hors sitemap, comme les mentions légales existantes.
- Pas de bandeau sur les pages sans lecteur Twitch : seul le lecteur dépose des cookies ; le choix reste modifiable partout via « Cookies » dans le pied de page.
- Analytics : GoatCounter déjà en place (sans cookie) → aucun nouvel outil.
