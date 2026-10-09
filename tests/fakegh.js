/* Faux GitHub (API Contents/commits/actions) pour tester l'admin sans réseau. */
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

async function installFakeGithub(page, seed = {}) {
  let n = 0;
  const files = {}, commits = {}, puts = [];
  const hooks = { forceConflict: new Set(), dispatched: 0 };
  const put = (p, obj, msg) => {
    n++;
    const sha = 'sha' + n;
    const content = JSON.stringify(obj, null, 2);
    files[p] = { content, sha };
    (commits[p] = commits[p] || []).unshift({ sha, commit: { message: msg, author: { date: new Date().toISOString() } }, content });
    return sha;
  };
  put('data/streamers.json', [], 'init'); put('data/clips.json', [{ slug: 'Existing', title: 'Déjà là' }], 'init');
  put('data/planning.json', [{ day: 'Lundi', on: true, time: '21:00', end: '00:00', game: 'X', color: '#00f5ff' }], 'init');
  Object.entries(seed).forEach(([p, o]) => put(p, o, 'seed'));
  await page.route('https://api.github.com/**', async (route) => {
    const req = route.request(); const url = new URL(req.url());
    const rel = url.pathname.replace('/repos/aulit42369/Site', '');
    const json = (o, s = 200) => route.fulfill({ status: s, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(o) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (rel.startsWith('/contents/')) {
      const p = decodeURIComponent(rel.slice('/contents/'.length));
      if (req.method() === 'PUT') {
        const body = JSON.parse(req.postData()); const cur = files[p];
        if (hooks.forceConflict.has(p) || (cur && body.sha !== cur.sha)) return json({ message: 'sha mismatch' }, 409);
        const obj = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
        const sha = put(p, obj, body.message); puts.push({ p, obj, message: body.message });
        return json({ content: { sha } });
      }
      if (!files[p]) return json({ message: 'Not Found' }, 404);
      return json({ content: b64(files[p].content), sha: files[p].sha });
    }
    if (rel === '/commits') return json((commits[url.searchParams.get('path')] || []).map((c) => ({ sha: c.sha, commit: c.commit })));
    if (rel === '/actions/runs') return json({ workflow_runs: [] });
    if (rel === '/pages/builds/latest') return json({ status: 'built', updated_at: new Date().toISOString() });
    if (rel.endsWith('/dispatches')) { hooks.dispatched++; return route.fulfill({ status: 204, headers: CORS }); }
    return json({}, 404);
  });
  return { files, puts, hooks, put };
}
module.exports = { installFakeGithub };
