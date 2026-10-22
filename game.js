'use strict';
/* =====================================================================
   BUSINESS TYCOON — a browser business simulator
   Routes to riches: stocks, crypto, restaurants, scrapyard,
   real estate, banking... or stealing cars (and dodging the police).
   ===================================================================== */

/* ---------------------------- Utilities ---------------------------- */
const $ = (s, el = document) => el.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const chance = (p) => Math.random() < p;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function gauss() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function money(n, short = true) {
  const neg = n < 0; n = Math.abs(n);
  let s;
  if (short && n >= 1e12) s = (n / 1e12).toFixed(2) + 'T';
  else if (short && n >= 1e9) s = (n / 1e9).toFixed(2) + 'B';
  else if (short && n >= 1e6) s = (n / 1e6).toFixed(2) + 'M';
  else if (n < 100 && n % 1 !== 0) s = n.toFixed(2);
  else s = Math.round(n).toLocaleString('en-US');
  return (neg ? '-$' : '$') + s;
}
function price(n) {
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return '$' + n.toFixed(2);
  if (n >= 0.01) return '$' + n.toFixed(4);
  return '$' + n.toPrecision(3);
}
const pct = (n, d = 1) => (n * 100).toFixed(d) + '%';
const signPct = (n) => (n >= 0 ? '+' : '') + pct(n, 2);
const cls = (n) => (n > 0 ? 'good' : n < 0 ? 'bad' : 'muted');
const fmtQty = (n) => (n >= 1000 ? Math.round(n).toLocaleString('en-US') : n >= 1 ? n.toFixed(3) : n.toPrecision(4));

/* ---------------------------- Game data ---------------------------- */
const STOCKS = [
  { sym: 'APXL', name: 'Apexel Technologies', sector: 'Tech', price: 182, vol: 0.021, drift: 0.0006, div: 0 },
  { sym: 'NVLT', name: 'Novalight Semiconductors', sector: 'Tech', price: 415, vol: 0.03, drift: 0.0009, div: 0 },
  { sym: 'CLDN', name: 'Cloudnine Software', sector: 'Tech', price: 64, vol: 0.027, drift: 0.0005, div: 0 },
  { sym: 'PMRT', name: 'PrimeMart Retail', sector: 'Retail', price: 72, vol: 0.012, drift: 0.0003, div: 0.006 },
  { sym: 'KCKZ', name: 'Kickz Apparel', sector: 'Retail', price: 15.4, vol: 0.031, drift: 0.0002, div: 0 },
  { sym: 'BKHS', name: 'Brookhaven Bank', sector: 'Finance', price: 55, vol: 0.014, drift: 0.0003, div: 0.009 },
  { sym: 'MDCR', name: 'MediCore Pharma', sector: 'Health', price: 118, vol: 0.024, drift: 0.0004, div: 0.004 },
  { sym: 'GNMX', name: 'Genomix Bio', sector: 'Health', price: 9.8, vol: 0.045, drift: 0.0003, div: 0 },
  { sym: 'PTRX', name: 'Petrox Oil', sector: 'Energy', price: 88, vol: 0.017, drift: 0.0002, div: 0.012 },
  { sym: 'GRBX', name: 'GreenBox Solar', sector: 'Energy', price: 34, vol: 0.03, drift: 0.0006, div: 0 },
  { sym: 'VLTR', name: 'Voltra Motors', sector: 'Auto', price: 240, vol: 0.034, drift: 0.0007, div: 0 },
  { sym: 'SKWD', name: 'Skyward Aerospace', sector: 'Industrial', price: 146, vol: 0.018, drift: 0.0004, div: 0.005 },
  { sym: 'FDDX', name: 'FoodDash Delivery', sector: 'Consumer', price: 22, vol: 0.036, drift: 0.0003, div: 0 },
  { sym: 'GLDM', name: 'Goldmont Mining', sector: 'Materials', price: 41, vol: 0.02, drift: 0.0002, div: 0.007 },
];
const SECTORS = [...new Set(STOCKS.map((s) => s.sector))];
const STOCK_FEE = 4.95;

