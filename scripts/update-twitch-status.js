/* ================================================================
   Récupère avatar + statut live pour ta chaîne et tous les
   streamers listés dans data/streamers.json, via l'API Twitch
   officielle (pas decapi.me). Écrit le résultat dans
   data/twitch-status.json, que le site lit ensuite directement,
   sans appel réseau tiers.

   Lancé par .github/workflows/twitch-status.yml toutes les 10 min.
   ================================================================ */
const fs = require('fs');
const path = require('path');

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

const STREAMERS_JSON_PATH = path.join(__dirname, '..', 'data', 'streamers.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'twitch-status.json');
const OWN_CHANNEL = 'aulit42369';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET manquants (secrets du dépôt).');
  process.exit(1);
}

/* Lit data/streamers.json (la liste gérée par admin.html) et en
   extrait les pseudos Twitch depuis le champ `url` de chaque entrée.
   Rien à maintenir en double : la liste vient de ce que le panneau
   admin a déjà enregistré. Si le fichier n'existe pas encore (premier
   lancement, avant tout ajout), on continue avec juste ta chaîne. */
function extractUsernames() {
  const usernames = new Set([OWN_CHANNEL]);
  let streamers = [];
  try {
    streamers = JSON.parse(fs.readFileSync(STREAMERS_JSON_PATH, 'utf-8'));
  } catch {
    return [...usernames];
  }
  for (const s of streamers) {
    try {
      const username = new URL(s.url).pathname.split('/').filter(Boolean).pop();
      if (username) usernames.add(username.toLowerCase());
    } catch {
      // URL absente ou mal formée sur cette entrée : ignorée, le reste continue
    }
  }
  return [...usernames];
}

async function getAccessToken() {
  const url = `https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error('Echec obtention token Twitch : ' + res.status);
  const data = await res.json();
  return data.access_token;
}

async function fetchTwitchData(usernames, token) {
  const headers = { 'Client-ID': CLIENT_ID, Authorization: `Bearer ${token}` };

  const userQuery = usernames.map((u) => `login=${encodeURIComponent(u)}`).join('&');
  const usersRes = await fetch(`https://api.twitch.tv/helix/users?${userQuery}`, { headers });
  if (!usersRes.ok) throw new Error('Echec /users : ' + usersRes.status);
  const usersData = await usersRes.json();

  const streamQuery = usernames.map((u) => `user_login=${encodeURIComponent(u)}`).join('&');
  const streamsRes = await fetch(`https://api.twitch.tv/helix/streams?${streamQuery}`, { headers });
  if (!streamsRes.ok) throw new Error('Echec /streams : ' + streamsRes.status);
  const streamsData = await streamsRes.json();

  const liveSet = new Set(streamsData.data.map((s) => s.user_login.toLowerCase()));

  const result = {};
  for (const user of usersData.data) {
    const login = user.login.toLowerCase();
    result[login] = {
      avatar: user.profile_image_url,
      live: liveSet.has(login),
    };
  }
  return result;
}

async function main() {
  const usernames = extractUsernames();
  console.log('Pseudos trouvés :', usernames.join(', '));

  const token = await getAccessToken();
  const data = await fetchTwitchData(usernames, token);
  data._updated_at = new Date().toISOString();

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
  console.log('Ecrit dans', OUTPUT_PATH, '—', usernames.length, 'chaînes.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
