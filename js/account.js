/* GoldCoast Live Casino — account.js: profile (security, responsible gambling) + admin console */

/* ================= PROFILE ================= */
route('profile', async (app) => {
  if (!GC.user) return nav('login');
  const u = GC.user;

  app.innerHTML = `
  <div class="container mid">
    <div class="card">
      <div class="card-title"><h2>👤 My Account</h2>
        <span class="badge ${u.kycStatus === 'approved' ? 'approved' : u.kycStatus === 'pending' ? 'pending' : 'rejected'}">
          KYC: ${u.kycStatus}</span></div>
      <div class="grid-2">
        <div>
          <div class="stat-card" style="margin-bottom:14px">
            <div class="k">Cash balance</div><div class="v">${fmtGHS(u.balanceCents)}</div>
          </div>
          <div class="stat-card">
            <div class="k">Bonus credits</div><div class="v plain">+${fmtGHS(u.bonusCents)}</div>
          </div>
        </div>
        <div style="font-size:13.5px;line-height:2">
          <div><span class="muted">Username:</span> <b>${esc(u.username)}</b></div>
          <div><span class="muted">Full name:</span> ${esc(u.fullName || '— complete KYC —')}</div>
          <div><span class="muted">Email:</span> ${esc(u.email || '—')}</div>
          <div><span class="muted">Phone:</span> ${esc(u.phone || '—')}</div>
          <div><span class="muted">Member since:</span> ${new Date(u.createdAt).toLocaleDateString('en-GB')}</div>
          <div style="margin-top:8px"><button class="btn secondary small" onclick="nav('kyc')">
            ${u.kycStatus === 'approved' ? 'View verification' : 'Complete KYC verification →'}</button></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title"><h2>🔒 Change Password</h2></div>
      <div class="form-grid">
        <div class="full"><label>Current password</label><input type="password" id="pw_cur" placeholder="••••••••"></div>
        <div><label>New password</label><input type="password" id="pw_new" placeholder="Min 6 characters"></div>
        <div><label>Confirm new password</label><input type="password" id="pw_new2" placeholder="Repeat"></div>
      </div>
      <div style="margin-top:14px"><button class="btn" onclick="changePassword()">Update password</button></div>
    </div>

    <div class="card">
      <div class="card-title"><h2>🛡️ Responsible Gambling</h2></div>
      <p class="muted small" style="margin-bottom:14px">GoldCoast is committed to safe play (18+). Set a daily loss limit or take a break — settings apply instantly to all games.</p>
      <div class="grid-2">
        <div>
          <label>Daily loss limit (₵)</label>
          <input type="number" id="loss_limit" min="0" step="5" value="${(u.lossLimitCents || 0) / 100}" placeholder="0 = no limit">
          <div class="field-hint">Current: ${u.lossLimitCents ? fmtGHS(u.lossLimitCents) + '/day' : 'No limit set'} — you'll be blocked from betting once net losses today reach this amount.</div>
          <div style="margin-top:10px"><button class="btn secondary" onclick="saveLossLimit()">Save limit</button></div>
        </div>
        <div>
          <label>Self-exclusion (cool-off)</label>
          <select id="exclude_days">
            <option value="1">1 day</option><option value="7">7 days</option>
            <option value="30" selected>30 days</option><option value="90">90 days</option><option value="365">365 days</option>
          </select>
          <div class="field-hint">Blocks login & betting completely for the chosen period. Cannot be undone early.</div>
          ${u.selfExcludedUntil && u.selfExcludedUntil > Date.now() ? `<div class="error-box" style="margin-top:10px">You are self-excluded until ${new Date(u.selfExcludedUntil).toLocaleString('en-GB')}</div>` : ''}
          <div style="margin-top:10px"><button class="btn danger" onclick="selfExclude()">Self-exclude now</button></div>
        </div>
      </div>
    </div>

    <div class="card center">
      <button class="btn secondary" onclick="doLogout()">Log out of this device</button>
    </div>
  </div>`;

  window.changePassword = async () => {
    const cur = GC.el('pw_cur').value, nw = GC.el('pw_new').value, nw2 = GC.el('pw_new2').value;
    if (!cur || !nw) return toast('Fill in all password fields', 'error');
    if (nw.length < 6) return toast('New password must be at least 6 characters', 'error');
    if (nw !== nw2) return toast('New passwords do not match', 'error');
    try {
      await api('/auth/password', { body: { current: cur, next: nw } });
      toast('Password updated ✓'); GC.el('pw_cur').value = GC.el('pw_new').value = GC.el('pw_new2').value = '';
    } catch {}
  };
  window.saveLossLimit = async () => {
    const v = Number(GC.el('loss_limit').value);
    if (isNaN(v) || v < 0) return toast('Enter a valid amount', 'error');
    try { const d = await api('/me/limits', { body: { dailyLossLimit: v } }); GC.user = d.user; toast('Daily loss limit saved ✓'); render(); }
    catch {}
  };
  window.selfExclude = async () => {
    if (!confirm('Self-exclude now? You will be logged out and unable to log in until the period ends.')) return;
    const days = Number(GC.el('exclude_days').value);
    try { await api('/me/selfexclude', { body: { days } }); toast('Self-exclusion active. Stay safe 🤍', 'error'); doLogout(); }
    catch {}
  };
  window.doLogout = async () => {
    try { await api('/auth/logout', { method: 'POST', silent: true }); } catch {}
    GC.token = null; GC.user = null; localStorage.removeItem('gc_token');
    nav('lobby'); render();
  };
});