const CRYPTO = [
  { sym: 'BCN', name: 'Bitcorn', price: 42000, vol: 0.04, drift: 0.0012 },
  { sym: 'ETN', name: 'Etherion', price: 2800, vol: 0.05, drift: 0.0012 },
  { sym: 'SFL', name: 'SolarFlare', price: 95, vol: 0.07, drift: 0.0012 },
  { sym: 'LNK', name: 'Chainlinker', price: 14, vol: 0.065, drift: 0.001 },
  { sym: 'DGM', name: 'DogeMoon', price: 0.12, vol: 0.1, drift: 0.0006 },
  { sym: 'RUG', name: 'RugCoin', price: 0.004, vol: 0.16, drift: 0.002, rug: true },
];
const CRYPTO_FEE = 0.005;

const REST_TYPES = [
  { id: 'truck', name: 'Food Truck', icon: '🚚', cost: 4000, rent: 35, seats: 80, basePrice: 9, ingr: 3.2, demand: 70, maxStaff: 3, noWaiters: true },
  { id: 'cafe', name: 'Coffee Shop', icon: '☕', cost: 15000, rent: 90, seats: 180, basePrice: 6, ingr: 1.6, demand: 160, maxStaff: 7, cookMult: 1.6 },
  { id: 'diner', name: 'Diner', icon: '🍔', cost: 40000, rent: 200, seats: 220, basePrice: 16, ingr: 5.5, demand: 180, maxStaff: 11 },
  { id: 'sushi', name: 'Sushi Bar', icon: '🍣', cost: 120000, rent: 520, seats: 260, basePrice: 38, ingr: 13, demand: 190, maxStaff: 14, wageMult: 1.3 },
  { id: 'fine', name: 'Fine Dining', icon: '🍷', cost: 450000, rent: 1600, seats: 240, basePrice: 110, ingr: 34, demand: 170, maxStaff: 20, wageMult: 1.8 },
  { id: 'chain', name: 'Burger Franchise', icon: '🏪', cost: 900000, rent: 3500, seats: 2200, basePrice: 12, ingr: 3.6, demand: 2000, maxStaff: 30, noWaiters: true, cookMult: 3 },
];
const RT = Object.fromEntries(REST_TYPES.map((t) => [t.id, t]));
const ROLES = {
  cook: { name: 'Cook', icon: '👨‍🍳', wage: 110, desc: 'prepares ~45 meals/day' },
  waiter: { name: 'Waiter', icon: '🧑‍💼', wage: 85, desc: 'serves ~50 guests/day' },
  cleaner: { name: 'Cleaner', icon: '🧹', wage: 65, desc: '1 needed per ~150 guests' },
  manager: { name: 'Manager', icon: '📋', wage: 240, desc: '+12% efficiency, +reputation' },
};
const QUALITY = {
  cheap: { name: 'Budget', mult: 0.7, rep: -15 },
  std: { name: 'Standard', mult: 1, rep: 0 },
  prem: { name: 'Premium', mult: 1.6, rep: 15 },
};
const REST_NAMES = ['Golden Fork', 'Blue Plate', 'The Rusty Spoon', "Mama Rosa's", 'Smoke & Salt', 'Urban Bites', 'Saffron House', 'Lucky Dragon', 'Harbor Grill', 'Velvet Table', 'The Hungry Moose', 'Copper Pot', 'Night Owl', 'Sunny Side', 'Ember & Oak'];

