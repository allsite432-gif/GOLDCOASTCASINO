/* GoldCoast — game views: live roulette, live crash, blackjack, dice, mines */
const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED_SET = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function colorOf(n) { return n === 0 ? 'green' : RED_SET.has(n) ? 'red' : 'black'; }

/* stake widget (shared) */
function stakeWidget(prefix, def = 10) {
  return `
    <label>Stake (₵)</label>
    <div class="stake-row">
      <input id="${prefix}Amt" type="number" min="1" step="any" value="${def}">
      <button class="btn secondary small" type="button" onclick="halfStake('${prefix}')">½</button>
      <button class="btn secondary small" type="button" onclick="dblStake('${prefix}')">2×</button>
      <button class="btn secondary small" type="button" onclick="maxStake('${prefix}')">MAX</button>
    </div>
    <div class="chip-btns">${[5,10,25,50,100].map(v => `<div class="chip c${v}" onclick="setStake('${prefix}',${v})">${v}</div>`).join('')}</div>`;
}
window.halfStake = p => { const e = GC.el(p + 'Amt'); e.value = Math.max(1, (e.value / 2)).toFixed(2); };
window.dblStake = p => { const e = GC.el(p + 'Amt'); e.value = (e.value * 2).toFixed(2); };
window.maxStake = p => { const e = GC.el(p + 'Amt'); e.value = ((GC.user ? GC.user.balanceCents : 0) / 100).toFixed(2); };
window.setStake = (p, v) => { GC.el(p + 'Amt').value = v; };

function needLogin() { if (!GC.user) { toast('Login to play 🔐'); nav('login'); return true; } return false; }

