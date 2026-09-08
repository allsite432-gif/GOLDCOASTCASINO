// GoldCoast Live Casino — configuration
const path = require('path');

const MODE_SANDBOX = 'sandbox'; // play credits, simulated payments
const MODE_LIVE = 'live';       // requires licensed PSP webhooks + GCG licence (see docs/GO-LIVE-CHECKLIST.md)

module.exports = {
  PORT: process.env.PORT || 3000,
  MODE: process.env.CASINO_MODE || MODE_SANDBOX,
  // sign session tokens (change in production, store in env)
  TOKEN_SECRET: process.env.TOKEN_SECRET || 'goldcoast-dev-secret-change-me',

  DATA_DIR: path.join(__dirname, 'data'),
  UPLOAD_DIR: path.join(__dirname, 'data', 'uploads'),

  DB_FILE: 'db.json',
  SESSION_HOURS: 24 * 7,

  // wallet
  CURRENCY: 'GHS',
  MIN_DEPOSIT: 5,          // GHS
  MAX_DEPOSIT: 20000,      // GHS per transaction (sandbox cap)
  MIN_WITHDRAW: 20,        // GHS
  WITHDRAW_FEE_PCT: 1,     // 1% payout fee
  DAILY_WITHDRAW_LIMIT: 50000,

  // welcome / play credits
  SANDBOX_START_BALANCE: 1000, // ₵1,000 play credit on signup (sandbox only)

  // KYC tiers (Ghana)
  KYC_TIERS: {
    1: { name: 'Unverified', depositLimit: 500, withdrawLimit: 0 },
    2: { name: 'Verified',   depositLimit: 50000, withdrawLimit: 50000 },
    3: { name: 'VIP',        depositLimit: 250000, withdrawLimit: 250000 }
  },

  // game maths
  GAMES: {
    roulette: { edge: 0.027 },   // single-zero European wheel
    blackjack: { edge: 0.005 },  // 3:2 blackjack, dealer stands 17
    dice: { edge: 0.01 },
    mines: { edge: 0.01 },
    crash: { edge: 0.01, houseEdgeDivisor: 100 }
  },

  // crash rounds
  CRASH: {
    ROUND_MS: 16000,       // total round duration incl. betting
    BETTING_MS: 7000,      // betting window
    PAUSE_MS: 3000         // result display
  },

  // roulette rounds
  ROULETTE: {
    ROUND_MS: 22000,       // full round
    BETTING_MS: 14000,     // betting window
    SPIN_MS: 5000,         // wheel animation window
    PAUSE_MS: 4000         // result display before next round
  },

  // payments (sandbox simulators; live keys supplied via env in production)
  PAYMENTS: {
    momo: { providers: ['MTN MoMo', 'AirtelTigo Cash', 'Telecel Cash'], feePct: 0, instant: true },
    card: { providers: ['Visa', 'Mastercard'], feePct: 1.5, instant: true },
    crypto: { networks: { 'USDT-TRC20': 1, 'USDT-BEP20': 1, 'BTC': 1 }, usdtToGhs: 15.4, minConfirmations: 3 }
  },

  ADMIN_USER: 'admin', // initial admin username (password set on first boot)
  ADMIN_INIT_PASSWORD: process.env.ADMIN_PASSWORD || 'GoldCoast@2026'
};
