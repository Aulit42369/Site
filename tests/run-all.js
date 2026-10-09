/* Lance toutes les suites (*.test.js) sur une copie temporaire du dépôt.
     cd tests && npm install && npx playwright install chromium && node run-all.js
   Code de sortie 1 si une suite échoue. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const REPO = path.join(__dirname, '..');
const PORT = parseInt(process.env.TEST_PORT || '8930', 10);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aulit-site-'));
fs.cpSync(REPO, tmp, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  // les tests lisent les sources plutôt que les versions minifiées
  if (p === '/style.min.css') p = '/style.css';
  if (p === '/main.min.js') p = '/main.js';
  const fp = path.join(tmp, p);
  if (!fp.startsWith(tmp)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
});

function runSuite(s) {
  // spawn asynchrone : le serveur de test tourne dans CE processus, il ne doit pas être bloqué
  return new Promise((resolve) => {
    const c = spawn(process.execPath, [path.join(__dirname, s)], {
      stdio: 'inherit', env: { ...process.env, TEST_ROOT: tmp, TEST_BASE: 'http://localhost:' + PORT },
    });
    c.on('exit', (code) => resolve(code));
  });
}

server.listen(PORT, async () => {
  const suites = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).sort();
  let failed = 0;
  for (const s of suites) {
    console.log('\n━━━ ' + s + ' ━━━');
    if ((await runSuite(s)) !== 0) { failed++; console.log('✗ ' + s + ' a échoué'); }
  }
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\n' + (failed ? '✗ ' + failed + ' suite(s) en échec' : '✓ toutes les suites passent (' + suites.length + ')'));
  process.exit(failed ? 1 : 0);
});
