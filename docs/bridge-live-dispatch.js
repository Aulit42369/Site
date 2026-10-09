/* ================================================================
   Statut « En direct » quasi instantané — module pour TON bridge.

   Principe : quand ton bridge reçoit l'évènement Twitch « stream.online »
   ou « stream.offline » (EventSub, ou le chat/IRC si c'est ce que tu
   utilises), il demande à GitHub de relancer tout de suite le workflow
   « twitch-status.yml » au lieu d'attendre le prochain passage
   (toutes les 10 min). Le bandeau du site passe alors en direct en
   ~1 minute (le temps que le workflow tourne).

   Installation (Node 18+, aucune dépendance) :
     1. Sur GitHub, crée UN NOUVEAU jeton fine-grained, séparé de celui
        de l'admin : dépôt « Site » uniquement, permission
        « Actions : Read and write » et RIEN d'autre.
        (Si ce jeton fuite, il ne peut que relancer ce workflow.)
     2. Mets-le dans la variable d'environnement GITHUB_DISPATCH_TOKEN
        de ton bridge (jamais dans le code ni dans le dépôt).
     3. Dans ton bridge :

          const { onStreamEvent } = require('./bridge-live-dispatch');
          // … quand tu reçois stream.online ou stream.offline :
          onStreamEvent('online');   // ou 'offline'

   Garde-fous intégrés : une seule demande par minute (les rafales
   d'évènements sont regroupées), 3 essais en cas d'erreur réseau, et
   aucune exception ne remonte jusqu'à ton bridge (il ne plante jamais
   à cause de ça).
   ================================================================ */
const OWNER = process.env.SITE_REPO_OWNER || 'aulit42369';
const REPO = process.env.SITE_REPO_NAME || 'Site';
const WORKFLOW = 'twitch-status.yml';
const BRANCH = process.env.SITE_REPO_BRANCH || 'main';
const MIN_GAP_MS = 60 * 1000;

let lastSent = 0;
let timer = null;
let pending = null;

async function dispatchOnce() {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) throw new Error('GITHUB_DISPATCH_TOKEN manquant');
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: BRANCH }),
  });
  if (res.status !== 204) throw new Error(`GitHub a répondu ${res.status}`);
}

async function send(reason) {
  lastSent = Date.now();
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await dispatchOnce();
      console.log(`[live-dispatch] workflow relancé (${reason})`);
      return true;
    } catch (e) {
      console.warn(`[live-dispatch] essai ${attempt}/3 échoué : ${e.message}`);
      if (/manquant|401|403|404/.test(e.message)) return false; // inutile de réessayer
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  return false;
}

/* À appeler à chaque évènement de stream. Ne lève jamais d'exception. */
function onStreamEvent(kind) {
  pending = kind === 'offline' ? 'offline' : 'online';
  if (timer) return; // une demande est déjà programmée : elle portera le dernier état
  const wait = Math.max(0, lastSent + MIN_GAP_MS - Date.now());
  timer = setTimeout(() => {
    timer = null;
    send(pending).catch(() => {});
  }, wait);
}

module.exports = { onStreamEvent };
