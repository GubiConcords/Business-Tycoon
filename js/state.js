'use strict';
/* =====================================================================
   Game state, money helpers, valuation, save / load
   ===================================================================== */
const SAVE_KEY = 'business-tycoon-save-v2';
const START_CASH = 5000;
const SPEEDS = [0, 6000, 3000, 1200, 400];
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

let S;
const UI = {
  tab: 'dash', charts: {}, pointerDown: false, pending: false, gameOver: false,
};

function newState() {
  const s = {
    version: 2, day: 1, cash: START_CASH, energy: 100, speed: 1, nextId: 1,
    ledger: {}, lastLedger: {}, history: [START_CASH],
    log: [], ach: {}, seenIntro: false,
    stats: {},
  };
  for (const m of MODS) if (m.init) m.init(s);
  return s;
}
const uid = () => S.nextId++;

/* ---------------------------- Money ---------------------------- */
function book(cat, amt) { S.ledger[cat] = (S.ledger[cat] || 0) + amt; }
function earn(amt, cat) { S.cash += amt; book(cat, amt); }
function spend(amt, cat) { S.cash -= amt; book(cat, -amt); }
function canAfford(amt) { return S.cash >= amt - 1e-6; }
function pay(amt, cat, what = '') {
  if (!canAfford(amt)) { toast(`Not enough cash${what ? ' for ' + what : ''} (need ${money(amt)}).`, 'bad'); return false; }
  spend(amt, cat); return true;
}
function useEnergy(n) {
  if (S.energy < n) { toast(`Not enough energy (need ${n}⚡). Rest until tomorrow.`, 'warn'); return false; }
  S.energy -= n; return true;
}
function stat(k, d = 1) { S.stats[k] = (S.stats[k] || 0) + d; }
function log(msg, type = '') {
  S.log.unshift({ d: S.day, msg, type });
  if (S.log.length > 300) S.log.length = 300;
}
const dayName = (d = S.day) => WD[(d - 1) % 7];
const isWeekend = (d = S.day) => (d - 1) % 7 >= 5;

/* ---------------------------- Valuation ---------------------------- */
const ASSET_LABELS = {
  cash: 'Cash', savings: 'Savings', stocks: 'Stocks', crypto: 'Crypto', startups: 'Startups',
  restaurants: 'Restaurants', factories: 'Factories', inventory: 'Warehouse', scrapyard: 'Scrapyard',
  property: 'Real estate', racing: 'Race cars', loan: 'Loans',
};
function assets() {
  const a = { cash: S.cash };
  for (const m of MODS) if (m.assets) m.assets(a);
  return a;
}
function netWorth() { return Object.values(assets()).reduce((x, y) => x + y, 0); }

/* ---------------------------- Save / load ---------------------------- */
function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
function deepMerge(base, saved) {
  for (const k in saved) {
    if (isObj(base[k]) && isObj(saved[k])) deepMerge(base[k], saved[k]);
    else base[k] = saved[k];
  }
  return base;
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return deepMerge(newState(), JSON.parse(raw));
  } catch (e) { return null; }
}
function wipeSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
