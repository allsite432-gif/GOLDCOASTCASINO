/* GoldCoast — wallet (deposits/withdrawals/history) + KYC wizard */
/* ============ VIEW: wallet ============ */
route('wallet', async (app) => {
  if (!GC.user) return nav('login');
  let rates = {};
  try { rates = await api('/wallet/rates', { silent: true }); } catch {}
  let txns = [];
  try { txns = (await api('/wallet/transactions', { silent: true })).transactions; } catch {}

  app.innerHTML = `
  <div class="container mid">
    <div class="card">
      <div class="card-title"><h2>💰 Cashier</h2><span class="mode-badge">${GC.meta.mode.toUpperCase()}</span></div>
      <div class="balance-chip" style="font-size:17px;padding:12px 20px">Balance: <span class="amount" style="margin-left:6px">${fmtGHS(GC.user.balanceCents)}</span></div>
      ${GC.meta.mode === 'sandbox' ? `<div class="info-box small mt">🧪 <b>Sandbox mode</b> — deposits are simulated and free sandbox top-ups are available. Real money requires GCG licensing (see the go-live checklist in the project docs).</div>` : ''}
      <div class="pay-tabs mt2">
        <div class="pay-tab active" data-tab="momo">📱 Mobile Money<span class="sub">MTN • AT • Telecel</span></div>
        <div class="pay-tab" data-tab="card">💳 Card<span class="sub">Visa • Mastercard</span></div>
        <div class="pay-tab" data-tab="crypto">₿ Crypto<span class="sub">USDT • BTC</span></div>
        <div class="pay-tab" data-tab="withdraw">🏧 Withdraw<span class="sub">KYC required</span></div>
      </div>
      <div id="payBody"></div>
    </div>

    <div class="card">
      <div class="card-title"><h2>🧾 Transaction history</h2></div>
      ${GC.user.kycStatus !== 'approved' ? `<div class="info-box small">🪪 Withdrawals need KYC verification — <a class="link" style="cursor:pointer" onclick="nav('kyc')">verify now</a> (Ghana Card + selfie).</div>` : ''}
      <div style="overflow-x:auto">
      <table class="txn-table">
        <tr><th>When</th><th>Type</th><th>Detail</th><th>Amount</th><th>Status</th></tr>
        ${txns.length ? txns.map(t => `
          <tr>
            <td class="muted">${new Date(t.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
            <td><b>${t.type}</b> <span class="muted small">${esc(t.method || '')}</span></td>
            <td class="muted small">${esc(t.note || '')}</td>
            <td class="${t.amountCents >= 0 ? 'pos' : 'neg'}">${t.amountCents >= 0 ? '+' : ''}${fmtGHS(t.amountCents)}${t.payoutCents > 0 ? ` <span class="pos small">→ payout ${fmtGHS(t.payoutCents)}</span>` : ''}</td>
            <td><span class="badge ${t.status}">${t.status}</span></td>
          </tr>`).join('') : '<tr><td colspan="5" class="muted center" style="padding:20px">No transactions yet</td></tr>'}
      </table>
      </div>
    </div>
  </div>`;

  const body = GC.el('payBody');
  const tabs = app.querySelectorAll('.pay-tab');
  tabs.forEach(t => t.onclick = () => { tabs.forEach(x => x.classList.remove('active')); t.classList.add('active'); renderTab(t.dataset.tab); });

  function chipRow(inputEl) {
    return `<div class="chip-btns">${[5, 10, 25, 50, 100, 500].map(v => `<div class="chip c${v}" onclick="document.getElementById('${inputEl}').value=${v}">${v}</div>`).join('')}</div>`;
  }

  function renderTab(tab) {
    if (tab === 'momo') {
      body.innerHTML = `
        <h3 class="gold-text mb">📱 Mobile Money deposit</h3>
        <div class="form-grid">
          <div class="full"><label>MoMo provider</label>
            <select id="mProvider">${GC.meta.momo.map(m => `<option>${m}</option>`).join('')}</select>
          </div>
          <div class="full"><label>MoMo number</label><input id="mNumber" placeholder="0244123456" value="${esc(GC.user.phone || '')}"></div>
          <div class="full"><label>Amount (₵)</label><input id="mAmount" type="number" min="5" value="50">
          <div class="field-hint">Min ₵${rates.minDeposit}. You'll get a PIN prompt on your phone.</div>
          ${chipRow('mAmount')}</div>
        </div>
        <button class="btn block mt2" id="mGo">Deposit via MoMo</button>
        <div id="mResult"></div>`;
      GC.el('mGo').onclick = async () => {
        try {
          const d = await api('/wallet/deposit', { body: { method: 'momo', amount: +GC.el('mAmount').value, provider: GC.el('mProvider').value, momoNumber: GC.el('mNumber').value } });
          GC.user = d.user;
          GC.el('mResult').innerHTML = `<div class="success-box">✅ ${esc(d.instructions)}</div>`;
          updateBalanceChip();
          toast('MoMo deposit credited 🎉', 'success');
          setTimeout(() => route('wallet') && render(), 1400);
        } catch (e) { GC.el('mResult').innerHTML = `<div class="error-box">${esc(e.message)}</div>`; }
      };
    } else if (tab === 'card') {
      body.innerHTML = `
        <h3 class="gold-text mb">💳 Visa / Mastercard deposit</h3>
        <div class="form-grid">
          <div class="full"><label>Cardholder name</label><input id="cHolder" placeholder="KWAME MENSAH"></div>
          <div class="full"><label>Card number</label><input id="cNumber" placeholder="4242 4242 4242 4242" maxlength="19"></div>
          <div><label>Expiry</label><input id="cExp" placeholder="MM/YY" maxlength="5"></div>
          <div><label>CVV</label><input id="cCvv" placeholder="123" maxlength="4" type="password"></div>
          <div class="full"><label>Amount (₵)</label><input id="cAmount" type="number" min="5" value="100">
          <div class="field-hint">Min ₵${rates.minDeposit} • 1.5% card fee. 3-D Secure protected.</div>
          ${chipRow('cAmount')}</div>
        </div>
        <button class="btn block mt2" id="cGo">Deposit via Card</button>
        <div id="cResult"></div>`;
      const nEl = GC.el('cNumber');
      nEl.oninput = () => { nEl.value = nEl.value.replace(/[^\d]/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19); };
      const eEl = GC.el('cExp');
      eEl.oninput = () => { eEl.value = eEl.value.replace(/[^\d]/g, '').replace(/(\d{2})(\d)/, '$1/$2').slice(0, 5); };
      GC.el('cGo').onclick = async () => {
        try {
          const d = await api('/wallet/deposit', { body: { method: 'card', amount: +GC.el('cAmount').value, cardNumber: GC.el('cNumber').value, expiry: GC.el('cExp').value, cvv: GC.el('cCvv').value, cardHolder: GC.el('cHolder').value } });
          GC.user = d.user;
          GC.el('cResult').innerHTML = `<div class="success-box">✅ ${esc(d.instructions)}</div>`;
          updateBalanceChip();
          toast('Card deposit credited 🎉', 'success');
          setTimeout(() => render(), 1400);
        } catch (e) { GC.el('cResult').innerHTML = `<div class="error-box">${esc(e.message)}</div>`; }
      };
    } else if (tab === 'crypto') {
      const nets = GC.meta.cryptoNetworks;
      body.innerHTML = `
        <h3 class="gold-text mb">₿ Crypto deposit</h3>
        <div class="info-box small">1 USDT ≈ ₵${rates.usdtToGhs}. Credited after 3 network confirmations.</div>
        <div class="form-grid">
          <div class="full"><label>Network</label><select id="kNet">${nets.map(n => `<option>${n}</option>`).join('')}</select></div>
          <div class="full"><label>You send (USDT / BTC)</label><input id="kAmount" type="number" step="any" placeholder="50" value="50">
          <div class="field-hint">Equivalent credit: <b id="kEquiv">₵770.00</b></div></div>
        </div>
        <button class="btn block" id="kGo">Get Deposit Address</button>
        <div id="kResult"></div>`;
      const upd = () => {
        const a = +GC.el('kAmount').value || 0;
        const net = GC.el('kNet').value;
        GC.el('kEquiv').textContent = fmtGHS(Math.round(a * (net.startsWith('USDT') ? rates.usdtToGhs : 650000) * 100));
      };
      GC.el('kAmount').oninput = upd; GC.el('kNet').onchange = upd; upd();
      GC.el('kGo').onclick = async () => {
        try {
          const d = await api('/wallet/deposit', { body: { method: 'crypto', amount: 100, network: GC.el('kNet').value, cryptoAmount: +GC.el('kAmount').value } });
          GC.user = d.user;
          GC.el('kResult').innerHTML = `<div class="success-box">✅ ${esc(d.instructions)}<div class="mt"><b>Address:</b> <code>${esc(d.txn.meta.address)}</code></div></div>`;
          updateBalanceChip();
        } catch (e) { GC.el('kResult').innerHTML = `<div class="error-box">${esc(e.message)}</div>`; }
      };
    } else if (tab === 'withdraw') {
      body.innerHTML = `
        <h3 class="gold-text mb">🏧 Withdraw winnings</h3>
        ${GC.user.kycStatus !== 'approved' ? `
          <div class="error-box">🪪 <b>KYC required.</b> Payouts only go to verified players — <a class="link" style="cursor:pointer" onclick="nav('kyc')">complete verification now</a>.</div>
        ` : `
        <div class="form-grid">
          <div class="full"><label>Payout method</label>
            <select id="wMethod">
              <option value="momo">📱 Mobile Money (instant)</option>
              <option value="bank">🏦 Bank transfer (1-2 days)</option>
              <option value="crypto">₿ Crypto (USDT/BTC)</option>
            </select>
          </div>
          <div class="full" id="wExtra"></div>
          <div class="full"><label>Amount (₵)</label><input id="wAmount" type="number" min="${rates.minWithdraw}" value="50">
          <div class="field-hint">Min ₵${rates.minWithdraw} • ${rates.withdrawFeePct}% fee • processed within 24h after AML review</div></div>
        </div>
        <button class="btn green block mt2" id="wGo">Request Withdrawal</button>
        <div id="wResult"></div>`}
        ${GC.meta.mode === 'sandbox' ? `<div class="divider"></div><button class="btn secondary block" id="sandboxTop">🧪 +₵500 sandbox play credits</button>` : ''}`;
      const wExtra = GC.el('wExtra');
      const renderExtra = () => {
        const m = GC.el('wMethod') ? GC.el('wMethod').value : 'momo';
        if (m === 'momo') wExtra.innerHTML = `<label>Provider</label><select id="wProv">${GC.meta.momo.map(x => `<option>${x}</option>`).join('')}</select><label>MoMo number</label><input id="wNum" value="${esc(GC.user.phone || '')}">`;
        else if (m === 'bank') wExtra.innerHTML = `<label>Bank</label><select id="wBank"><option>GCB Bank</option><option>Ecobank Ghana</option><option>ABS Bank</option><option>Fidelity Bank</option><option>Stanbic Bank</option><option>CalBank</option><option>Access Bank</option><option>ADB</option></select><label>Account number</label><input id="wAcc" placeholder="1234567890123"><label>Account name</label><input id="wName" value="${esc(GC.user.fullName || '')}">`;
        else wExtra.innerHTML = `<label>Network</label><select id="wNet">${GC.meta.cryptoNetworks.map(x => `<option>${x}</option>`).join('')}</select><label>Your wallet address</label><input id="wAddr" placeholder="T... / 0x... / bc1...">`;
      };
      if (GC.el('wMethod')) { GC.el('wMethod').onchange = renderExtra; renderExtra(); }
      if (GC.el('wGo')) GC.el('wGo').onclick = async () => {
        const m = GC.el('wMethod').value;
        const payload = { amount: +GC.el('wAmount').value, method: m };
        if (m === 'momo') { payload.provider = GC.el('wProv').value; payload.momoNumber = GC.el('wNum').value; }
        if (m === 'bank') { payload.bankName = GC.el('wBank').value; payload.accountNumber = GC.el('wAcc').value; payload.accountName = GC.el('wName').value; }
        if (m === 'crypto') { payload.network = GC.el('wNet').value; payload.walletAddress = GC.el('wAddr').value; }
        try {
          const d = await api('/wallet/withdraw', { body: payload });
          GC.user = d.user;
          GC.el('wResult').innerHTML = `<div class="success-box">✅ Withdrawal requested — ${esc(d.eta)}. Track it in history above.</div>`;
          updateBalanceChip();
        } catch (e) { GC.el('wResult').innerHTML = `<div class="error-box">${esc(e.message)}</div>`; }
      };
      if (GC.el('sandboxTop')) GC.el('sandboxTop').onclick = async () => {
        try {
          const d = await api('/wallet/sandbox-topup', { body: {} });
          GC.user = d.user; updateBalanceChip();
          toast('+₵500 sandbox credits added 🧪', 'success');
          render();
        } catch (e) { toast(e.message, 'error'); }
      };
    }
  }
  renderTab('momo');
});

/* ============ VIEW: KYC wizard ============ */
route('kyc', async (app) => {
  if (!GC.user) return nav('login');
  let st = { status: GC.user.kycStatus, doc: null, selfie: null };
  try { st = await api('/kyc/status', { silent: true }); } catch {}

  if (st.status === 'approved') {
    app.innerHTML = `<div class="container tight" style="padding-top:50px"><div class="card center">
      <div style="font-size:52px">✅</div>
      <h2 class="gold-text">You're verified!</h2>
      <p class="muted mb">Tier ${GC.user.kycTier} — deposits up to ₵${(GC.user.kycTier === 3 ? 250000 : 50000).toLocaleString()} and withdrawals unlocked.</p>
      <button class="btn" onclick="nav('wallet')">Go to Cashier</button>
    </div></div>`;
    return;
  }

  const step = st.status === 'pending' ? 4 : (!st.fullName || !st.dob) ? 1 : (!st.doc) ? 2 : 3;
  app.innerHTML = `
  <div class="container tight" style="padding-top:40px">
    <div class="card">
      <h2 class="gold-text">🪪 Identity verification</h2>
      <p class="muted small mb">Required for withdrawals (GCG AML standard). Takes ~2 minutes.</p>
      <div class="steps">
        <div class="step-pill ${step >= 1 ? (step > 1 ? 'done' : 'active') : ''}">1 • Your details</div>
        <div class="step-pill ${step >= 2 ? (step > 2 ? 'done' : 'active') : ''}">2 • ID document</div>
        <div class="step-pill ${step >= 3 ? (step > 3 ? 'done' : 'active') : ''}">3 • Selfie</div>
        <div class="step-pill ${step >= 4 ? 'done' : ''}">4 • Review</div>
      </div>
      <div id="kycBody"></div>
    </div>
  </div>`;

  const body = GC.el('kycBody');

  if (step === 1) {
    body.innerHTML = `
      <form id="kyc1">
        <label>Full legal name *</label><input id="kyName" value="${esc(st.fullName || GC.user.fullName || '')}" placeholder="Kwame Mensah">
        <div class="form-grid">
          <div><label>Phone *</label><input id="kyPhone" value="${esc(st.phone || GC.user.phone || '')}" placeholder="0244123456"></div>
          <div><label>Date of birth *</label><input id="kyDob" type="date" max="${new Date(Date.now() - 18 * 31557600000).toISOString().slice(0, 10)}"></div>
          <div><label>Address</label><input id="kyAddr" placeholder="12 Osu Badu St, Accra"></div>
          <div><label>City</label><input id="kyCity" placeholder="Accra"></div>
        </div>
        <button class="btn block mt2" type="submit">Continue →</button>
      </form>`;
    GC.el('kyc1').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api('/kyc/submit-info', { body: { fullName: GC.el('kyName').value, phone: GC.el('kyPhone').value, dob: GC.el('kyDob').value, address: GC.el('kyAddr').value, city: GC.el('kyCity').value } });
        toast('Details saved', 'success'); render();
      } catch (err) { toast(err.message, 'error'); }
    };
  } else if (step === 2) {
    body.innerHTML = `
      <form id="kyc2">
        <label>Document type *</label>
        <select id="kyDoc"><option value="ghana_card">🇬🇭 Ghana Card</option><option value="passport">Passport</option><option value="drivers_licence">Driver's Licence</option></select>
        <label>ID number *</label><input id="kyIdNum" placeholder="GHA-123456789-0">
        <label>Front photo *</label>
        <div class="dropzone" id="kyDrop">
          <div style="font-size:34px">📤</div>
          <b>Tap to upload ID photo</b>
          <div class="muted small">JPG/PNG/WebP, max 5MB — all corners visible, no glare</div>
          <input type="file" id="kyFile" accept="image/*" hidden>
          <img id="kyPrev" class="preview-img" hidden>
        </div>
        <button class="btn block mt2" type="submit" id="ky2btn" disabled>Upload & Continue →</button>
      </form>`;
    const drop = GC.el('kyDrop'), fileEl = GC.el('kyFile'), prev = GC.el('kyPrev'), btn = GC.el('ky2btn');
    let picked = null;
    drop.onclick = () => fileEl.click();
    fileEl.onchange = () => {
      picked = fileEl.files[0];
      if (picked) { prev.src = URL.createObjectURL(picked); prev.hidden = false; btn.disabled = false; }
    };
    GC.el('kyc2').onsubmit = async (e) => {
      e.preventDefault();
      if (!picked) return toast('Choose a photo first', 'error');
      const fd = new FormData();
      fd.append('docType', GC.el('kyDoc').value);
      fd.append('idNumber', GC.el('kyIdNum').value);
      fd.append('document', picked, picked.name);
      btn.disabled = true; btn.textContent = 'Uploading…';
      try {
        await api('/kyc/upload-doc', { body: fd });
        toast('Document uploaded', 'success'); render();
      } catch (err) { toast(err.message, 'error'); btn.disabled = false; btn.textContent = 'Upload & Continue →'; }
    };
  } else if (step === 3) {
    body.innerHTML = `
      <form id="kyc3">
        <label>Selfie *</label>
        <div class="dropzone" id="sfDrop">
          <div style="font-size:34px">🤳</div>
          <b>Tap to take / upload a selfie</b>
          <div class="muted small">Face clearly visible, good lighting, no sunglasses</div>
          <input type="file" id="sfFile" accept="image/*" hidden>
          <img id="sfPrev" class="preview-img" hidden>
        </div>
        <button class="btn block mt2" type="submit" id="ky3btn" disabled>Submit for review →</button>
      </form>`;
    const drop = GC.el('sfDrop'), fileEl = GC.el('sfFile'), prev = GC.el('sfPrev'), btn = GC.el('ky3btn');
    let picked = null;
    drop.onclick = () => fileEl.click();
    fileEl.onchange = () => { picked = fileEl.files[0]; if (picked) { prev.src = URL.createObjectURL(picked); prev.hidden = false; btn.disabled = false; } };
    GC.el('kyc3').onsubmit = async (e) => {
      e.preventDefault();
      if (!picked) return toast('Add a selfie first', 'error');
      const fd = new FormData();
      fd.append('selfie', picked, picked.name);
      btn.disabled = true; btn.textContent = 'Submitting…';
      try {
        await api('/kyc/selfie', { body: fd });
        toast('Submitted for review 🎉', 'success'); render();
      } catch (err) { toast(err.message, 'error'); btn.disabled = false; btn.textContent = 'Submit for review →'; }
    };
  } else {
    body.innerHTML = `
      <div class="info-box">🔎 <b>Under review.</b> Our compliance team checks your documents (usually under 2 hours in sandbox; instant in live mode with automated ID-VU checks).</div>
      <div class="divider"></div>
      <p class="muted small">Submitted: ${esc(st.doc ? st.doc.type : '')} ${esc(st.doc ? st.doc.idNumber : '')}</p>
      <p class="muted small mt">You can keep playing while we verify. Withdrawals unlock automatically once approved.</p>
      <button class="btn secondary block mt2" onclick="nav('lobby')">Back to games 🎲</button>`;
  }
});