const YARD_COST = 15000;
const YARD_LEVELS = [
  { cap: 6, cost: 0, speed: 1 },
  { cap: 12, cost: 25000, speed: 1.25 },
  { cap: 24, cost: 80000, speed: 1.5 },
  { cap: 50, cost: 250000, speed: 2 },
];
const YARD_WAGE = 95;
const JUNK = [
  { name: "'98 Full-size Pickup", kg: 1900, parts: 900, resale: 6500 },
  { name: "'03 Compact Hatchback", kg: 1200, parts: 700, resale: 4800 },
  { name: "'07 Midsize Sedan", kg: 1450, parts: 850, resale: 6200 },
  { name: "'89 Boxy Swedish Wagon", kg: 1350, parts: 450, resale: 3500 },
  { name: "'11 Economy Sedan", kg: 1400, parts: 650, resale: 5400 },
  { name: "'05 Big SUV", kg: 2400, parts: 1400, resale: 9800 },
  { name: "'01 Retro Bug", kg: 1250, parts: 600, resale: 4200 },
  { name: "'14 Hybrid Hatch", kg: 1400, parts: 1600, resale: 9200 },
  { name: "'95 Little Roadster", kg: 1000, parts: 900, resale: 7200 },
  { name: 'Retired School Bus', kg: 9500, parts: 2200, resale: 0 },
  { name: 'Wrecked Box Truck', kg: 5200, parts: 1500, resale: 0 },
];
const RARE_JUNK = { name: "'69 Muscle Car (barn find)", kg: 1500, parts: 2500, resale: 42000 };

const HOODS = [
  { id: 'ind', name: 'Industrial Park', sec: [1, 2], w: 3, cars: [['Beat-up Sedan', 2800], ['Compact Hatchback', 5200], ['Delivery Van', 7800], ['Old Pickup', 4500]] },
  { id: 'sub', name: 'Suburbs', sec: [1, 3], w: 3, cars: [['Family Minivan', 15000], ['Midsize SUV', 23000], ['Crew-cab Pickup', 29000], ['Hybrid Sedan', 19000]] },
  { id: 'down', name: 'Downtown', sec: [2, 4], w: 2.5, cars: [['Sport Coupe', 41000], ['Electric Hatch', 34000], ['Luxury Sedan', 58000], ['Classic Muscle Car', 66000]] },
  { id: 'up', name: 'Uptown', sec: [3, 5], w: 1.6, cars: [['German Executive Sedan', 92000], ['Performance SUV', 115000], ['Electric Super-Sedan', 130000]] },
  { id: 'hills', name: 'Billionaire Hills', sec: [4, 5], w: 0.8, cars: [['Italian Supercar', 290000], ['British Grand Tourer', 230000], ['Limited Hypercar', 1100000]] },
];
const TOOLS = [
  { id: 'slimjim', name: 'Slim Jim & Lock Picks', icon: '🔧', cost: 350, desc: '+8% success on ★1–2 cars' },
  { id: 'obd', name: 'OBD Key Programmer', icon: '💻', cost: 7500, desc: '+12% success on ★3+ cars' },
  { id: 'relay', name: 'Relay Attack Kit', icon: '📡', cost: 28000, desc: '+15% success on ★4+ cars' },
  { id: 'jammer', name: 'GPS Jammer', icon: '📵', cost: 12000, desc: 'Defeats trackers in stolen cars' },
  { id: 'lockup', name: 'Hidden Lock-up', icon: '🏚️', cost: 20000, desc: '+4 garage slots, −30% raid chance' },
  { id: 'lawyer', name: 'Lawyer on Retainer', icon: '⚖️', cost: 60000, desc: 'Halves all jail time and fines' },
];
const LOOKOUT_WAGE = 200;

const PROPS = [
  { id: 'studio', name: 'Studio Apartment', icon: '🏠', price: 60000, rent: 95 },
  { id: 'house', name: 'Suburban House', icon: '🏡', price: 220000, rent: 330 },
  { id: 'duplex', name: 'Duplex', icon: '🏘️', price: 480000, rent: 760 },
  { id: 'strip', name: 'Retail Strip Mall', icon: '🏬', price: 1500000, rent: 2450 },
  { id: 'office', name: 'Office Building', icon: '🏢', price: 6000000, rent: 9800 },
  { id: 'tower', name: 'Skyscraper', icon: '🌆', price: 40000000, rent: 66000 },
];
const PT = Object.fromEntries(PROPS.map((p) => [p.id, p]));

const LOAN_RATE = 0.0012;    // per day
const SAVINGS_RATE = 0.00025; // per day
const SPEEDS = [0, 6000, 3000, 1200];
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SAVE_KEY = 'business-tycoon-save-v1';