/* ================= LIVE ROULETTE ================= */
route('roulette', async (app) => {
  app.innerHTML = `
  <div class="container">
    <div class="game-shell">
      <div>
        <div class="card">
          <div class="card-title"><h2>🎲 Live Roulette</h2><span class="live-dot">LIVE</span></div>
          <div class="phase-banner" id="rlPhase">…</div>
          <div id="rlCountdown" style="font-size:26px;font-weight:900;color:var(--gold2);font-variant-numeric:tabular-nums"></div>
          <div class="history-strip mt" id="rlHistory"></div>
          <div class="divider"></div>
          ${stakeWidget('rl')}
          <div class="info-box small mt">Click the board to place chips. Red/black & even-money pay 2×, dozens/columns 3×, straight-ups 36×.</div>
          <div id="rlMyBets" class="mt"></div>
          <button class="btn green block mt2" id="rlClear">Clear my bets</button>
        </div>
        <div class="card mt">
          <div class="card-title"><h2>👥 Players</h2></div>
          <div id="rlPlayers"><span class="muted small">Waiting for round…</span></div>
        </div>
      </div>
      <div>
        <div class="game-stage">
          <div class="wheel-wrap">
            <div id="rlWheel" style="transition: transform 4.6s cubic-bezier(.15,.65,.15,1); width:290px;height:290px;border-radius:50%;
              background: conic-gradient(#b91c1c 0 9.72deg, #171717 9.72deg 19.45deg, #b91c1c 19.45deg 29.16deg, #171717 29.16deg 38.9deg, #15803d 38.9deg 48.6deg, #171717 48.6deg 58.3deg, #b91c1c 58.3deg 68.1deg, #171717 68.1deg 77.8deg, #b91c1c 77.8deg 87.5deg, #171717 87.5deg 97.2deg, #b91c1c 97.2deg 106.9deg, #171717 106.9deg 116.7deg, #b91c1c 116.7deg 126.4deg, #171717 126.4deg 136.1deg, #b91c1c 136.1deg 145.8deg, #171717 145.8deg 155.6deg, #b91c1c 155.6deg 165.3deg, #171717 165.3deg 175deg, #b91c1c 175deg 184.7deg, #171717 184.7deg 194.4deg, #b91c1c 194.4deg 204.2deg, #171717 204.2deg 213.9deg, #b91c1c 213.9deg 233.3deg, #171717 233.3deg 243deg, #b91c1c 243deg 252.8deg, #171717 252.8deg 262.5deg, #b91c1c 262.5deg 272.2deg, #171717 272.2deg 281.9deg, #b91c1c 281.9deg 291.7deg, #171717 291.7deg 301.4deg, #b91c1c 301.4deg 311.1deg, #171717 311.1deg 320.8deg, #b91c1c 320.8deg 330.6deg, #171717 330.6deg 340.3deg, #b91c1c 340.3deg 350deg, #171717 350deg 360deg);
              border: 10px solid #c9a227; box-shadow: 0 12px 40px rgba(0,0,0,.6), inset 0 0 30px rgba(0,0,0,.4); position:relative;">
              <div style="position:absolute;top:-6px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:11px solid transparent;border-right:11px solid transparent;border-top:22px solid var(--gold2);filter:drop-shadow(0 2px 3px #000);z-index:5"></div>
              <div style="position:absolute;inset:34%;background:radial-gradient(#8a6d1d,#3d2f0b);border-radius:50%;border:4px solid #c9a227;display:flex;align-items:center;justify-content:center;z-index:4">
                <div class="wheel-result" id="rlResult"></div>
              </div>
            </div>
          </div>
          <div class="center mt"><div id="rlBigResult" style="font-size:34px;font-weight:900"></div></div>
          <div class="mt2" id="rlBoard"></div>
        </div>
      </div>
    </div>
  </div>`;

  // betting board
  const board = GC.el('rlBoard');
  function cellCls(n) { return colorOf(n); }
  function boardHTML() {
    let nums = `<div style="display:grid;grid-template-columns:repeat(13,1fr);gap:3px">`;
    // row 1: 3,6,...36 ; row2: 2,5,...35 ; row3: 1,4,...34 ; zero spans
    const rows = [[3,6,9,12,15,18,21,24,27,30,33,36],[2,5,8,11,14,17,20,23,26,29,32,35],[1,4,7,10,13,16,19,22,25,28,31,34]];
    nums += `<div class="rb-number green" style="grid-row:1/4" data-bet="straight:0">0</div>`;
    rows.forEach((row, ri) => {
      row.forEach(n => {
        nums += `<div class="rb-number ${cellCls(n)}" data-bet="straight:${n}">${n}<span class="stake-badge" data-badge="straight:${n}" hidden></span></div>`;
      });
      nums += `<div class="rb-outside" style="grid-row:${ri+1}/${ri+2}" data-bet="column${ri+1}">2:1</div>`;
    });
    nums += `</div>`;
    const outside = `
      <div style="display:grid;grid-template-columns:repeat(13,1fr);gap:3px;margin-top:3px">
        <div class="rb-outside" style="grid-column:1/5" data-bet="dozen1">1st 12</div>
        <div class="rb-outside" style="grid-column:5/9" data-bet="dozen2">2nd 12</div>
        <div class="rb-outside" style="grid-column:9/13" data-bet="dozen3">3rd 12</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:3px;margin-top:3px">
        <div class="rb-outside" data-bet="low" style="background:#7f1d1d">1-18</div>
        <div class="rb-outside" data-bet="even">EVEN</div>
        <div class="rb-outside" data-bet="red" style="background:#b91c1c">RED</div>
        <div class="rb-outside" data-bet="black" style="background:#171717">BLACK</div>
        <div class="rb-outside" data-bet="odd">ODD</div>
        <div class="rb-outside" data-bet="high" style="background:#7f1d1d">19-36</div>
      </div>`;
    return nums + outside;
  }
  board.innerHTML = boardHTML();
  board.style.overflowX = 'auto';
  board.querySelectorAll('[data-bet]').forEach(el => {
    el.onclick = async () => {
      if (needLogin()) return;
      const amt = GC.el('rlAmt').value;
      const [type, val] = el.dataset.bet.split(':');
      try {
        const d = await api('/games/roulette/bet', { body: { amount: +amt, betType: type, betValue: val } });
        GC.user = d.user; updateBalanceChip();
        toast(`Bet placed: ${el.dataset.bet} ₵${amt}`, 'success');
        drawMyBets(d.myBets);
      } catch (e) { toast(e.message, 'error'); }
    };
  });
  function drawMyBets(bets) {
    const el = GC.el('rlMyBets');
    el.innerHTML = bets && bets.length ? `<b class="small gold-text">Your bets:</b><div class="mt small">${bets.map(b => `<span class="badge completed" style="margin:2px">${b.betType}${b.betValue !== undefined && b.betType === 'straight' ? ' ' + b.betValue : ''} — ${fmtGHS(b.amt)}</span>`).join('')}</div>` : '';
  }
  GC.el('rlClear').onclick = () => drawMyBets([]);

  // polling
  let lastRound = null;
  const poll = setInterval(async () => {
    try {
      const s = await api('/games/roulette/state', { silent: true });
      paint(s);
    } catch {}
  }, 900);
  onCleanup(() => clearInterval(poll));

  function paint(s) {
    const phase = GC.el('rlPhase');
    const cd = GC.el('rlCountdown');
    const res = GC.el('rlResult');
    const big = GC.el('rlBigResult');
    const wheel = GC.el('rlWheel');
    const left = Math.max(0, s.nextRoundAt - s.serverTime);

    if (s.phase === 'betting') {
      phase.innerHTML = `🎰 PLACE YOUR BETS`;
      cd.textContent = (left / 1000).toFixed(1) + 's';
      res.textContent = ''; big.textContent = '';
      if (lastRound !== s.roundId) { lastRound = s.roundId; wheel.style.transition = 'none'; wheel.style.transform = 'rotate(0deg)'; }
    } else if (s.phase === 'spinning') {
      phase.innerHTML = `🎡 NO MORE BETS — spinning`;
      cd.textContent = '';
      if (lastRound !== s.roundId + ':spin') {
        lastRound = s.roundId + ':spin';
        const idx = WHEEL_ORDER.indexOf(s.number ?? 0);
        // spin: rotate so that number lands at top marker; extra revolutions
        const target = 360 * 6 - (idx * (360 / 37));
        wheel.style.transition = 'transform 4.6s cubic-bezier(.15,.65,.15,1)';
        wheel.style.transform = `rotate(${target}deg)`;
      }
    } else if (s.phase === 'result') {
      phase.innerHTML = `✅ ROUND RESULT`;
      cd.textContent = '';
      const n = s.number;
      res.textContent = n; res.style.color = n === 0 ? '#4ade80' : RED_SET.has(n) ? '#f87171' : '#e5e7eb';
      big.innerHTML = `<span style="color:${n === 0 ? '#4ade80' : RED_SET.has(n) ? '#f87171' : '#d1d5db'}">${n} ${colorOf(n).toUpperCase()}</span>`;
    }

    // history
    GC.el('rlHistory').innerHTML = (s.history || []).map(h => `<div class="history-chip ${h.color}">${h.number}</div>`).join('');
    // players
    const pl = GC.el('rlPlayers');
    pl.innerHTML = s.bets.length ? s.bets.map(b => `<div class="player-row"><span>${esc(b.user)}</span><span class="muted small">${b.betType}${b.betType === 'straight' ? ' ' + b.betValue : ''}</span><b>${fmtGHS(b.amt)}</b></div>`).join('') : '<span class="muted small">No bets yet this round</span>';
  }
});

