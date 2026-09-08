/* GoldCoast Live Casino — core SPA: state, api, router, header, auth, lobby */
const GC = {
  user: null, token: null, meta: null,
  view: 'lobby', params: {},
  el(id) { return document.getElementById(id); },
  app() { return document.getElementById('app'); }
};

/* ---------- api helper ---------- */
async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (GC.token) headers['Authorization'] = 'Bearer ' + GC.token;
  if (opts.body && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch('/api' + path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers,
    body: opts.body instanceof FormData ? opts.body : (opts.body ? JSON.stringify(opts.body) : undefined)
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    if (res.status === 401 && GC.token) { GC.token = null; GC.user = null; localStorage.removeItem('gc_token'); }
    const msg = data.error || ('Request failed (' + res.status + ')');
    if (!opts.silent) toast(msg, 'error');
    const err = new Error(msg); err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}

/* ---------- helpers ---------- */
function fmtGHS(cents) {
  const v = (cents || 0) / 100;
  return '₵' + v.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function toast(msg, type = '') {
  const w = document.querySelector('.toast-wrap') || (() => { const d = document.createElement('div'); d.className = 'toast-wrap'; document.body.appendChild(d); return d; })();
  const t = document.createElement('div');
  t.className = 'toast ' + type; t.textContent = msg;
  w.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; setTimeout(() => t.remove(), 400); }, 3600);
}
function timeAgo(t) {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  return Math.floor(s / 3600) + 'h ago';
}
async function refreshUser() {
  if (!GC.token) return;
  try { const d = await api('/auth/me', { silent: true }); GC.user = d.user; updateBalanceChip(); } catch {}
}

/* ---------- router ---------- */
const ROUTES = {};
function route(name, fn) { ROUTES[name] = fn; }
function nav(name, params = {}) {
  GC.view = name; GC.params = params;
  location.hash = '#/' + name + (params.id ? '/' + params.id : '');
}
window.addEventListener('hashchange', () => { parseHash(); });
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const parts = h.split('/');
  GC.view = parts[0] || 'lobby';
  GC.params = { id: parts[1] };
  render();
}

/* ---------- header ---------- */
function renderHeader() {
  const old = document.getElementById('topbar');
  if (old) old.remove();
  const h = document.createElement('header');
  h.id = 'topbar'; h.className = 'topbar';
  const isAuthView = ['login', 'register'].includes(GC.view);
  h.innerHTML = `
    <div class="topbar-inner">
      <div class="logo" onclick="nav('lobby')">
        <div class="logo-badge">🎲</div>
        <div>
          <div class="logo-name">GOLDCOAST</div>
          <div class="logo-sub">LIVE CASINO • GHANA</div>
        </div>
      </div>
      <nav class="mainnav">
        <a data-nav="lobby">Lobby</a>
        <a data-nav="roulette">Roulette</a>
        <a data-nav="crash">Crash</a>
        <a data-nav="blackjack">Blackjack</a>
        <a data-nav="dice">Dice</a>
        <a data-nav="mines">Mines</a>
        ${GC.user ? `<a data-nav="wallet">Wallet</a>` : ''}
        ${GC.user && GC.user.role === 'admin' ? `<a data-nav="admin" style="color:var(--gold2)">Admin</a>` : ''}
      </nav>
      <div class="topbar-right">
        <span class="mode-badge">${GC.meta && GC.meta.mode === 'sandbox' ? 'SANDBOX' : 'LIVE'}</span>
        ${GC.user ? `
          <div class="balance-chip">💰 <span class="amount" id="balanceChip">${fmtGHS(GC.user.balanceCents)}</span></div>
          <div class="avatar-chip" title="${esc(GC.user.username)}" onclick="nav('profile')">${esc(GC.user.username[0].toUpperCase())}</div>
          <button class="btn secondary small" onclick="doLogout()">Logout</button>
        ` : `
          <button class="btn secondary small" onclick="nav('login')">Login</button>
          <button class="btn small" onclick="nav('register')">Sign Up</button>
        `}
      </div>
    </div>`;
  if (!isAuthView) document.body.prepend(h);
  else if (!document.getElementById('topbar')) document.body.prepend(h);
  h.querySelectorAll('[data-nav]').forEach(a => {
    if (a.dataset.nav === GC.view) a.classList.add('active');
    a.onclick = (e) => { e.preventDefault(); nav(a.dataset.nav); };
  });
}
function updateBalanceChip() {
  const c = document.getElementById('balanceChip');
  if (c && GC.user) c.textContent = fmtGHS(GC.user.balanceCents);
}
async function doLogout() {
  try { await api('/auth/logout', { silent: true }); } catch {}
  GC.user = null; GC.token = null;
  localStorage.removeItem('gc_token');
  toast('Logged out. Medaase! 👋');
  nav('lobby'); render();
}