const ACH = [
  ['trade', '📈', 'First Trade', 'Buy your first stock or coin', () => S.stats.trades > 0],
  ['div', '💌', 'Dividend Collector', 'Receive a dividend payment', () => S.stats.divs > 0],
  ['whale', '🐳', 'Crypto Whale', 'Hold $250K worth of crypto', () => assets().crypto >= 250000],
  ['resto', '🍽️', 'Restaurateur', 'Open your first restaurant', () => S.restaurants.length > 0],
  ['resto3', '🏙️', 'Food Empire', 'Own 3 restaurants at once', () => S.restaurants.length >= 3],
  ['meals', '🥘', 'Fed the City', 'Serve 25,000 meals', () => S.stats.meals >= 25000],
  ['yard', '🐕', 'Junkyard Dog', 'Buy a scrapyard', () => S.yard.owned],
  ['scrap25', '🗜️', 'Crusher', 'Scrap 25 cars', () => S.stats.scrapped >= 25],
  ['flip', '🔁', 'Flipper', 'Repair & sell 5 cars', () => S.stats.flipped >= 5],
  ['landlord', '🔑', 'Landlord', 'Buy a property', () => S.props.length > 0],
  ['steal', '🚗', 'Grand Theft Auto', 'Steal your first car', () => S.stats.stolen > 0],
  ['steal20', '🕶️', 'Car Ring Boss', 'Steal 20 cars', () => S.stats.stolen >= 20],
  ['hyper', '💎', 'The Big Heist', 'Steal a car worth $500K+', () => S.stats.bigHeist],
  ['jail', '⛓️', 'Jailbird', 'Get arrested', () => S.crime.arrests > 0],
  ['nw25k', '🌱', 'Getting Started', 'Net worth of $25K', () => netWorth() >= 25000],
  ['nw100k', '💵', 'Six Figures', 'Net worth of $100K', () => netWorth() >= 1e5],
  ['nw1m', '💰', 'Millionaire', 'Net worth of $1M', () => netWorth() >= 1e6],
  ['nw10m', '🏦', 'Multi-Millionaire', 'Net worth of $10M', () => netWorth() >= 1e7],
  ['nw100m', '👑', 'Tycoon', 'Net worth of $100M', () => netWorth() >= 1e8],
  ['nw1b', '🚀', 'Billionaire', 'Net worth of $1B', () => netWorth() >= 1e9],
  ['clean', '😇', 'Clean Hands', 'Reach $1M without stealing a car', () => netWorth() >= 1e6 && S.stats.stolen === 0],
];

/* ---------------------------- State ---------------------------- */
let S;
const UI = {
  tab: 'dash', selStock: 'APXL', selCoin: 'BCN', stockQty: 10, cryptoAmt: 1000, bankAmt: 10000,
  charts: {}, pointerDown: false, pending: false, gameOver: false,
};

function seedHist(p, vol, drift, n = 90) {
  const h = [p];
  for (let i = 0; i < n; i++) { p = p / Math.exp(drift + vol * gauss()); h.unshift(p); }
  return h;
}

function newState() {
  const s = {
    version: 1, day: 1, cash: 5000, energy: 100, speed: 1, nextId: 1,
    stocks: {}, crypto: {}, marketMood: 0, cryptoMood: 0,
    restaurants: [],
    yard: { owned: false, level: 0, workers: 0, unpaid: 0, cars: [], metal: 0, metalPrice: 0.32, metalHist: [], offers: [], hotChop: 0, closed: 0 },
    garage: [],
    crime: { heat: 0, skill: 0, record: 0, arrests: 0, jail: 0, targets: [], tools: {}, lookout: false },
    bank: { loan: 0, savings: 0 },
    props: [], housing: 1, housingHist: [],
    ledger: {}, lastLedger: {}, history: [],
    log: [], ach: {}, seenIntro: false,
    stats: { trades: 0, divs: 0, meals: 0, scrapped: 0, flipped: 0, stolen: 0, bigHeist: false, crimeIncome: 0 },
  };
  for (const d of STOCKS) s.stocks[d.sym] = { price: d.price, hist: seedHist(d.price, d.vol, d.drift), qty: 0, cost: 0, shock: 0 };
  for (const d of CRYPTO) s.crypto[d.sym] = { price: d.price, hist: seedHist(d.price, d.vol, d.drift), qty: 0, cost: 0, shock: 0 };
  let m = 0.32;
  for (let i = 0; i < 60; i++) { m = clamp(m + 0.05 * (0.32 - m) + 0.012 * gauss(), 0.12, 0.8); s.yard.metalHist.push(m); }
  s.yard.metalPrice = m;
  let h = 1;
  for (let i = 0; i < 60; i++) { h *= Math.exp(0.0002 + 0.004 * gauss()); s.housingHist.push(h); }
  s.housing = h;
  return s;
}

