'use strict';
/* =====================================================================
   Markets: stocks, crypto and startup (angel) investing
   ===================================================================== */
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

const NEWS_GOOD = ['{n} smashes earnings expectations', '{n} unveils a breakthrough product', 'Analysts upgrade {n} to Strong Buy', '{n} wins a massive government contract', '{n} announces a huge share buyback', 'Rumors swirl of a takeover bid for {n}'];
const NEWS_BAD = ['{n} misses earnings badly', 'CEO of {n} resigns amid scandal', '{n} hit with an antitrust lawsuit', 'Factory fire halts {n} production', 'Regulators open a probe into {n}', '{n} issues a profit warning'];
const SECTOR_NEWS = [
  ['Energy', 0.05, 'Oil prices surge after supply cuts'], ['Energy', -0.05, 'Oil glut sends energy stocks tumbling'],
  ['Tech', 0.04, 'AI boom lifts tech stocks'], ['Tech', -0.05, 'Chip shortage hammers the tech sector'],
  ['Health', 0.05, 'New healthcare bill boosts pharma'], ['Retail', -0.04, 'Consumer spending slumps'],
  ['Auto', 0.05, 'EV subsidies announced'], ['Finance', -0.04, 'Bank stress-test failures rattle finance'],
  ['Materials', 0.05, 'Gold hits a record high'], ['Industrial', 0.04, 'Airlines place record aircraft orders'],
];
const CRYPTO_GOOD = ['Major bank begins accepting {n}', '{n} listed on a giant exchange', 'Celebrity tweets about {n}', '{n} network upgrade succeeds'];
const CRYPTO_BAD = ['Exchange hack drains {n} wallets', 'Regulators threaten to ban {n}', '{n} founder dumps a huge stake', 'Network outage halts {n} for hours'];

const SU_PRE = ['Quantum', 'Hyper', 'Meta', 'Nano', 'Bio', 'Cloud', 'Snack', 'Pet', 'Solar', 'Robo', 'Green', 'Smart', 'Deep', 'Zen', 'Astro', 'Pixel'];
const SU_SUF = ['ly', 'ify', 'Hub', 'Labs', 'AI', 'Box', 'Mind', 'Wave', 'Stack', 'Go', 'Nest', 'Forge'];
const SU_PITCH = [
  'Uber, but for dog walkers', 'AI that writes your wedding speech', 'Lab-grown coffee beans', 'Subscription socks for gamers',
  'Drone delivery for pizza', 'Blockchain for farm vegetables', 'Fusion-powered phone chargers', 'Smart fridge that orders groceries',
  'Dating app for houseplants', 'Self-driving lawn mowers', 'Vertical farms in parking garages', 'Robot baristas',
  'Recyclable phone cases from seaweed', 'Space tourism for pets', 'Brain-training mobile game', 'Electric cargo bikes',
];
const SU_STAGES = [
  { name: 'Pre-seed', ticket: 5000, days: [30, 60] },
  { name: 'Seed', ticket: 25000, days: [40, 80] },
  { name: 'Series A', ticket: 150000, days: [50, 100] },
  { name: 'Series B', ticket: 750000, days: [60, 120] },
];
const SU_OUTCOMES = [
  { w: 62, mult: 0, text: 'went bust' },
  { w: 15, mult: 0.4, text: 'was sold for parts' },
  { w: 12, mult: 1.5, text: 'was acquired' },
  { w: 7, mult: 4, text: 'had a strong exit' },
  { w: 3.3, mult: 12, text: 'became a unicorn' },
  { w: 0.7, mult: 60, text: 'IPO\'d spectacularly' },
];

function seedHist(p, vol, drift, n = 90) {
  const h = [p];
  for (let i = 0; i < n; i++) { p = p / Math.exp(drift + vol * gauss()); h.unshift(p); }
  return h;
}
const dayChange = (h) => (h.length > 1 ? h[h.length - 1] / h[h.length - 2] - 1 : 0);

function genPitches() {
  S.startups.pitches = [];
  for (let i = 0; i < 3; i++) {
    const stage = weighted(SU_STAGES.map((s, j) => ({ s, w: [4, 3, 2, 1][j] }))).s;
    S.startups.pitches.push({
      id: uid(), name: pick(SU_PRE) + pick(SU_SUF), pitch: pick(SU_PITCH), stage: stage.name,
      ticket: Math.round(stage.ticket * rand(0.8, 1.3) / 1000) * 1000, days: randInt(...stage.days),
      hype: randInt(1, 5),
    });
  }
}