/* ---------- render loop ---------- */
let cleanupFns = [];
function onCleanup(fn) { cleanupFns.push(fn); }
async function render() {
  cleanupFns.forEach(f => { try { f(); } catch {} });
  cleanupFns = [];
  renderHeader();
  const app = GC.app();
  const fn = ROUTES[GC.view] || ROUTES['404'];
  app.innerHTML = '';
  try { await fn(app); } catch (e) { console.error(e); app.innerHTML = `<div class="container tight"><div class="card"><div class="error-box">${esc(e.message)}</div></div></div>`; }
  window.scrollTo(0, 0);
}

/* ============ VIEWS: auth ============ */
route('login', async (app) => {
  app.innerHTML = `
  <div class="container tight" style="padding-top:60px">
    <div class="card">
      <div class="center mb"><div class="logo-badge" style="margin:0 auto;width:54px;height:54px;font-size:28px">🎲</div></div>
      <h2 class="center gold-text">Welcome back</h2>
      <p class="center muted small mb">Login to GoldCoast Live Casino</p>
      <div id="authErr"></div>
      <form id="loginForm">
        <label>Username</label>
        <input id="luser" autocomplete="username" required>
        <label>Password</label>
        <input id="lpass" type="password" autocomplete="current-password" required>
        <button class="btn block mt2" type="submit">Login</button>
      </form>
      <p class="center mt muted small">No account? <a class="link" style="cursor:pointer" onclick="nav('register')">Create one free</a></p>
      <div class="info-box small">🇬🇭 New players get <b>₵1,000 sandbox play credits</b> instantly. 18+ only. Play responsibly.</div>
    </div>
  </div>`;
  GC.el('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const d = await api('/auth/login', { body: { username: GC.el('luser').value, password: GC.el('lpass').value } });
      GC.token = d.token; GC.user = d.user;
      localStorage.setItem('gc_token', d.token);
      toast('Welcome back, ' + d.user.username + '! 🎉', 'success');
      nav('lobby'); render();
    } catch (err) { GC.el('authErr').innerHTML = `<div class="error-box">${esc(err.message)}</div>`; }
  };
});

route('register', async (app) => {
  app.innerHTML = `
  <div class="container tight" style="padding-top:40px">
    <div class="card">
      <div class="center mb"><div class="logo-badge" style="margin:0 auto;width:54px;height:54px;font-size:28px">🎲</div></div>
      <h2 class="center gold-text">Create your account</h2>
      <p class="center muted small mb">Join in under a minute — no paperwork yet</p>
      <div id="authErr"></div>
      <form id="regForm">
        <div class="form-grid">
          <div><label>Username *</label><input id="ruser" required placeholder="e.g. kwame_gh"></div>
          <div><label>Password *</label><input id="rpass" type="password" required minlength="6"></div>
          <div class="full"><label>Email *</label><input id="remail" type="email" required placeholder="you@example.com"></div>
          <div><label>Phone (Ghana)</label><input id="rphone" placeholder="0244123456"></div>
          <div><label>Full name</label><input id="rname" placeholder="Kwame Mensah"></div>
          <div class="full"><label>Promo / referral code</label><input id="rpromo" placeholder="optional"></div>
        </div>
        <label style="display:flex;gap:8px;align-items:flex-start;margin-top:16px;font-size:12.5px;color:var(--text)">
          <input type="checkbox" id="rage" required style="width:auto;margin-top:3px">
          I am 18+ and accept the Terms. Gambling can be addictive — play responsibly.
        </label>
        <button class="btn block mt2" type="submit">Create Account & Claim ₵1,000 Play Credits</button>
      </form>
      <p class="center mt muted small">Already registered? <a class="link" style="cursor:pointer" onclick="nav('login')">Login</a></p>
    </div>
  </div>`;
  GC.el('regForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const d = await api('/auth/register', { body: {
        username: GC.el('ruser').value, password: GC.el('rpass').value,
        email: GC.el('remail').value, phone: GC.el('rphone').value || undefined,
        fullName: GC.el('rname').value || undefined, promo: GC.el('rpromo').value || undefined
      }});
      GC.token = d.token; GC.user = d.user;
      localStorage.setItem('gc_token', d.token);
      toast('Account created! ₵1,000 play credits added 🎉', 'success');
      nav('lobby'); render();
    } catch (err) { GC.el('authErr').innerHTML = `<div class="error-box">${esc(err.message)}</div>`; }
  };
});