/* ---------------------------- Money helpers ---------------------------- */
function book(cat, amt) { S.ledger[cat] = (S.ledger[cat] || 0) + amt; }
function earn(amt, cat) { S.cash += amt; book(cat, amt); }
function spend(amt, cat) { S.cash -= amt; book(cat, -amt); }
function canAfford(amt) { return S.cash >= amt - 1e-9; }
function useEnergy(n) {
  if (S.energy < n) { toast(`Not enough energy (need ${n}⚡). Rest until tomorrow.`, 'warn'); return false; }
  S.energy -= n; return true;
}
function log(msg, type = '') {
  S.log.unshift({ d: S.day, msg, type });
  if (S.log.length > 250) S.log.length = 250;
}

/* ---------------------------- Valuation ---------------------------- */
function restoValue(r) {
  const t = RT[r.type];
  return t.cost * 0.55 * (0.6 + r.rep / 100) * (1 + 0.25 * (r.level - 1));
}
function yardValue() {
  const y = S.yard;
  if (!y.owned) return 0;
  let v = YARD_COST * 0.6;
  for (let i = 1; i <= y.level; i++) v += YARD_LEVELS[i].cost * 0.5;
  v += y.metal * y.metalPrice;
  for (const c of y.cars) v += c.status === 'ready' ? c.resale * 0.9 : c.paid * 0.8;
  return v;
}
function propValue(p) { return PT[p.type].price * S.housing * p.mult; }
function assets() {
  const a = { cash: S.cash, savings: S.bank.savings, stocks: 0, crypto: 0, restaurants: 0, scrapyard: yardValue(), stolen: 0, property: 0, loan: -S.bank.loan };
  for (const k in S.stocks) a.stocks += S.stocks[k].qty * S.stocks[k].price;
  for (const k in S.crypto) a.crypto += S.crypto[k].qty * S.crypto[k].price;
  for (const r of S.restaurants) a.restaurants += restoValue(r);
  for (const c of S.garage) a.stolen += c.value * 0.4;
  for (const p of S.props) a.property += propValue(p);
  return a;
}
function netWorth() { return Object.values(assets()).reduce((x, y) => x + y, 0); }
function loanLimit() { return Math.max(15000, (netWorth() + S.bank.loan) * 0.5); }
const jailed = () => S.crime.jail > 0;
const dayName = (d = S.day) => WD[(d - 1) % 7];
const isWeekend = (d = S.day) => (d - 1) % 7 >= 5;

/* =====================================================================
   DAILY SIMULATION
   ===================================================================== */
function nextDay() {
  if (modalQ.length || UI.gameOver) return;
  updateMarkets();
  processRestaurants();
  processYard();
  processCrime();
  processBank();
  processProps();
  randomEvent();

  // overdraft gets rolled into the loan
  if (S.cash < 0) {
    S.bank.loan += -S.cash;
    log(`Overdraft of ${money(-S.cash)} was added to your bank loan.`, 'bad');
    toast(`Overdraft! ${money(-S.cash)} added to your loan.`, 'bad');
    S.cash = 0;
  }

  S.lastLedger = S.ledger;
  S.ledger = {};
  S.day++;
  if (S.crime.jail > 0) {
    S.crime.jail--;
    S.energy = 0;
    if (S.crime.jail === 0) { S.energy = 100; log('You were released from jail. Freedom!', 'good'); toast('Released from jail!', 'good'); }
  } else S.energy = 100;

  for (const r of S.restaurants) r.selfShift = false;
  genTargets();
  genOffers();

  const nw = netWorth();
  S.history.push(nw);
  if (S.history.length > 365) S.history.shift();

  checkAch();
  if (nw < -50000 && S.cash < 100 && !UI.gameOver) gameOver();
  save();
  render();
}

