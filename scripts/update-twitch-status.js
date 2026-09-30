/* ================================================================
   Récupère avatar + statut live pour ta chaîne et tous les
   streamers listés dans data/streamers.json, via l'API Twitch
   officielle (pas decapi.me). Récupère aussi ton nombre d'abonnés
   et le jeu en cours quand tu es live. Écrit le résultat dans
   data/twitch-status.json, que le site lit ensuite directement,
   sans appel réseau tiers.

   Tient aussi à jour data/recent-games.json : un petit historique
   des derniers jeux joués (les 8 plus récents, sans doublon
   consécutif), affiché sur la page À propos.

   Lancé par .github/workflows/twitch-status.yml toutes les 10 min.
   ================================================================ */
const fs = require('fs');
const path = require('path');

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

const STREAMERS_JSON_PATH = path.join(__dirname, '..', 'data', 'streamers.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'twitch-status.json');
const RECENT_GAMES_PATH = path.join(__dirname, '..', 'data', 'recent-games.json');
const BROKEN_LINKS_PATH = path.join(__dirname, '..', 'data', 'broken-links.json');
const MAX_RECENT_GAMES = 8;
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

/* Récupère l'URL de la jaquette (box art) d'un jeu par son id, dans
   un format d'image raisonnable (144x192). Renvoie null en silence
   en cas de souci — la jaquette est un bonus visuel, jamais bloquant. */
async function fetchBoxArt(gameId, headers) {
  try {
    const res = await fetch(`https://api.twitch.tv/helix/games?id=${encodeURIComponent(gameId)}`, { headers });
    if (!res.ok) return null;
    const body = await res.json();
    const game = body.data && body.data[0];
    if (!game || !game.box_art_url) return null;
    return game.box_art_url.replace('{width}', '144').replace('{height}', '192');
  } catch {
    return null;
  }
}

async function fetchTwitchData(usernames, token) {
  const headers = { 'Client-ID': CLIENT_ID, Authorization: `Bearer ${token}` };

  const userQuery = usernames.map((u) => `login=${encodeURIComponent(u)}`).join('&');
  const usersRes = await fetch(`https://api.twitch.tv/helix/users?${userQuery}`, { headers });
  if (!usersRes.ok) throw new Error('Echec /users : ' + usersRes.status);
  const usersData = await usersRes.json();

  /* Pseudos qui ne correspondent plus à aucun compte Twitch existant
     (chaîne supprimée ou renommée depuis son ajout à streamers.json) —
     Twitch omet simplement ces pseudos de la réponse, sans erreur.
     Utile pour repérer un lien mort à corriger dans l'admin. Ta propre
     chaîne est exclue : si elle ne répond pas, c'est un souci d'API,
     pas un lien à corriger. */
  const foundLogins = new Set(usersData.data.map((u) => u.login.toLowerCase()));
  const brokenUsernames = usernames.filter((u) => u !== OWN_CHANNEL && !foundLogins.has(u));

  const streamQuery = usernames.map((u) => `user_login=${encodeURIComponent(u)}`).join('&');
  const streamsRes = await fetch(`https://api.twitch.tv/helix/streams?${streamQuery}`, { headers });
  if (!streamsRes.ok) throw new Error('Echec /streams : ' + streamsRes.status);
  const streamsData = await streamsRes.json();

  /* Map pseudo -> { jeu, id du jeu }, pour les chaînes actuellement
     live (déjà fourni par /streams, aucun appel en plus). L'id sert
     ensuite à retrouver la jaquette du jeu, pour ta seule chaîne. */
  const liveInfo = new Map(
    streamsData.data.map((s) => [s.user_login.toLowerCase(), { game: s.game_name, gameId: s.game_id }])
  );

  const result = {};
  for (const user of usersData.data) {
    const login = user.login.toLowerCase();
    const info = liveInfo.get(login);
    const isLive = !!info;
    result[login] = {
      avatar: user.profile_image_url,
      live: isLive,
    };
    if (isLive && info.game) result[login].game = info.game;
  }

  /* Jaquette du jeu en cours : uniquement pour ta chaîne (comme pour
     les abonnés). L'id du jeu vient déjà de /streams, un seul appel
     en plus vers /games pour récupérer l'image. */
  const ownLiveInfo = liveInfo.get(OWN_CHANNEL);
  if (ownLiveInfo && ownLiveInfo.gameId && result[OWN_CHANNEL]) {
    const boxArt = await fetchBoxArt(ownLiveInfo.gameId, headers);
    if (boxArt) result[OWN_CHANNEL].gameArt = boxArt;
  }

  /* Nombre d'abonnés : uniquement pour ta propre chaîne (pas pour les
     streamers recommandés). L'endpoint "Get Channel Followers" renvoie
     le total sans avoir besoin d'un scope particulier tant qu'on ne
     demande pas la liste nominative des abonnés (ça, ça demanderait un
     jeton utilisateur avec moderator:read:followers) — un jeton
     d'application (Client Credentials, celui déjà utilisé ici) suffit
     pour juste le total. */
  const ownUser = usersData.data.find((u) => u.login.toLowerCase() === OWN_CHANNEL);
  if (ownUser) {
    try {
      const followersRes = await fetch(
        `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${ownUser.id}`,
        { headers }
      );
      if (followersRes.ok) {
        const followersData = await followersRes.json();
        if (result[OWN_CHANNEL] && typeof followersData.total === 'number') {
          result[OWN_CHANNEL].followers = followersData.total;
        }
      } else {
        console.error('Echec /channels/followers : ' + followersRes.status);
      }
    } catch (err) {
      console.error('Echec /channels/followers :', err.message);
    }
  }

  return { result, brokenUsernames };
}

/* Ajoute `currentGame` en tête de data/recent-games.json s'il diffère
   du dernier jeu enregistré (évite de ré-écrire la même entrée à
   chaque passage de 10 min pendant un même stream). Garde uniquement
   les MAX_RECENT_GAMES plus récents. */
function updateRecentGames(currentGame, gameArt) {
  if (!currentGame) return;

  let history = [];
  try {
    history = JSON.parse(fs.readFileSync(RECENT_GAMES_PATH, 'utf-8'));
    if (!Array.isArray(history)) history = [];
  } catch {
    history = [];
  }

  if (history.length > 0 && history[0].game === currentGame) return;

  const entry = { game: currentGame, date: new Date().toISOString().slice(0, 10) };
  if (gameArt) entry.art = gameArt;
  history.unshift(entry);
  history = history.slice(0, MAX_RECENT_GAMES);

  fs.mkdirSync(path.dirname(RECENT_GAMES_PATH), { recursive: true });
  fs.writeFileSync(RECENT_GAMES_PATH, JSON.stringify(history, null, 2));
  console.log('Nouveau jeu enregistré dans l\'historique :', currentGame);
}

async function main() {
  const usernames = extractUsernames();
  console.log('Pseudos trouvés :', usernames.join(', '));

  const token = await getAccessToken();
  const { result: data, brokenUsernames } = await fetchTwitchData(usernames, token);
  data._updated_at = new Date().toISOString();

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
  console.log('Ecrit dans', OUTPUT_PATH, '—', usernames.length, 'chaînes.');

  fs.writeFileSync(BROKEN_LINKS_PATH, JSON.stringify(brokenUsernames, null, 2));
  if (brokenUsernames.length) {
    console.warn('Pseudos introuvables sur Twitch (lien à vérifier) :', brokenUsernames.join(', '));
  }

  const ownStatus = data[OWN_CHANNEL];
  if (ownStatus && ownStatus.live && ownStatus.game) {
    updateRecentGames(ownStatus.game, ownStatus.gameArt);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