/* ============ VIEW: lobby ============ */
route('lobby', async (app) => {
  let feed = [];
  try { feed = (await api('/feed', { silent: true })).wins; } catch {}
  const games = [
    { id: 'roulette', img: 'img/roulette.jpg', tag: 'LIVE', name: 'Live Roulette', desc: 'Shared European wheel rounds every 20s — bet red/black, dozens, straight-ups.' },
    { id: 'crash', img: 'img/crash.jpg', tag: 'LIVE', tagHot: true, name: 'Crash', desc: 'Ride the rocket with everyone else. Cash out before it crashes. Provably fair.' },
    { id: 'blackjack', img: 'img/blackjack.jpg', tag: 'TABLE', name: 'Blackjack', desc: 'Classic 3:2 blackjack. Hit, stand or double against the dealer.' },
    { id: 'dice', img: 'img/dice.jpg', tag: 'INSTANT', name: 'Dice', desc: 'Roll under or over your target. Up to 49x multiplier.' },
    { id: 'mines', img: 'img/mines.jpg', tag: 'INSTANT', tagNew: true, name: 'Mines', desc: 'Dig gems, dodge bombs, cash out anytime. Your choice of risk.' },
    { id: 'wallet', img: 'img/studio.jpg', tag: 'CASHIER', name: 'Cashier', desc: 'MTN MoMo, Visa/Mastercard & USDT — deposits and KYC-gated withdrawals.' }
  ];
  app.innerHTML = `
  <div class="container">
    <div class="hero">
      <img class="bg" src="img/hero.jpg" alt="GoldCoast Live Casino">
      <div class="overlay"></div>
      <div class="hero-content">
        <div class="hero-badges">
          <span>🇬🇭 MADE FOR GHANA</span><span>MTN MoMo • VISA • USDT</span><span>KYC VERIFIED PAYOUTS</span><span>PROVABLY FAIR</span>
        </div>
        <h1>Accra nights.<br><span>Real casino action.</span></h1>
        <p>Live shared rounds of roulette and crash, classic table games, MoMo & card deposits, and verified payouts — all in one place. ${GC.meta && GC.meta.mode === 'sandbox' ? '<b>Sandbox mode:</b> play with free credits, no real money.' : ''}</p>
        ${GC.user ? `
          <div class="row">
            <button class="btn" onclick="nav('roulette')">🎲 Play Live Roulette</button>
            <button class="btn secondary" onclick="nav('wallet')">Deposit</button>
          </div>` : `
          <div class="row">
            <button class="btn" onclick="nav('register')">Create Free Account</button>
            <button class="btn secondary" onclick="nav('login')">Login</button>
          </div>`}
      </div>
    </div>

    ${feed.length ? `
    <div class="ticker-wrap mb">
      <div class="ticker">
        ${feed.map(w => `<span class="ticker-item"><b>${esc(w.u)}</b> played ${w.g} — ${w.p > 0 ? `<span class="win">won ${fmtGHS(w.p)}</span>` : `<span class="lose">lost</span>`} <span class="muted">${timeAgo(w.t)}</span></span>`).join('')}
      </div>
    </div>` : ''}

    <div class="section-head">
      <h2>Live Games</h2><span class="live-dot">LIVE ROUND LOOPS</span>
    </div>
    <div class="game-grid">
      ${games.map(g => `
      <div class="game-card" onclick="nav('${g.id}')">
        <img src="${g.img}" alt="${g.name}">
        ${g.tag === 'LIVE' ? `<span class="game-tag ${g.tagHot ? 'hot' : ''}">● LIVE</span>` : g.tagNew ? `<span class="game-tag new">NEW</span>` : ''}
        <div class="info">
          <h3>${g.name}</h3>
          <p>${g.desc}</p>
        </div>
      </div>`).join('')}
    </div>

    <div class="grid-3 mt2">
      <div class="card"><h3 class="gold-text mb">📱 MoMo & Card</h3><p class="muted small" style="line-height:1.7">Deposit with MTN MoMo, AirtelTigo Cash, Telecel Cash, Visa or Mastercard in seconds. USDT (TRC20/BEP20) & BTC supported too.</p></div>
      <div class="card"><h3 class="gold-text mb">🪪 Ghana Card KYC</h3><p class="muted small" style="line-height:1.7">Verify with your Ghana Card or passport + selfie to unlock withdrawals and higher limits — GCG-standard AML checks.</p></div>
      <div class="card"><h3 class="gold-text mb">🔒 Provably Fair</h3><p class="muted small" style="line-height:1.7">Every round result is generated from a pre-committed hash. Verify any past round yourself. 18+ only.</p></div>
    </div>
  </div>
  <div class="footer-note">
    🇬🇭 GoldCoast Live Casino — demo platform in <b>SANDBOX mode</b>. No real-money wagering.<br>
    Real-money operation in Ghana requires a Gaming Commission of Ghana licence (Gaming Act 721). 18+ | Play responsibly | Gambling is addictive.<br>
    Help: support@goldcoast.local • Support line: 0800-100-100
  </div>`;
});

route('404', async (app) => {
  app.innerHTML = `<div class="container tight" style="padding-top:80px"><div class="card center"><h2>404</h2><p class="muted mb">This table has closed.</p><button class="btn" onclick="nav('lobby')">Back to Lobby</button></div></div>`;
});

/* ---------- boot ---------- */
(async function boot() {
  try { GC.meta = await api('/meta', { silent: true }); } catch {}
  const tok = localStorage.getItem('gc_token');
  if (tok) {
    GC.token = tok;
    try { GC.user = (await api('/auth/me', { silent: true })).user; }
    catch { GC.token = null; localStorage.removeItem('gc_token'); }
  }
  if (!location.hash) location.hash = '#/lobby';
  parseHash();
  setInterval(() => { if (GC.user && !['login', 'register'].includes(GC.view)) refreshUser(); }, 20000);
})();