function buyStock(sym) {
  const st = S.stocks[sym];
  let q = UI.stockQty === 'max' ? Math.floor((S.cash - STOCK_FEE) / st.price) : +UI.stockQty;
  if (q <= 0) return toast('Not enough cash to buy any shares.', 'bad');
  const cost = q * st.price + STOCK_FEE;
  if (!canAfford(cost)) return toast(`Not enough cash (need ${money(cost)}).`, 'bad');
  S.cash -= cost;
  book('Fees', -STOCK_FEE);
  st.cost = (st.cost * st.qty + st.price * q) / (st.qty + q);
  st.qty += q;
  stat('trades');
  toast(`Bought ${fmtInt(q)} ${sym} @ ${price(st.price)}`, 'good');
}
function sellStock(sym) {
  const st = S.stocks[sym];
  const q = UI.stockQty === 'max' ? st.qty : Math.min(+UI.stockQty, st.qty);
  if (q <= 0) return toast(`You don't own any ${sym}.`, 'warn');
  S.cash += q * st.price - STOCK_FEE;
  book('Fees', -STOCK_FEE);
  book('Stocks', (st.price - st.cost) * q);
  st.qty -= q;
  if (!st.qty) st.cost = 0;
  stat('trades');
  toast(`Sold ${fmtInt(q)} ${sym} for ${money(q * st.price)}`, 'good');
}
function buyCoin(sym) {
  const st = S.crypto[sym];
  const amt = UI.cryptoAmt === 'max' ? S.cash : Math.min(+UI.cryptoAmt, S.cash);
  if (amt < 1) return toast('Not enough cash.', 'bad');
  const coins = amt * (1 - CRYPTO_FEE) / st.price;
  S.cash -= amt;
  book('Fees', -amt * CRYPTO_FEE);
  st.cost = (st.cost * st.qty + st.price * coins) / (st.qty + coins);
  st.qty += coins;
  stat('trades');
  toast(`Bought ${fmtQty(coins)} ${sym} for ${money(amt)}`, 'good');
}
function sellCoin(sym) {
  const st = S.crypto[sym];
  if (st.qty <= 0) return toast(`You don't own any ${sym}.`, 'warn');
  const coins = UI.cryptoAmt === 'max' ? st.qty : Math.min(st.qty, +UI.cryptoAmt / st.price);
  const gross = coins * st.price;
  S.cash += gross * (1 - CRYPTO_FEE);
  book('Fees', -gross * CRYPTO_FEE);
  book('Crypto', (st.price - st.cost) * coins);
  st.qty -= coins;
  if (st.qty < 1e-12) { st.qty = 0; st.cost = 0; }
  stat('trades');
  toast(`Sold ${fmtQty(coins)} ${sym} for ${money(gross)}`, 'good');
}