/* ================= ADMIN CONSOLE ================= */
let adminTab = 'overview';
route('admin', async (app) => {
  if (!GC.user || GC.user.role !== 'admin') {
    app.innerHTML = `<div class="container tight" style="padding-top:90px">
      <div class="card center"><h2>🔐 Admin Area</h2>
      <p class="muted">Restricted to GoldCoast operators.</p>
      <button class="btn" onclick="nav('login')">Login as admin</button></div></div>`;
    return;
  }

  app.innerHTML = `
  <div class="container">
    <div class="card">
      <div class="card-title"><h2>⚙️ Operator Console</h2><span class="muted small">Sandbox back-office</span></div>
      <div class="admin-tabs">
        <button class="pay-tab ${adminTab === 'overview' ? 'active' : ''}" onclick="setAdminTab('overview')">📊 Overview</button>
        <button class="pay-tab ${adminTab === 'kyc' ? 'active' : ''}" onclick="setAdminTab('kyc')">🪪 KYC Queue</button>
        <button class="pay-tab ${adminTab === 'payouts' ? 'active' : ''}" onclick="setAdminTab('payouts')">💸 Withdrawals</button>
        <button class="pay-tab ${adminTab === 'users' ? 'active' : ''}" onclick="setAdminTab('users')">👥 Users</button>
      </div>
      <div id="admin_body"><p class="muted">Loading…</p></div>
    </div>
  </div>`;

  window.setAdminTab = (t) => { adminTab = t; render(); };
  await loadAdminTab();
});

