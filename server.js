// GoldCoast Live Casino — main server
const http = require('http');
const fs = require('fs');
const path = require('path');
const C = require('./config');
const { Router, json } = require('./src/router');
const { db, load, save } = require('./src/store');
const auth = require('./src/auth');
const wallet = require('./src/wallet');
const kyc = require('./src/kyc');
const games = require('./src/games');
const live = require('./src/live');
const admin = require('./src/admin');
const { sha } = require('./src/util');

// ---------- static ----------
const PUBLIC = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2'
};

function serveStatic(req, res) {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return true; }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=60' });
  fs.createReadStream(file).pipe(res);
  return true;
}

// ---------- app ----------
load();
const r = new Router();

// public feed
r.get('/api/feed', (req, res) => {
  const d = db();
  json(res, 200, { wins: (d.winFeed || []).slice(0, 20), mode: C.MODE, usdt: C.PAYMENTS.crypto.usdtToGhs });
});

r.get('/api/meta', (req, res) => {
  json(res, 200, {
    name: 'GoldCoast Live Casino', mode: C.MODE, currency: 'GHS',
    momo: C.PAYMENTS.momo.providers, cards: C.PAYMENTS.card.providers, cryptoNetworks: Object.keys(C.PAYMENTS.crypto.networks),
    usdtToGhs: C.PAYMENTS.crypto.usdtToGhs, minDeposit: C.MIN_DEPOSIT, minWithdraw: C.MIN_WITHDRAW
  });
});

auth.registerRoutes(r);
wallet.registerRoutes(r);
kyc.registerRoutes(r);
games.registerRoutes(r);
live.registerCrashRoutes(r);
live.registerRouletteRoutes(r);
admin.registerRoutes(r);

// health
r.get('/api/health', (req, res) => json(res, 200, { ok: true, mode: C.MODE, time: Date.now() }));

const server = http.createServer(async (req, res) => {
  // security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  try {
    const handled = await r.handle(req, res);
    if (handled) return;
    if (serveStatic(req, res)) return;
    // SPA fallback to index.html for client routes
    if (req.method === 'GET' && !req.url.startsWith('/api')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(path.join(PUBLIC, 'index.html')).pipe(res);
      return;
    }
    json(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error('[server]', e);
    if (!res.headersSent) json(res, 500, { error: 'Server error' });
  }
});

// init live game loops + admin
auth.createAdminIfMissing();
live.initCrash();
live.initRoulette();

server.listen(C.PORT, () => {
  console.log(`\n  🎲 GoldCoast Live Casino — ${C.MODE.toUpperCase()} MODE`);
  console.log(`  → http://localhost:${C.PORT}`);
  console.log(`  Admin: username "${C.ADMIN_USER}" / password "${C.ADMIN_INIT_PASSWORD}"`);
  console.log(`  Mode: set CASINO_MODE=live only after GCG licence + PSP integration (see docs/GO-LIVE-CHECKLIST.md)\n`);
});

process.on('SIGINT', () => { console.log('\nshutting down'); save(); process.exit(0); });
process.on('SIGTERM', () => { save(); process.exit(0); });
