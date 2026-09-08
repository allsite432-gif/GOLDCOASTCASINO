# 🎰 GoldCoast Live Casino — Ghana 🇬🇭

A complete, production-architecture live casino platform built for the Ghanaian market. Runs in **SANDBOX mode** by default (simulated payments, play credits) and is structured so a real-money launch requires only: (1) a Gaming Commission of Ghana licence, (2) real PSP integration, (3) a KYC vendor — see `docs/GO-LIVE-CHECKLIST.md`.

**Currency:** Ghana cedi (₵ / GHS) · **Zero npm dependencies** (pure Node.js 18+) · single process · JSON file persistence with atomic writes.

---

## Quick start

```bash
cd casino
node server.js          # http://localhost:3000
```

That's it — no `npm install`, no database. Data lives in `casino/data/db.json`, KYC documents in `casino/data/uploads/` (both auto-created on first boot — the repo ships with no data, and `casino/data/` is git-ignored so player accounts and KYC documents never get committed).

**Default admin:** `admin` / `GoldCoast@2026` (change immediately — see config).

| Environment | Effect |
|---|---|
| `CASINO_MODE=live` | Removes sandbox banners/top-ups, disables auto play credits (only set after licensing!) |
| `PORT=8080` | Listen port (default 3000) |

### Demo accounts (sandbox)
- **Player:** `kwame_test` / `secret123` — KYC-approved, has transaction history
- **New signups** get ₵1,000 spendable sandbox credits + ₵1,000 bonus instantly

---

## What's inside

### Player experience
- **Lobby** — live wins ticker, game cards, Ghana-flavoured dark/gold theme
- **Live Roulette 🎡** — shared European single-zero rounds every ~22s: animated wheel, full betting board (straight-ups, red/black, odd/even, high/low, dozens, columns), chip stacker, round history with revealed seed hashes
- **Live Crash 🚀** — shared rounds on a 400ms tick: canvas multiplier chart, manual or auto cash-out, live players list, provably-fair crash points (1% edge, bustabit-style formula)
- **Blackjack 🃏** — 3:2 blackjack, dealer stands all 17s, hit/stand/double
- **Dice 🎲** — roll under/over a target slider, 1% edge, up to 49.5× payout
- **Mines 💎** — 5×5 grid, choose 3/5/10/24 bombs, cumulative multiplier, cash out anytime
- **Cashier 💳** — deposits via **MTN MoMo / AirtelTigo Cash / Telecel Cash**, **Visa/Mastercard** (auto-detected, 1.5% fee shown), **USDT-TRC20 / USDT-BEP20 / BTC** (address + conversion at ₵15.4/USDT); withdrawals to MoMo, Ghana bank list, or crypto — all KYC-gated; full transaction ledger
- **KYC wizard 🪪** — personal info → Ghana Card (`GHA-XXXXXXXXX-X`) / passport / driver's licence upload → selfie; statuses: unverified → pending → approved/rejected with tiers gating limits (Tier 1 ₵500 · Tier 2 ₵50k · Tier 3 ₵250k)
- **Profile 👤** — password change, daily loss limit, self-exclusion (1–365 days)

### Operator console (`/admin`, admin role)
- **Overview** — players, KYC queue size, deposits, pending payouts, total wagered, paid out, **GGR**
- **KYC queue** — review submitted documents + selfie images, approve/reject with reasons
- **Withdrawals** — approve (mark paid) or reject (auto-refund)
- **Users** — search, manual balance adjustments (with ledger notes), seed reveal for provably-fair audits

### Platform
- **Provably fair:** server seed per round/user, SHA-256 pre-committed hash shown before each round, seed revealed after; `fairFloat(seed, clientSeed, nonce)` via HMAC-SHA256 drives dice, mines, roulette and crash
- **Money:** all amounts integer cents; atomic `tmp+rename` JSON persistence; full audit trail (`transactions`)
- **Security:** scrypt password hashing, HMAC-signed session tokens (HttpOnly cookie + Bearer), security headers, file-upload validation (type/size), admin route guards
- **Responsible gambling:** 18+ checks at registration & KYC, daily loss limits, self-exclusion that blocks login and betting, sandbox disclaimers everywhere
- **Tests:** `bash test/smoke.sh` — 39 API checks, all green

---

## Project layout

```
casino/
├── server.js              # HTTP server, static SPA, route registration
├── config.js              # mode, limits, game edges, payment rails, KYC tiers
├── src/
│   ├── router.js          # regex router + JSON/form/multipart body parsing
│   ├── store.js           # atomic JSON store
│   ├── util.js            # sha/hmac, scrypt, tokens, money, fairFloat, validators
│   ├── auth.js            # register/login/logout/me/password/limits/selfexclude
│   ├── wallet.js          # deposits, withdrawals, txns, rates, sandbox top-up
│   ├── kyc.js             # 3-step KYC + uploads
│   ├── games.js           # dice/mines/blackjack engines + bet guards
│   ├── live.js            # shared crash & roulette round loops (400ms tick)
│   └── admin.js           # stats, KYC review, payouts, users, adjust, seed reveal
├── public/                # SPA — index.html, css/theme.css, js/{core,wallet,games,account}.js, img/
├── data/                  # db.json + uploads/ (created at runtime)
├── test/smoke.sh          # 39-check API suite
└── tools/compress.py      # image compressor used for the assets
```

## API surface (summary)

`POST /api/auth/register · login · logout · password` · `GET /api/auth/me` · `POST /api/me/limits · selfexclude` · `POST /api/wallet/deposit · withdraw · sandbox-topup` · `GET /api/wallet/transactions · rates · crypto-address` · `POST /api/kyc/submit-info · upload-doc · selfie` · `GET /api/kyc/status` · `POST /api/games/dice/roll · mines/start · mines/pick · mines/cashout · blackjack/deal · hit · stand · double` · `GET /api/games/crash/state` · `POST /api/games/crash/bet · cashout` · `GET /api/games/roulette/state` · `POST /api/games/roulette/bet` · `GET /api/admin/stats · kyc · kyc/file/:f · withdrawals · users` · `POST /api/admin/kyc/review · withdrawals/process · adjust · reveal-seed` · `GET /api/feed · meta · health`

---

## Legal ⚖️

Operating a **real-money** casino in Ghana requires a **Gaming Commission of Ghana (GCG)** licence under the Gaming Act 721 (2006) — company registration with Ghanaian shareholding, BNI clearances for directors, ~US$50k application fee for casinos, 4–8 month process. Full details and the step-by-step go-live plan: **`docs/LEGAL-GHANA.md`** and **`docs/GO-LIVE-CHECKLIST.md`**.

**This repository ships in sandbox mode and takes no real money.** 18+ only. Gambling is addictive — play responsibly.
