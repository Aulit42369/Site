/* Journal de direct : une ligne par passage (titre, catégorie, spectateurs)
   quand la chaîne est en live. Sert aux bilans mensuels (pics, catégories),
   que l'API Twitch ne permet pas de reconstituer après coup.
   Écrit dans <dossier>/AAAA-MM.jsonl (jamais dans data/). Lancé toutes les
   5 min par .github/workflows/journal-direct.yml, qui range le dossier sur
   la branche `journal-direct`. Secrets : ceux du dépôt, rien n'est lu en local. */
const fs = require('fs');
const path = require('path');

const CHAINE = 'aulit42369';

// Une ligne du journal, ou null si la chaîne n'est pas en live.
function releve(stream, maintenant = new Date()) {
  if (!stream) return null;
  return {
    t: maintenant.toISOString(),
    titre: stream.title || '',
    jeu: stream.game_name || '',
    spectateurs: Number(stream.viewer_count) || 0,
  };
}

// Mois civil à Paris (les bilans sont mensuels, pas en UTC).
function fichierDuMois(dossier, maintenant = new Date()) {
  const mois = maintenant.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }).slice(0, 7);
  return path.join(dossier, mois + '.jsonl');
}

async function main() {
  const { TWITCH_CLIENT_ID: id, TWITCH_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) throw new Error('TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET manquants (secrets du dépôt).');
  const dossier = process.argv[2];
  if (!dossier) throw new Error('Usage : node scripts/journal-direct.js <dossier>');

  const tok = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`, { method: 'POST' });
  if (!tok.ok) throw new Error('Echec token Twitch : ' + tok.status);
  const { access_token } = await tok.json();

  const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${CHAINE}`, {
    headers: { 'Client-ID': id, Authorization: `Bearer ${access_token}` },
  });
  if (!res.ok) throw new Error('Echec /streams : ' + res.status);
  const ligne = releve((await res.json()).data[0]);
  if (!ligne) return console.log('Hors ligne : rien à écrire.');

  fs.mkdirSync(dossier, { recursive: true });
  fs.appendFileSync(fichierDuMois(dossier), JSON.stringify(ligne) + '\n');
  console.log('Relevé :', ligne.spectateurs, 'spectateurs,', ligne.jeu);
}

module.exports = { releve, fichierDuMois };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