async function loadAdminTab() {
  const body = GC.el('admin_body');
  if (!body) return;
  try {
    if (adminTab === 'overview') {
      const s = await api('/admin/stats');
      body.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="k">Players</div><div class="v">${s.users.total}</div></div>
        <div class="stat-card"><div class="k">KYC pending</div><div class="v">${s.users.kycPending}</div></div>
        <div class="stat-card"><div class="k">Verified</div><div class="v green">${s.users.verified}</div></div>
        <div class="stat-card"><div class="k">New (24h)</div><div class="v">${s.users.newToday}</div></div>
        <div class="stat-card"><div class="k">Player balances</div><div class="v plain">${fmtGHS(s.wallet.totalBalances)}</div></div>
        <div class="stat-card"><div class="k">Deposits (${s.wallet.depositsCount})</div><div class="v green">${fmtGHS(s.wallet.depositsTotal)}</div></div>
        <div class="stat-card"><div class="k">Payouts pending</div><div class="v ${s.wallet.withdrawPending ? 'red' : ''}">${s.wallet.withdrawPending} · ${fmtGHS(s.wallet.withdrawPendingTotal)}</div></div>
        <div class="stat-card"><div class="k">Total wagered</div><div class="v plain">${fmtGHS(s.games.wagered)}</div></div>
        <div class="stat-card"><div class="k">Paid out</div><div class="v plain">${fmtGHS(s.games.paidOut)}</div></div>
        <div class="stat-card"><div class="k">GGR (house)</div><div class="v ${s.games.ggr >= 0 ? 'green' : 'red'}">${fmtGHS(s.games.ggr)}</div></div>
      </div>
      <p class="muted small" style="margin-top:14px">GGR = total wagered − total paid out. Sandbox figures; in LIVE mode this dashboard feeds from the same ledger used for GCG tax reporting.</p>`;
    }

    if (adminTab === 'kyc') {
      const d = await api('/admin/kyc');
      if (!d.queue.length) { body.innerHTML = `<div class="info-box">No KYC applications waiting review. ✅</div>`; return; }
      body.innerHTML = d.queue.map(k => `
        <div style="border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:center">
            <div><b>${esc(k.username)}</b> <span class="muted">· ${esc(k.fullName || 'no name')}</span></div>
            <span class="badge pending">pending</span>
          </div>
          <div class="muted small" style="margin:8px 0">DOB ${esc(k.dob || '—')} · Phone ${esc(k.phone || '—')} · Doc ${esc(k.doc ? k.doc.type + ' ' + (k.doc.idNumber || '') : 'missing')}</div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin:10px 0">
            ${k.doc ? `<div><div class="muted small">Document</div><img src="${k.doc.file}" class="preview-img" style="max-height:160px"></div>` : ''}
            ${k.selfie ? `<div><div class="muted small">Selfie</div><img src="${k.selfie.file}" class="preview-img" style="max-height:160px"></div>` : ''}
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn green small" onclick="kycReview('${k.id}','approve')">✓ Approve (Tier 2)</button>
            <button class="btn danger small" onclick="kycReview('${k.id}','reject')">✗ Reject</button>
          </div>
        </div>`).join('');
      window.kycReview = async (userId, decision) => {
        const reason = decision === 'reject' ? prompt('Reason for rejection (shown to player):', 'Photo unreadable — retake in good light') : null;
        if (decision === 'reject' && reason === null) return;
        try { await api('/admin/kyc/review', { body: { userId, decision, reason } }); toast(decision === 'approve' ? 'KYC approved ✓' : 'KYC rejected'); loadAdminTab(); } catch {}
      };
    }

    if (adminTab === 'payouts') {
      const d = await api('/admin/withdrawals');
      if (!d.pending.length) { body.innerHTML = `<div class="info-box">No pending withdrawals. All payouts settled. ✅</div>`; return; }
      body.innerHTML = `<table class="txn-table"><thead><tr>
        <th>Player</th><th>Amount</th><th>Method</th><th>Details</th><th>KYC</th><th></th></tr></thead><tbody>
        ${d.pending.map(t => `<tr>
          <td>${esc(t.username)}</td>
          <td class="neg">${fmtGHS(t.amountCents)}</td>
          <td>${esc((t.method || '').toUpperCase())}</td>
          <td class="muted small">${esc(t.details || t.note || '—')}</td>
          <td><span class="badge ${t.kyc === 'approved' ? 'approved' : 'rejected'}">${t.kyc}</span></td>
          <td style="white-space:nowrap">
            <button class="btn green small" onclick="payOut('${t.id}','approve')">✓ Pay out</button>
            <button class="btn danger small" onclick="payOut('${t.id}','reject')">✗ Refund</button>
          </td></tr>`).join('')}
      </tbody></table>`;
      window.payOut = async (txnId, action) => {
        if (!confirm(action === 'approve' ? 'Mark this withdrawal as paid out?' : 'Reject and refund to player balance?')) return;
        try { await api('/admin/withdrawals/process', { body: { txnId, action } }); toast(action === 'approve' ? 'Payout approved' : 'Refunded'); loadAdminTab(); } catch {}
      };
    }

    if (adminTab === 'users') {
      const q = (window.__userQ || '');
      const d = await api('/admin/users' + (q ? '?q=' + encodeURIComponent(q) : ''));
      body.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <input id="uq" placeholder="Search username / email / name…" value="${esc(q)}" onkeydown="if(event.key==='Enter')searchUsers()">
        <button class="btn small" onclick="searchUsers()">Search</button>
      </div>
      <div style="overflow-x:auto"><table class="txn-table"><thead><tr>
        <th>User</th><th>Balance</th><th>Bonus</th><th>KYC</th><th>Joined</th><th>Adjust ₵</th></tr></thead><tbody>
        ${d.users.map(u => `<tr>
          <td><b>${esc(u.username)}</b>${u.role === 'admin' ? ' ⚙️' : ''}<div class="muted small">${esc(u.email || '')}</div></td>
          <td class="pos">${fmtGHS(u.balanceCents)}</td>
          <td class="muted">+${fmtGHS(u.bonusCents)}</td>
          <td><span class="badge ${u.kycStatus === 'approved' ? 'approved' : u.kycStatus === 'pending' ? 'pending' : 'rejected'}">${u.kycStatus}</span></td>
          <td class="muted small">${new Date(u.createdAt).toLocaleDateString('en-GB')}</td>
          <td style="white-space:nowrap">
            <input type="number" id="adj_${u.id}" placeholder="±₵" style="width:80px;display:inline-block">
            <button class="btn secondary small" onclick="adjust('${u.id}','${esc(u.username)}')">Apply</button>
          </td></tr>`).join('')}
      </tbody></table></div>`;
      window.searchUsers = () => { window.__userQ = GC.el('uq').value.trim(); loadAdminTab(); };
      window.adjust = async (userId, uname) => {
        const amount = Number(GC.el('adj_' + userId).value);
        if (!amount || isNaN(amount)) return toast('Enter an amount (e.g. 50 or -50)', 'error');
        const note = prompt('Note for ledger (adjusting ' + uname + ' by ₵' + amount + '):', 'Manual ' + (amount > 0 ? 'comp' : 'correction'));
        if (note === null) return;
        try { await api('/admin/adjust', { body: { userId, amount, note } }); toast('Balance adjusted ✓'); loadAdminTab(); } catch {}
      };
    }
  } catch (e) { body.innerHTML = `<div class="error-box">Failed to load admin data: ${esc(e.message)}</div>`; }
}