/* ---------------------------- Markets ---------------------------- */
const NEWS_GOOD = ['{n} smashes earnings expectations', '{n} unveils a breakthrough product', 'Analysts upgrade {n} to Strong Buy', '{n} wins a massive government contract', '{n} announces a huge share buyback', 'Rumors swirl of a takeover bid for {n}'];
const NEWS_BAD = ['{n} misses earnings badly', 'CEO of {n} resigns amid scandal', '{n} hit with antitrust lawsuit', 'Factory fire halts {n} production', 'Regulators open probe into {n}', '{n} issues profit warning'];
const SECTOR_NEWS = [
  ['Energy', 0.05, 'Oil prices surge after supply cuts'], ['Energy', -0.05, 'Oil glut sends energy prices tumbling'],
  ['Tech', 0.04, 'AI boom lifts tech stocks'], ['Tech', -0.05, 'Chip shortage hammers tech sector'],
  ['Health', 0.05, 'New healthcare bill boosts pharma'], ['Retail', -0.04, 'Consumer spending slumps'],
  ['Auto', 0.05, 'EV subsidies announced'], ['Finance', -0.04, 'Bank stress test failures rattle finance'],
  ['Materials', 0.05, 'Gold hits record high'],
];
const CRYPTO_GOOD = ['Major bank begins accepting {n}', '{n} listed on a giant exchange', 'Celebrity tweets about {n}', '{n} network upgrade succeeds'];
const CRYPTO_BAD = ['Exchange hack drains {n} wallets', 'Regulators threaten to ban {n}', '{n} founder sells huge stake', 'Network outage halts {n} for hours'];

function updateMarkets() {
  S.marketMood = S.marketMood * 0.9 + gauss() * 0.0035;
  S.cryptoMood = S.cryptoMood * 0.85 + gauss() * 0.01;
  const sec = Object.fromEntries(SECTORS.map((s) => [s, gauss() * 0.005]));

  // news
  if (chance(0.25)) {
    const d = pick(STOCKS), st = S.stocks[d.sym];
    const good = chance(0.5);
    const shock = (good ? 1 : -1) * rand(0.03, 0.09);
    st.shock += shock;
    log(`📰 ${(good ? pick(NEWS_GOOD) : pick(NEWS_BAD)).replace('{n}', d.name)} (${d.sym})`, good ? 'good' : 'bad');
  }
  if (chance(0.07)) {
    const [sector, shock, text] = pick(SECTOR_NEWS);
    for (const d of STOCKS) if (d.sector === sector) S.stocks[d.sym].shock += shock;
    log(`📰 ${text}`, shock > 0 ? 'good' : 'bad');
  }
  if (chance(0.02)) {
    const crash = chance(0.5);
    S.marketMood += crash ? -0.03 : 0.02;
    log(crash ? '📉 MARKET PANIC: Recession fears grip Wall Street!' : '🚀 Central bank cuts rates — markets rally!', crash ? 'bad' : 'good');
    toast(crash ? '📉 Market panic!' : '🚀 Market rally!', crash ? 'bad' : 'good');
  }
  if (chance(0.18)) {
    const d = pick(CRYPTO), st = S.crypto[d.sym];
    const good = chance(0.5);
    st.shock += (good ? 1 : -1) * rand(0.06, 0.18);
    log(`🪙 ${(good ? pick(CRYPTO_GOOD) : pick(CRYPTO_BAD)).replace('{n}', d.name)}`, good ? 'good' : 'bad');
  }

  for (const d of STOCKS) {
    const st = S.stocks[d.sym];
    const r = d.drift + S.marketMood + sec[d.sector] + d.vol * gauss() + st.shock;
    st.shock *= 0.45;
    st.price = Math.max(0.5, st.price * Math.exp(r));
    st.hist.push(st.price);
    if (st.hist.length > 180) st.hist.shift();
  }
  for (const d of CRYPTO) {
    const st = S.crypto[d.sym];
    let r = d.drift + S.cryptoMood * (d.sym === 'BCN' ? 0.8 : 1.2) + d.vol * gauss() + st.shock;
    st.shock *= 0.5;
    if (d.rug) {
      if (chance(0.012)) { r -= 2.5; log('🪤 RugCoin developers vanished with the liquidity. RUG crashes 90%!', 'bad'); if (st.qty) toast('RugCoin got rugged! -90%', 'bad'); }
      else if (chance(0.02)) { r += 0.7; log('🚀 RugCoin is mooning on social media!', 'good'); }
    }
    st.price = Math.max(1e-7, st.price * Math.exp(r));
    st.hist.push(st.price);
    if (st.hist.length > 180) st.hist.shift();
  }

  // quarterly dividends
  if (S.day % 30 === 0) {
    let total = 0;
    for (const d of STOCKS) {
      const st = S.stocks[d.sym];
      if (d.div && st.qty > 0) total += st.qty * st.price * d.div;
    }
    if (total > 0) {
      earn(total, 'Dividends');
      S.stats.divs++;
      log(`💌 You received ${money(total)} in quarterly dividends.`, 'good');
      toast(`Dividends paid: ${money(total)}`, 'good');
    }
  }
}

