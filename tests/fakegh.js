/* Faux serveur de l'admin (/Site/admin-api/, service site-admin du serveur depuis le 05/11/2026) + lecture publique de
   l'API GitHub (onglet Santé), pour tester l'admin sans réseau. Nom de fichier gardé (fakegh) pour les tests existants. */
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const MOT_DE_PASSE = 'bon-mot-de-passe';

async function installFakeGithub(page, seed = {}, { runs = [], connecte = true } = {}) {
  let n = 0;
  const files = {}, commits = {}, puts = [];
  const hooks = { forceConflict: new Set(), connecte, connexions: 0 };
  const put = (p, obj, msg, date) => {
    n++;
    const sha = 'sha' + n;
    const content = JSON.stringify(obj, null, 2);
    files[p] = { content, sha };
    (commits[p] = commits[p] || []).unshift({ id: sha.padEnd(40, '0'), sha, date: date || new Date().toISOString(), message: msg, content });
    return sha;
  };
  put('data/streamers.json', [], 'init'); put('data/clips.json', [{ slug: 'Existing', title: 'Déjà là' }], 'init');
  put('data/planning.json', [{ day: 'Lundi', on: true, time: '21:00', end: '00:00', game: 'X', color: '#00f5ff' }], 'init');
  Object.entries(seed).forEach(([p, o]) => put(p, o, 'seed'));
  await page.route('**/Site/admin-api/**', async (route) => {
    const req = route.request();
    const rel = new URL(req.url()).pathname.split('/Site/admin-api/')[1];
    const json = (o, s = 200) => route.fulfill({ status: s, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
    if (rel === 'session') return json({ connecte: hooks.connecte });
    if (req.method() !== 'GET' && req.headers()['x-admin'] !== '1') return json({ erreur: 'En-tête manquant.' }, 403);
    if (rel === 'connexion') {
      hooks.connexions++;
      if (JSON.parse(req.postData() || '{}').motDePasse !== MOT_DE_PASSE) return json({ erreur: 'Mot de passe incorrect.' }, 401);
      hooks.connecte = true; return json({ ok: true });
    }
    if (rel === 'deconnexion') { hooks.connecte = false; return json({ ok: true }); }
    if (!hooks.connecte) return json({ erreur: 'Connexion requise.' }, 401);
    const [quoi, nom, id] = rel.split('/');
    const p = 'data/' + nom + '.json';
    if (quoi === 'fichier' && req.method() === 'PUT') {
      const body = JSON.parse(req.postData()); const cur = files[p];
      if (hooks.forceConflict.has(p) || (cur ? body.sha !== cur.sha : body.sha)) return json({ erreur: 'CONFLIT' }, 409);
      const sha = put(p, body.data, body.message); puts.push({ p, obj: body.data, message: body.message });
      return json({ sha });
    }
    if (quoi === 'fichier') return json(files[p] ? { data: JSON.parse(files[p].content), sha: files[p].sha } : { data: null, sha: null });
    if (quoi === 'historique') return json((commits[p] || []).map((c) => ({ id: c.id, date: c.date, message: c.message })));
    if (quoi === 'version') { const c = (commits[p] || []).find((x) => x.id === id); return c ? json(JSON.parse(c.content)) : json({}, 404); }
    return json({}, 404);
  });
  await page.route('https://api.github.com/**', async (route) => {
    const rel = new URL(route.request().url()).pathname.replace('/repos/aulit42369/Site', '');
    const json = (o, s = 200) => route.fulfill({ status: s, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(o) });
    if (rel === '/actions/runs') return json({ workflow_runs: runs });
    if (rel === '/pages/builds/latest') return json({ status: 'built', updated_at: new Date().toISOString() });
    return json({}, 404);
  });
  return { files, puts, hooks, put, MOT_DE_PASSE };
}
module.exports = { installFakeGithub, MOT_DE_PASSE };