registerModule({
  id: 'markets',
  init(s) {
    s.stocks = {}; s.crypto = {}; s.marketMood = 0; s.cryptoMood = 0;
    for (const d of STOCKS) s.stocks[d.sym] = { price: d.price, hist: seedHist(d.price, d.vol, d.drift), qty: 0, cost: 0, shock: 0 };
    for (const d of CRYPTO) s.crypto[d.sym] = { price: d.price, hist: seedHist(d.price, d.vol, d.drift), qty: 0, cost: 0, shock: 0 };
    s.startups = { pitches: [], deals: [], nextPitch: 1 };
  },
  start() { genPitches(); S.startups.nextPitch = S.day + 3; },
  assets(a) {
    a.stocks = 0; a.crypto = 0; a.startups = 0;
    for (const k in S.stocks) a.stocks += S.stocks[k].qty * S.stocks[k].price;
    for (const k in S.crypto) a.crypto += S.crypto[k].qty * S.crypto[k].price;
    for (const d of S.startups.deals) a.startups += d.amount * 0.8;
  },
  daily() {
    S.marketMood = S.marketMood * 0.9 + gauss() * 0.0035;
    S.cryptoMood = S.cryptoMood * 0.85 + gauss() * 0.01;
    const sec = Object.fromEntries(SECTORS.map((s) => [s, gauss() * 0.005]));

    if (chance(0.25)) {
      const d = pick(STOCKS), good = chance(0.5);
      S.stocks[d.sym].shock += (good ? 1 : -1) * rand(0.03, 0.09);
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
      log(crash ? '📉 MARKET PANIC: recession fears grip Wall Street!' : '🚀 Central bank cuts rates — markets rally!', crash ? 'bad' : 'good');
      toast(crash ? '📉 Market panic!' : '🚀 Market rally!', crash ? 'bad' : 'good');
    }
    if (chance(0.18)) {
      const d = pick(CRYPTO), good = chance(0.5);
      S.crypto[d.sym].shock += (good ? 1 : -1) * rand(0.06, 0.18);
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
        if (chance(0.012)) { r -= 2.5; log('🪤 RugCoin developers vanished with the liquidity. RUG crashes 90%!', 'bad'); if (st.qty) toast('RugCoin got rugged! −90%', 'bad'); }
        else if (chance(0.02)) { r += 0.7; log('🚀 RugCoin is mooning on social media!', 'good'); }
      }
      st.price = Math.max(1e-7, st.price * Math.exp(r));
      st.hist.push(st.price);
      if (st.hist.length > 180) st.hist.shift();
    }

    // quarterly dividends
    if (S.day % 30 === 0) {
      let total = 0;
      for (const d of STOCKS) if (d.div) total += S.stocks[d.sym].qty * S.stocks[d.sym].price * d.div;
      if (total > 0) {
        earn(total, 'Dividends');
        stat('divs');
        log(`💌 You received ${money(total)} in quarterly dividends.`, 'good');
        toast(`Dividends paid: ${money(total)}`, 'good');
      }
    }

    // startups
    const su = S.startups;
    for (const d of su.deals.slice()) {
      d.left--;
      if (d.left === Math.floor(d.total / 2)) {
        const truthful = chance(0.7);
        const good = d.outcome >= 2 ? truthful : !truthful;
        d.hint = good ? 'Strong traction reported 📈' : 'Struggling to find customers 📉';
        log(`🧪 ${d.name}: ${d.hint}`, good ? 'good' : 'warn');
      }
      if (d.left <= 0) {
        const o = SU_OUTCOMES[d.outcome];
        const payout = d.amount * o.mult;
        if (payout > 0) earn(payout, 'Startups');
        book('Startups', -d.amount);
        su.deals.splice(su.deals.indexOf(d), 1);
        if (o.mult >= 12) stat('unicorns');
        log(`🧪 ${d.name} ${o.text}! Your ${money(d.amount)} stake returned ${money(payout)} (${o.mult}x).`, o.mult >= 1 ? 'good' : 'bad');
        toast(`${d.name} ${o.text}: ${money(payout)}`, o.mult >= 1 ? 'good' : 'bad');
      }
    }
    if (S.day >= su.nextPitch) { genPitches(); su.nextPitch = S.day + 3; }
  },
  tabs: [
    { id: 'stocks', name: 'Stocks', icon: '📈', render: renderStocks },
    { id: 'crypto', name: 'Crypto', icon: '🪙', render: renderCrypto },
    { id: 'startups', name: 'Startups', icon: '🧪', render: renderStartups },
  ],
  actions: {
    selStock: (a) => { UI.selStock = a; },
    stockQty: (a) => { UI.stockQty = a === 'max' ? a : +a; },
    buyStock, sellStock,
    selCoin: (a) => { UI.selCoin = a; },
    cryptoAmt: (a) => { UI.cryptoAmt = a === 'max' ? a : +a; },
    buyCoin, sellCoin,
    investStartup: (a) => {
      const su = S.startups, p = su.pitches.find((x) => x.id === +a);
      if (!p || !pay(p.ticket, 'Startups', 'this investment')) return;
      book('Startups', p.ticket); // investing is not a loss until it resolves
      su.pitches.splice(su.pitches.indexOf(p), 1);
      // more hype = slightly better odds of a good outcome
      const outcomes = SU_OUTCOMES.map((o, i) => ({ i, w: i === 0 ? o.w - p.hype * 2 : o.w + (i >= 2 ? p.hype * 0.4 : 0) }));
      su.deals.push({ id: p.id, name: p.name, amount: p.ticket, left: p.days, total: p.days, outcome: weighted(outcomes).i, hint: '' });
      stat('trades');
      log(`🧪 You invested ${money(p.ticket)} in ${p.name} (${p.pitch}).`);
      toast(`Invested in ${p.name}`, 'good');
    },
  },
});
UI.selStock = 'APXL'; UI.selCoin = 'BCN'; UI.stockQty = 10; UI.cryptoAmt = 1000;