/* ---------------------------- Restaurants ---------------------------- */
function restoWages(r) {
  const t = RT[r.type], wm = t.wageMult || 1;
  return Object.keys(ROLES).reduce((s, k) => s + r.staff[k] * ROLES[k].wage * wm, 0);
}
function staffCount(r) { return Object.values(r.staff).reduce((a, b) => a + b, 0); }

function processRestaurants() {
  const weekend = isWeekend();
  for (const r of S.restaurants) {
    const t = RT[r.type];
    const st = r.staff;
    const q = QUALITY[r.quality];
    let served = 0, demand = 0, revenue = 0, ingr = 0, bottleneck = '';

    if (r.closed > 0) {
      r.closed--;
      bottleneck = 'closed';
    } else {
      const repF = 0.4 + r.rep / 60;
      const priceF = clamp(Math.pow(t.basePrice / r.price, 1.6), 0.05, 2.5);
      const mkt = r.marketing > 0 ? 1.35 : 1;
      demand = t.demand * repF * priceF * mkt * (weekend ? 1.3 : 1) * rand(0.85, 1.15);
      const mgr = 1 + 0.12 * Math.min(st.manager, 2);
      const mor = 0.6 + 0.4 * r.morale / 100;
      const cookCap = (st.cook + (r.selfShift ? 1 : 0)) * 45 * (t.cookMult || 1) * mgr * mor;
      const serveCap = t.noWaiters ? Infinity : (st.waiter + (r.selfShift ? 1 : 0)) * 50 * mgr * mor;
      const seatCap = t.seats * (1 + 0.3 * (r.level - 1));
      served = Math.floor(Math.min(demand, cookCap, serveCap, seatCap));
      const m = Math.min(demand, cookCap, serveCap, seatCap);
      bottleneck = m === demand ? 'demand' : m === cookCap ? 'cooks' : m === serveCap ? 'waiters' : 'seats';
      revenue = served * r.price;
      ingr = served * t.ingr * q.mult;
      earn(revenue, 'Restaurants');
      spend(ingr, 'Restaurants');
      S.stats.meals += served;

      // cleanliness
      const needed = Math.floor(served / 150);
      r.clean = clamp(r.clean + (st.cleaner >= needed ? 5 : -8 * (needed - st.cleaner)), 0, 100);
      // reputation drifts toward a target
      const ratio = demand > 0 ? served / demand : 1;
      const pr = r.price / t.basePrice;
      let target = 45 + q.rep + (r.clean - 60) / 3 + (st.manager > 0 ? 6 : 0) + (r.level - 1) * 3;
      if (ratio < 0.8) target -= (0.8 - ratio) * 40;
      if (pr > 1.2) target -= (pr - 1.2) * 40;
      else if (pr < 0.85) target += 5;
      target = clamp(target,