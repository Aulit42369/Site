
- **05/11/2026** : `node --test tests/*.test.js` lancé depuis la racine modifie et supprime des fichiers de `data/` (apropos, pages, site, planning-exceptions, clips) et 12 tests échouent déjà sans aucune modif. Après un essai : `git checkout -- data` avant tout commit.