function renderStocks() {
  const d = STOCKS.find((x) => x.sym === UI.selStock), st = S.stocks[d.sym];
  let val = 0, pl = 0;
  for (const s of STOCKS) { const x = S.stocks[s.sym]; val += x.qty * x.price; pl += x.qty * (x.price - x.cost); }
  const mood = S.marketMood > 0.003 ? ['Bullish', 'good'] : S.marketMood < -0.003 ? ['Bearish', 'bad'] : ['Neutral', ''];
  const rows = STOCKS.map((s) => {
    const x = S.stocks[s.sym], ch = dayChange(x.hist);
    return `<tr class="click ${s.sym === UI.selStock ? 'sel' : ''}" data-act="selStock" data-a="${s.sym}">
      <td><b>${s.sym}</b><div class="small muted">${s.name}</div></td><td class="muted">${s.sector}</td>
      <td class="num">${price(x.price)}</td><td class="num ${cls(ch)}">${signPct(ch)}</td>
      <td class="num">${x.qty ? fmtInt(x.qty) : '—'}</td>
      <td class="num">${x.qty ? money(x.qty * x.price) : '—'}</td>
      <td class="num ${cls(x.price - x.cost)}">${x.qty ? signMoney(x.qty * (x.price - x.cost)) : '—'}</td>
      <td class="nowrap">${btn('Buy', 'buyStock', s.sym, { cls: 'sm buy' })} ${btn('Sell', 'sellStock', s.sym, { cls: 'sm sell', disabled: !x.qty })}</td></tr>`;
  }).join('');
  return `<div class="row between section"><h2>📈 Stock Market</h2><span class="pill ${mood[1]}">Market: ${mood[0]}</span></div>
  <div class="grid g4 section">
    <div class="card kpi"><div class="lbl">Portfolio value</div><div class="val">${money(val)}</div></div>
    <div class="card kpi"><div class="lbl">Unrealized P/L</div><div class="val ${cls(pl)}">${signMoney(pl)}</div></div>
    <div class="card kpi"><div class="lbl">Commission</div><div class="val">${money(STOCK_FEE)}</div></div>
  </div>
  <div class="card section">
    <div class="row between"><div><h3>${d.name} <span class="muted">(${d.sym})</span></h3>
      <div class="small muted">${d.sector} · ${d.div ? `Dividend ${pct(d.div * 4)} / yr (paid every 30 days)` : 'No dividend'} · Volatility ${pct(d.vol * Math.sqrt(30))}/month</div></div>
      <div class="right"><div class="kpi"><div class="val">${price(st.price)}</div></div><div class="${cls(dayChange(st.hist))}">${signPct(dayChange(st.hist))} today</div></div></div>
    ${chart('stock', st.hist, 200, { labels: true })}
    ${st.qty ? `<p class="small" style="margin-top:8px">You own <b>${fmtInt(st.qty)}</b> shares, average cost ${price(st.cost)}.</p>` : ''}
  </div>
  <div class="card"><div class="row between section"><h3>All stocks</h3><div class="row"><span class="small muted">Shares per trade</span>${seg([[1, '1'], [10, '10'], [100, '100'], [1000, '1K'], ['max', 'Max']], UI.stockQty, 'stockQty')}</div></div>
  <div class="tbl-wrap"><table><thead><tr><th>Stock</th><th>Sector</th><th class="num">Price</th><th class="num">Today</th><th class="num">Owned</th><th class="num">Value</th><th class="num">P/L</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

function renderCrypto() {
  const d = CRYPTO.find((x) => x.sym === UI.selCoin), st = S.crypto[d.sym];
  let val = 0, pl = 0;
  for (const c of CRYPTO) { const x = S.crypto[c.sym]; val += x.qty * x.price; pl += x.qty * (x.price - x.cost); }
  const rows = CRYPTO.map((c) => {
    const x = S.crypto[c.sym], ch = dayChange(x.hist);
    return `<tr class="click ${c.sym === UI.selCoin ? 'sel' : ''}" data-act="selCoin" data-a="${c.sym}">
      <td><b>${c.sym}</b><div class="small muted">${c.name}</div></td>
      <td class="num">${price(x.price)}</td><td class="num ${cls(ch)}">${signPct(ch)}</td>
      <td class="num">${x.qty ? fmtQty(x.qty) : '—'}</td><td class="num">${x.qty ? money(x.qty * x.price) : '—'}</td>
      <td class="num ${cls(x.price - x.cost)}">${x.qty ? signMoney(x.qty * (x.price - x.cost)) : '—'}</td>
      <td class="nowrap">${btn('Buy', 'buyCoin', c.sym, { cls: 'sm buy' })} ${btn('Sell', 'sellCoin', c.sym, { cls: 'sm sell', disabled: !x.qty })}</td></tr>`;
  }).join('');
  return `<div class="row between section"><h2>🪙 Crypto Exchange</h2><span class="pill warn">High volatility · ${pct(CRYPTO_FEE)} fee</span></div>
  <div class="grid g4 section">
    <div class="card kpi"><div class="lbl">Crypto holdings</div><div class="val">${money(val)}</div></div>
    <div class="card kpi"><div class="lbl">Unrealized P/L</div><div class="val ${cls(pl)}">${signMoney(pl)}</div></div>
  </div>
  <div class="card section">
    <div class="row between"><div><h3>${d.name} <span class="muted">(${d.sym})</span></h3>
      <div class="small muted">Daily volatility ~${pct(d.vol)}${d.rug ? ' · ⚠️ Meme coin. Could go to zero any day.' : ''}</div></div>
      <div class="right"><div class="kpi"><div class="val">${price(st.price)}</div></div><div class="${cls(dayChange(st.hist))}">${signPct(dayChange(st.hist))} today</div></div></div>
    ${chart('coin', st.hist, 200, { labels: true })}
  </div>
  <div class="card"><div class="row between section"><h3>Coins</h3><div class="row"><span class="small muted">Amount per trade</span>${seg([[100, '$100'], [1000, '$1K'], [10000, '$10K'], [100000, '$100K'], [1000000, '$1M'], ['max', 'All']], UI.cryptoAmt, 'cryptoAmt')}</div></div>
  <div class="tbl-wrap"><table><thead><tr><th>Coin</th><th class="num">Price</th><th class="num">24h</th><th class="num">Holding</th><th class="num">Value</th><th class="num">P/L</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

function renderStartups() {
  const su = S.startups;
  const pitches = su.pitches.map((p) => `<div class="card">
    <div class="row between"><h3>${esc(p.name)}</h3><span class="pill">${p.stage}</span></div>
    <p class="muted">"${p.pitch}"</p>
    <div class="small">Ticket: <b>${money(p.ticket)}</b> · Exit in ~${p.days} days</div>
    <div class="small">Founder hype: <span class="stars">${'★'.repeat(p.hype)}${'☆'.repeat(5 - p.hype)}</span></div>
    <div style="margin-top:10px">${btn(`Invest ${money(p.ticket)}`, 'investStartup', p.id, { cls: 'buy', disabled: !canAfford(p.ticket) })}</div></div>`).join('');
  const deals = su.deals.map((d) => `<div class="list-item"><span class="big-ico">🧪</span><div class="grow"><b>${esc(d.name)}</b>
    <div class="small muted">${money(d.amount)} invested · resolves in ${d.left} days ${d.hint ? '· ' + d.hint : ''}</div>
    ${bar((d.total - d.left) / d.total * 100)}</div></div>`).join('');
  return `<h2 class="section">🧪 Angel Investing</h2>
  <div class="banner info">Back early-stage startups. Most fail, a few return 10–60x. New pitches arrive every 3 days (next on day ${su.nextPitch}).</div>
  <h4>Open pitches</h4><div class="grid g3 section">${pitches || '<p class="muted">No pitches right now.</p>'}</div>
  <div class="card"><h3>Your portfolio (${su.deals.length})</h3>${deals || '<p class="muted">No investments yet.</p>'}</div>`;
}