/* ================= LIVE CRASH ================= */
route('crash', async (app) => {
  app.innerHTML = `
  <div class="container">
    <div class="game-shell">
      <div>
        <div class="card">
          <div class="card-title"><h2>🚀 Crash</h2><span class="live-dot">LIVE</span></div>
          <div class="phase-banner" id="crPhase">…</div>
          <div id="crCountdown" style="font-size:22px;font-weight:900;color:var(--gold2);font-variant-numeric:tabular-nums"></div>
          <div class="history-strip mt" id="crHistory"></div>
          <div class="divider"></div>
          ${stakeWidget('cr')}
          <label>Auto cash-out at (×) — optional</label>
          <input id="crAuto" type="number" step="0.01" min="1.01" placeholder="e.g. 2.00">
          <button class="btn block mt2" id="crBetBtn">Place Bet</button>
          <button class="btn green block mt2" id="crCashBtn" hidden>💸 CASH OUT <span id="crCashVal"></span></button>
          <div class="info-box small mt">House edge 1% — provably fair. The multiplier you cash out at is what you're paid.</div>
        </div>
        <div class="card mt">
          <div class="card-title"><h2>👥 This round</h2><span class="muted small" id="crPot"></span></div>
          <div class="players-list" id="crPlayers"><span class="muted small">…</span></div>
        </div>
      </div>
      <div class="game-stage">
        <div class="crash-stage">
          <canvas id="crCanvas" class="crash-curve" width="760" height="380"></canvas>
          <div class="crash-mult waiting" id="crMult">—</div>
          <div class="muted" id="crSub" style="z-index:2">Waiting for next round…</div>
        </div>
      </div>
    </div>
  </div>`;

  const multEl = GC.el('crMult'), sub = GC.el('crSub'), phaseEl = GC.el('crPhase');
  const canvas = GC.el('crCanvas'), ctx = canvas.getContext('2d');
  let raf = null, points = [], lastPhase = null, myBet = false, cashedAt = null, state = null;

  function drawChart(mult, crashed) {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    // grid
    ctx.strokeStyle = 'rgba(255,255,255,.06)';
    for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const maxM = Math.max(2, mult * 1.15);
    const pts = points;
    if (pts.length > 1) {
      ctx.beginPath();
      pts.forEach((p, i) => {
        const x = (p.t / Math.max(1, pts[pts.length - 1].t)) * (W - 40) + 20;
        const y = H - 30 - ((p.m - 1) / (maxM - 1)) * (H - 70);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.lineWidth = 4;
      ctx.strokeStyle = crashed ? '#ef4444' : '#22c55e';
      ctx.shadowColor = crashed ? 'rgba(239,68,68,.6)' : 'rgba(34,197,94,.6)';
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  function loop() {
    if (!state || state.phase !== 'running') { raf = null; return; }
    const elapsed = state.serverTime - state.runStartAt + (Date.now() - state.fetchedAt);
    const m = Math.min(Math.exp(0.00007 * elapsed), state.crashAt || Infinity);
    multEl.textContent = m.toFixed(2) + '×';
    multEl.className = 'crash-mult flying';
    points.push({ t: elapsed, m });
    if (points.length > 400) points.shift();
    drawChart(m, false);
    // cashout value on button
    const cv = GC.el('crCashVal');
    if (myBet && !cashedAt && cv) cv.textContent = '@ ' + m.toFixed(2) + '×  (+' + fmtGHS(Math.round(myBetAmt * m) - myBetAmt) + ')';
    raf = requestAnimationFrame(loop);
  }

  let myBetAmt = 0;
  const poll = setInterval(async () => {
    try {
      state = await api('/games/crash/state', { silent: true });
      state.fetchedAt = Date.now();
      paint(state);
    } catch {}
  }, 700);
  onCleanup(() => { clearInterval(poll); if (raf) cancelAnimationFrame(raf); });

  function paint(s) {
    const left = Math.max(0, s.nextRoundAt - s.serverTime);
    if (s.phase !== lastPhase) {
      lastPhase = s.phase;
      points = [];
      if (s.phase === 'betting') { myBet = false; cashedAt = null; }
    }
    if (s.phase === 'betting') {
      phaseEl.innerHTML = '🔒 BETTING OPEN';
      GC.el('crCountdown').textContent = (left / 1000).toFixed(1) + 's to launch';
      multEl.textContent = 'Next round soon…';
      multEl.className = 'crash-mult waiting';
      sub.textContent = 'Place your bet — rocket launches when the timer hits 0';
      drawChart(1, false);
    } else if (s.phase === 'running') {
      phaseEl.innerHTML = '🚀 FLYING';
      GC.el('crCountdown').textContent = '';
      sub.textContent = '';
      if (!raf) raf = requestAnimationFrame(loop);
    } else {
      phaseEl.innerHTML = '💥 CRASHED';
      GC.el('crCountdown').textContent = 'next round in ' + (left / 1000).toFixed(1) + 's';
      const p = s.point;
      multEl.textContent = p.toFixed(2) + '×';
      multEl.className = 'crash-mult crashed';
      sub.textContent = cashedAt ? `You cashed out at ${cashedAt}× ✅` : (myBet ? 'You lost this round 💔' : 'Round over');
      drawChart(p, true);
    }
    GC.el('crHistory').innerHTML = (s.history || []).map(h => `<div class="history-chip" style="background:${h.point >= 2 ? '#052e16' : '#450a0a'};color:${h.point >= 2 ? '#4ade80' : '#f87171'}">${h.point.toFixed(2)}×</div>`).join('');
    // players
    const pl = GC.el('crPlayers');
    GC.el('crPot').textContent = s.players.length + ' players';
    pl.innerHTML = s.players.length ? s.players.map(p => `
      <div class="player-row">
        <span>${esc(p.user)}${p.user === (GC.user && GC.user.username) ? ' (you)' : ''}</span>
        <span class="muted">${fmtGHS(p.amt)}</span>
        ${p.status === 'cashed' ? `<span class="cashout">@${p.cashoutAt}× ✅</span>` : p.status === 'lost' ? '<span class="lost">lost 💥</span>' : '<span class="muted small">riding…</span>'}
      </div>`).join('') : '<span class="muted small">No players yet</span>';
    // buttons
    const betBtn = GC.el('crBetBtn'), cashBtn = GC.el('crCashBtn');
    const myActive = s.players.find(p => p.user === (GC.user && GC.user.username) && p.status === 'active');
    betBtn.hidden = !!myActive && s.phase !== 'betting';
    betBtn.disabled = s.phase !== 'betting';
    betBtn.textContent = s.phase === 'betting' ? 'Place Bet' : 'Wait for next round';
    cashBtn.hidden = !(myActive && s.phase === 'running');
    if (myActive) { myBet = true; myBetAmt = myActive.amt / 100; if (myActive.status === 'cashed') cashedAt = myActive.cashoutAt; }
  }

  GC.el('crBetBtn').onclick = async () => {
    if (needLogin()) return;
    try {
      const d = await api('/games/crash/bet', { body: { amount: +GC.el('crAmt').value, autoCashout: +GC.el('crAuto').value || undefined } });
      GC.user = d.user; updateBalanceChip(); myBet = true; myBetAmt = (+GC.el('crAmt').value);
      toast('Bet placed — see you at launch 🚀', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };
  GC.el('crCashBtn').onclick = async () => {
    try {
      const d = await api('/games/crash/cashout', { body: {} });
      GC.user = d.user; updateBalanceChip(); cashedAt = d.multiplier;
      toast(`Cashed out at ${d.multiplier}× — ${fmtGHS(d.payoutCents)} 💸`, 'success');
      GC.el('crCashBtn').hidden = true;
    } catch (e) { toast(e.message, 'error'); }
  };
});

/* ================= BLACKJACK ================= */
route('blackjack', async (app) => {
  app.innerHTML = `
  <div class="container mid">
    <div class="card">
      <div class="card-title"><h2>🃏 Blackjack</h2><span class="badge completed">3:2 • DEALER STANDS 17</span></div>
      <div class="bj-table">
        <div>
          <div class="bj-hand-label">Dealer <span class="hand-total" id="bjDealerTotal" hidden></span></div>
          <div class="bj-hand" id="bjDealer"><span class="muted small">—</span></div>
        </div>
        <div class="center mt">
          <div id="bjBanner" style="font-size:22px;font-weight:900;min-height:30px"></div>
        </div>
        <div>
          <div class="bj-hand-label">You <span class="hand-total" id="bjPlayerTotal" hidden></span></div>
          <div class="bj-hand" id="bjPlayer"><span class="muted small">—</span></div>
        </div>
      </div>
      <div class="mt">
        ${stakeWidget('bj')}
        <div class="bj-actions">
          <button class="btn" id="bjDeal">Deal Cards</button>
          <button class="btn green" id="bjHit" disabled>Hit</button>
          <button class="btn secondary" id="bjStand" disabled>Stand</button>
          <button class="btn secondary" id="bjDouble" disabled>Double</button>
        </div>
        <div class="info-box small mt">Blackjack pays 3:2 • wins pay 1:1 • push returns stake. Dealer stands on all 17s.</div>
      </div>
    </div>
  </div>`;

  function cardHTML(c) {
    if (c.r === 'hidden') return `<div class="playing-card hidden-card"><div class="corner">?</div><div class="suit-center">🂠</div></div>`;
    const red = c.s === '♥' || c.s === '♦';
    return `<div class="playing-card ${red ? 'red' : 'black'}"><div class="corner">${c.r}<br>${c.s}</div><div class="suit-center">${c.s}</div><div class="corner" style="align-self:flex-end;text-align:right;transform:rotate(180deg)">${c.r}<br>${c.s}</div></div>`;
  }
  function paint(hands, banner, cls) {
    if (hands) {
      GC.el('bjDealer').innerHTML = hands.dealer.map(cardHTML).join('');
      GC.el('bjPlayer').innerHTML = hands.player.map(cardHTML).join('');
      const dt = GC.el('bjDealerTotal'), pt = GC.el('bjPlayerTotal');
      if (hands.dealerTotal != null) { dt.hidden = false; dt.textContent = hands.dealerTotal; } else dt.hidden = true;
      if (hands.playerTotal != null) { pt.hidden = false; pt.textContent = hands.playerTotal + (hands.soft ? ' (soft)' : ''); } else pt.hidden = true;
    }
    const b = GC.el('bjBanner');
    b.textContent = banner || '';
    b.className = 'bj-result-banner ' + (cls || '');
  }
  function setBtns(inHand, canDouble) {
    GC.el('bjHit').disabled = !inHand;
    GC.el('bjStand').disabled = !inHand;
    GC.el('bjDouble').disabled = !(inHand && canDouble);
  }
  setBtns(false, false);

  GC.el('bjDeal').onclick = async () => {
    if (needLogin()) return;
    try {
      const d = await api('/games/blackjack/deal', { body: { amount: +GC.el('bjAmt').value } });
      GC.user = d.user; updateBalanceChip();
      if (d.outcome) { // natural settled instantly
        paint(d, d.outcome, d.payoutCents > d.wagerCents ? 'win' : d.payoutCents > 0 ? 'push' : 'lose');
        setBtns(false, false); refreshUser();
        toast(d.outcome, d.payoutCents > 0 ? 'success' : 'error');
      } else {
        paint(d, '', '');
        setBtns(true, GC.user.balanceCents >= d.wagerCents);
      }
    } catch (e) { toast(e.message, 'error'); }
  };
  GC.el('bjHit').onclick = async () => {
    try {
      const d = await api('/games/blackjack/hit', { body: {} });
      GC.user = d.user; updateBalanceChip();
      if (d.outcome) { paint(d, d.outcome, d.payoutCents > 0 ? 'win' : 'lose'); setBtns(false, false); toast(d.outcome, d.payoutCents > 0 ? 'success' : ''); }
      else { paint(d, '', ''); setBtns(true, false); }
    } catch (e) { toast(e.message, 'error'); }
  };
  GC.el('bjStand').onclick = async () => {
    try {
      const d = await api('/games/blackjack/stand', { body: {} });
      GC.user = d.user; updateBalanceChip();
      const cls = d.payoutCents > (d.wagerCents || 0) ? 'win' : d.payoutCents > 0 ? 'push' : 'lose';
      paint(d, d.outcome, cls); setBtns(false, false);
      toast(d.outcome, d.payoutCents > 0 ? 'success' : '');
    } catch (e) { toast(e.message, 'error'); }
  };
  GC.el('bjDouble').onclick = async () => {
    try {
      const d = await api('/games/blackjack/double', { body: {} });
      GC.user = d.user; updateBalanceChip();
      const cls = d.payoutCents > 0 ? 'win' : 'lose';
      paint(d, d.outcome, cls); setBtns(false, false);
      toast(d.outcome, d.payoutCents > 0 ? 'success' : '');
    } catch (e) { toast(e.message, 'error'); }
  };
});

/* ================= DICE ================= */
route('dice', async (app) => {
  app.innerHTML = `
  <div class="container mid">
    <div class="card">
      <div class="card-title"><h2>🎲 Dice</h2><span class="badge completed">1% EDGE</span></div>
      <div class="dice-stage">
        <div class="dice-roll-num" id="dcRoll">50.00</div>
        <div class="dice-track">
          <div class="fill" id="dcFill" style="width:50%"></div>
          <div class="dice-marker" id="dcMark" style="left:50%"></div>
        </div>
        <div class="muted small" id="dcInfo">Roll under 50 to win • payout 1.98×</div>
      </div>
      <div class="form-grid">
        <div>${stakeWidget('dc')}</div>
        <div>
          <label>Target: roll <b id="dcMode">under</b> <span id="dcTargetLbl">50</span></label>
          <div class="dice-slider-row">
            <input type="range" id="dcTarget" min="2" max="98" value="50">
            <button class="btn secondary small" id="dcToggle" type="button">⇄ Under/Over</button>
          </div>
          <div class="muted small" id="dcOdds">Win chance 50% • payout 1.98×</div>
        </div>
      </div>
      <button class="btn block mt2" id="dcRollBtn">🎲 ROLL</button>
    </div>
  </div>`;

  let over = false;
  const upd = () => {
    const t = +GC.el('dcTarget').value;
    GC.el('dcTargetLbl').textContent = t;
    GC.el('dcMark').style.left = t + '%';
    GC.el('dcFill').style.width = (over ? t : t) + '%';
    const chance = over ? (100 - t) : t;
    const payout = 0.99 / (chance / 100);
    GC.el('dcOdds').textContent = `Win chance ${chance}% • payout ${payout.toFixed(2)}×`;
    GC.el('dcInfo').textContent = `Roll ${over ? 'over' : 'under'} ${t} to win • payout ${payout.toFixed(2)}×`;
    GC.el('dcMode').textContent = over ? 'over' : 'under';
  };
  GC.el('dcTarget').oninput = upd;
  GC.el('dcToggle').onclick = () => { over = !over; upd(); };
  upd();

  GC.el('dcRollBtn').onclick = async () => {
    if (needLogin()) return;
    const btn = GC.el('dcRollBtn'); btn.disabled = true;
    try {
      const d = await api('/games/dice', { body: { amount: +GC.el('dcAmt').value, target: +GC.el('dcTarget').value, over } });
      GC.user = d.user; updateBalanceChip();
      // animate
      let i = 0;
      const anim = setInterval(() => {
        GC.el('dcRoll').textContent = (Math.random() * 100).toFixed(2);
        if (++i > 8) {
          clearInterval(anim);
          GC.el('dcRoll').textContent = d.roll.toFixed(2);
          GC.el('dcRoll').style.color = d.win ? '#4ade80' : '#f87171';
          toast(d.win ? `WIN ${d.multiplier}× — ${fmtGHS(d.payoutCents)} 🎉` : 'Rolled ' + d.roll.toFixed(2) + ' — no luck', d.win ? 'success' : 'error');
          setTimeout(() => { GC.el('dcRoll').style.color = ''; }, 1600);
        }
      }, 70);
    } catch (e) { toast(e.message, 'error'); }
    btn.disabled = false;
  };
});

/* ================= MINES ================= */
route('mines', async (app) => {
  app.innerHTML = `
  <div class="container mid">
    <div class="card">
      <div class="card-title"><h2>⛏️ Mines</h2><span class="badge completed">1% EDGE</span></div>
      <div class="center">
        <div class="mines-grid" id="mnGrid"></div>
        <div id="mnStatus" class="muted small" style="min-height:20px"></div>
        <div id="mnCash" style="min-height:34px;margin-top:6px"></div>
      </div>
      <div class="form-grid">
        <div>${stakeWidget('mn')}</div>
        <div>
          <label>Bombs 💣</label>
          <select id="mnBombs">
            <option>3</option><option>5</option><option>10</option><option>24</option>
          </select>
          <div class="field-hint">More bombs = riskier but bigger multipliers.</div>
        </div>
      </div>
      <button class="btn block mt2" id="mnStart">⛏️ Start Digging</button>
    </div>
  </div>`;

  const grid = GC.el('mnGrid');
  let active = false;

  function tiles(picked = [], bombTiles = null) {
    grid.innerHTML = '';
    for (let i = 0; i < 25; i++) {
      const d = document.createElement('div');
      d.className = 'mine-tile';
      d.dataset.i = i;
      if (picked.includes(i)) { d.classList.add('open', 'gem'); d.textContent = '💎'; }
      else if (bombTiles && bombTiles.includes(i)) { d.classList.add('open', 'bomb-tile'); d.textContent = '💣'; }
      else d.textContent = '';
      d.onclick = () => pick(i);
      grid.appendChild(d);
    }
  }
  tiles();

  async function checkActive() {
    try {
      const d = await api('/games/mines/active', { silent: true });
      if (d.active) {
        active = true;
        tiles(d.picked);
        GC.el('mnStart').hidden = true;
        GC.el('mnStatus').innerHTML = `${d.picked.length} gems • next: <b>${d.multiplier}×</b>`;
        GC.el('mnCash').innerHTML = d.picked.length ? `<button class="btn green" id="mnCashBtn">💸 Cash out ${fmtGHS(d.cashoutCents)}</button>` : '';
        if (GC.el('mnCashBtn')) GC.el('mnCashBtn').onclick = cashout;
      } else {
        active = false; GC.el('mnStart').hidden = false;
      }
    } catch {}
  }
  checkActive();

  GC.el('mnStart').onclick = async () => {
    if (needLogin()) return;
    try {
      const d = await api('/games/mines/start', { body: { amount: +GC.el('mnAmt').value, bombs: +GC.el('mnBombs').value } });
      GC.user = d.user; updateBalanceChip();
      active = true; tiles([]);
      GC.el('mnStart').hidden = true;
      GC.el('mnStatus').textContent = 'Pick a tile — first gem starts your multiplier';
    } catch (e) { toast(e.message, 'error'); }
  };

  async function pick(i) {
    if (!active) return toast('Start a game first ⛏️', 'error');
    try {
      const d = await api('/games/mines/pick', { body: { tile: i } });
      GC.user = d.user; updateBalanceChip();
      if (d.bomb) {
        active = false;
        // reveal: picked gems + all bombs
        const pickedGems = [];
        tiles(pickedGems, d.bombTiles);
        GC.el('mnStatus').innerHTML = `<b style="color:#f87171">💥 BOOM! — you lost ${fmtGHS(d.stakeCents)}</b>`;
        GC.el('mnCash').innerHTML = '';
        GC.el('mnStart').hidden = false;
        toast('Boom! 💥', 'error');
      } else if (d.cleared) {
        active = false;
        tiles(Array.from({ length: 25 }, (_, x) => x).filter(x => true), []);
        GC.el('mnStatus').innerHTML = `<b style="color:#4ade80">🏆 BOARD CLEARED! ${d.multiplier}× — ${fmtGHS(d.payoutCents)}</b>`;
        GC.el('mnCash').innerHTML = '';
        GC.el('mnStart').hidden = false;
        toast('Board cleared! 🏆', 'success');
      } else {
        // add gem tile
        const el = grid.querySelector(`[data-i="${i}"]`);
        el.classList.add('open', 'gem'); el.textContent = '💎'; el.onclick = null;
        GC.el('mnStatus').innerHTML = `${d.picks} gems • next cash-out: <b>${d.multiplier}×</b>`;
        GC.el('mnCash').innerHTML = `<button class="btn green" id="mnCashBtn">💸 Cash out ${fmtGHS(d.cashoutCents)}</button>`;
        GC.el('mnCashBtn').onclick = cashout;
      }
    } catch (e) { toast(e.message, 'error'); }
  }

  async function cashout() {
    try {
      const d = await api('/games/mines/cashout', { body: {} });
      GC.user = d.user; updateBalanceChip();
      active = false;
      GC.el('mnCash').innerHTML = `<b style="color:#4ade80">Cashed out ${d.multiplier}× — ${fmtGHS(d.payoutCents)} 💸</b>`;
      GC.el('mnStart').hidden = false;
      toast(`Cashed out ${d.multiplier}× 💸`, 'success');
      setTimeout(() => { GC.el('mnCash').innerHTML = ''; }, 3000);
    } catch (e) { toast(e.message, 'error'); }
  }
});
