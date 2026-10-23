'use strict';
/* =====================================================================
   Scrapyard: buy junk cars at auction, scrap them for metal & parts,
   or repair and flip the good ones.
   ===================================================================== */
const YARD_COST = 15000;
const YARD_LEVELS = [
  { cap: 6, cost: 0, speed: 1 },
  { cap: 12, cost: 25000, speed: 1.25 },
  { cap: 24, cost: 80000, speed: 1.5 },
  { cap: 50, cost: 250000, speed: 2 },
];
const YARD_WAGE = 95;
const YARD_WORK_ENERGY = 20;
const YARD_RENT = 60, YARD_LAND = 36000, YARD_PERMIT = ['Salvage & environmental permit', 2500];
function yardBills(units) {
  const y = S.yard, z = 1 + y.level * 0.5;
  return makeBills(y.site, { elec: 10 * z, water: 4 * z, net: 4, waste: 6 * z }, { elec: units * 3, water: units, waste: units * 2 }, y.insured, YARD_COST + YARD_LEVELS.slice(1, y.level + 1).reduce((t, l) => t + l.cost, 0));
}
const JUNK = [
  { name: "'98 Full-size Pickup", kg: 1900, parts: 900, resale: 6500 },
  { name: "'03 Compact Hatchback", kg: 1200, parts: 700, resale: 4800 },
  { name: "'07 Midsize Sedan", kg: 1450, parts: 850, resale: 6200 },
  { name: "'89 Boxy Station Wagon", kg: 1350, parts: 450, resale: 3500 },
  { name: "'11 Economy Sedan", kg: 1400, parts: 650, resale: 5400 },
  { name: "'05 Big SUV", kg: 2400, parts: 1400, resale: 9800 },
  { name: "'01 Retro Bug", kg: 1250, parts: 600, resale: 4200 },
  { name: "'14 Hybrid Hatch", kg: 1400, parts: 1600, resale: 9200 },
  { name: "'95 Little Roadster", kg: 1000, parts: 900, resale: 7200 },
  { name: 'Retired School Bus', kg: 9500, parts: 2200, resale: 0 },
  { name: 'Wrecked Box Truck', kg: 5200, parts: 1500, resale: 0 },
];
const RARE_JUNK = { name: "'69 Muscle Car (barn find)", kg: 1500, parts: 2500, resale: 42000 };

const yardLevel = () => YARD_LEVELS[S.yard.level];
const scrapValue = (c) => c.kg * 0.85 * S.yard.metalPrice + c.parts * (0.5 + c.cond / 200);
const repairCost = (c) => Math.round(c.resale * (1 - c.cond / 100) * 0.7 + 300);
const canRepair = (c) => c.resale > 0 && c.cond >= 30;

function makeOffer(m = pick(JUNK)) {
  const cond = randInt(5, 85);
  const c = { id: uid(), name: m.name, kg: m.kg, parts: m.parts, resale: m.resale, cond };
  c.price = Math.round(Math.max(scrapValue(c) * rand(0.5, 0.8), m.resale * cond / 100 * 0.35) / 10) * 10;
  return c;
}
function genOffers() { S.yard.offers = Array.from({ length: randInt(4, 6) }, () => makeOffer()); }

function doYardWork(units) {
  const y = S.yard;
  for (const c of y.cars) {
    if (units <= 0) break;
    if (c.status === 'ready') continue;
    const use = Math.min(units, c.work - c.done);
    S.yard.worked += use;
    c.done += use; units -= use;
    if (c.done >= c.work - 1e-9) finishCar(c);
  }
  y.cars = y.cars.filter((c) => !c.gone);
}
function finishCar(c) {
  const y = S.yard;
  if (c.status === 'scrap') {
    const metal = c.kg * 0.85, parts = c.parts * (0.5 + c.cond / 200);
    y.metal += metal;
    earn(parts, 'Scrapyard');
    c.gone = true;
    stat('scrapped');
    addCO2('♻️ Recycling (avoided emissions)', -0.4);
    log(`🗜️ Scrapped ${c.name}: ${fmtInt(metal)} kg of metal + ${money(parts)} in parts.`);
  } else {
    c.status = 'ready';
    c.sale = Math.round(c.resale * rand(0.85, 1.1));
    log(`🔧 Finished repairing the ${c.name}. It can sell for ${money(c.sale)}.`, 'good');
  }
}

registerModule({
  id: 'scrapyard',
  init(s) {
    s.yard = { owned: false, level: 0, workers: 0, cars: [], metal: 0, metalPrice: 0.32, metalHist: [], offers: [], closed: 0, site: null, insured: true, bills: null, worked: 0 };
    let m = 0.32;
    for (let i = 0; i < 60; i++) { m = clamp(m + 0.05 * (0.32 - m) + 0.012 * gauss(), 0.12, 0.8); s.yard.metalHist.push(m); }
    s.yard.metalPrice = m;
  },
  start() { genOffers(); },
  migrate(s) { if (s.yard.owned && !s.yard.site) s.yard.site = { own: false, rent: YARD_RENT, price: YARD_LAND, deposit: 0 }; },
  assets(a) {
    const y = S.yard;
    if (!y.owned) { a.scrapyard = 0; return; }
    let v = YARD_COST * 0.6 + siteValue(y.site);
    for (let i = 1; i <= y.level; i++) v += YARD_LEVELS[i].cost * 0.5;
    v += y.metal * y.metalPrice;
    for (const c of y.cars) v += c.status === 'ready' ? c.sale * 0.9 : c.paid * 0.8;
    a.scrapyard = v;
  },
  daily() {
    const y = S.yard;
    y.metalPrice = clamp(y.metalPrice + 0.05 * (0.32 - y.metalPrice) + 0.012 * gauss(), 0.12, 0.8);
    y.metalHist.push(y.metalPrice);
    if (y.metalHist.length > 90) y.metalHist.shift();
    if (!y.owned) { genOffers(); return; }
    const wages = y.workers * YARD_WAGE * aiWageMult('yard') * policy('wage');
    let paid = true;
    if (wages) {
      if (canAfford(wages)) spend(wages, 'Wages');
      else {
        paid = false;
        const quit = Math.ceil(y.workers * 0.3);
        y.workers -= quit;
        log(`⚠️ Couldn't pay scrapyard workers. ${quit} quit.`, 'bad');
      }
    }
    if (y.closed > 0) y.closed--;
    else if (paid) doYardWork(y.workers * 2 * yardLevel().speed);
    y.bills = yardBills(y.worked);
    payBills(y.bills);
    y.worked = 0;
    genOffers();
    if (chance(0.03)) { y.offers.push(makeOffer(RARE_JUNK)); log('✨ A rare barn-find muscle car is up at the scrap auction today!', 'good'); }
  },
  tabs: [{ id: 'yard', name: 'Scrapyard', icon: '🚗', render: renderYard }],
  actions: {
    buyYard() {
      openBusiness({
        title: 'a Scrapyard', icon: '🚗', equipment: YARD_COST, permit: { name: YARD_PERMIT[0], cost: YARD_PERMIT[1] }, rent: YARD_RENT, price: YARD_LAND,
        extra: '<p class="small muted">Equipment: crusher, tow truck and tools. Premises: a fenced industrial lot.</p>',
        done(site) {
          Object.assign(S.yard, { owned: true, site, insured: true });
          log(`🐕 You opened a scrapyard on ${site.own ? 'land you bought' : 'a rented lot'}!`, 'good');
        },
      });
    },
    yardBuySite() { buySite(S.yard.site); },
    yardInsure() { S.yard.insured = !S.yard.insured; },
    yardUpgrade() {
      const y = S.yard, next = YARD_LEVELS[y.level + 1];
      if (!next || !pay(next.cost, 'Investments', 'the upgrade')) return;
      y.level++;
      toast(`Scrapyard upgraded: room for ${next.cap} cars, faster crusher.`, 'good');
    },
    yardHire() { if (S.yard.workers < yardLevel().cap) S.yard.workers++; },
    yardFire() { if (S.yard.workers > 0) S.yard.workers--; },
    buyJunk(a) {
      const y = S.yard, c = y.offers.find((o) => o.id === +a);
      if (!c) return;
      if (y.cars.length >= yardLevel().cap) return toast('Your yard is full. Upgrade or process some cars.', 'warn');
      if (!pay(c.price, 'Scrapyard', c.name)) return;
      y.offers.splice(y.offers.indexOf(c), 1);
      y.cars.push({ ...c, paid: c.price, status: 'scrap', work: Math.ceil(c.kg / 700) + 1, done: 0 });
    },
    junkRepair(a) {
      const c = S.yard.cars.find((x) => x.id === +a);
      if (!c || !canRepair(c) || c.status !== 'scrap') return;
      if (!pay(repairCost(c), 'Scrapyard', 'repairs')) return;
      c.status = 'repair'; c.work = Math.ceil((100 - c.cond) / 12); c.done = 0;
    },
    sellRepaired(a) {
      const y = S.yard, c = y.cars.find((x) => x.id === +a);
      if (!c || c.status !== 'ready') return;
      earn(c.sale, 'Scrapyard');
      y.cars.splice(y.cars.indexOf(c), 1);
      stat('flipped');
      toast(`Sold the ${c.name} for ${money(c.sale)}`, 'good');
    },
    yardWork() {
      if (!S.yard.cars.some((c) => c.status !== 'ready')) return toast('No cars to work on.', 'warn');
      if (!useEnergy(YARD_WORK_ENERGY)) return;
      doYardWork(2 * yardLevel().speed);
      toast('You put in a hard day at the yard.', 'good');
    },
    sellMetal() {
      const y = S.yard;
      if (y.metal <= 0) return;
      const v = y.metal * y.metalPrice;
      earn(v, 'Scrapyard');
      toast(`Sold ${fmtInt(y.metal)} kg of scrap metal for ${money(v)}`, 'good');
      y.metal = 0;
    },
  },
});

function renderYard() {
  const y = S.yard;
  if (!y.owned) {
    const up = YARD_COST + YARD_PERMIT[1] + YARD_RENT * DEPOSIT_DAYS;
    return `<h2 class="section">🚗 Scrapyard</h2><div class="card hl" style="max-width:560px"><h3>Open a scrapyard from ${money(up)}</h3>
      <p class="small muted">Equipment ${money(YARD_COST)} · ${YARD_PERMIT[0]} ${money(YARD_PERMIT[1])} · rent the lot for ${money(rentNow(YARD_RENT))}/day or buy it for ${money(YARD_LAND * S.re.housing)} · plus utilities</p>
      <p>Buy junk cars at auction, crush them for scrap metal and sell salvaged parts. Fix up the good ones and flip them for a profit.</p>
      <ul class="small muted"><li>Scrap metal price changes daily. Sell when it's high.</li><li>Hire workers or do the work yourself.</li><li>Rare barn finds show up now and then.</li></ul>
      ${btn('Open a scrapyard…', 'buyYard', '', { cls: 'primary', disabled: !canAfford(up) })}</div>`;
  }
  const L = yardLevel(), next = YARD_LEVELS[y.level + 1];
  const offers = y.offers.map((c) => `<div class="list-item"><span class="big-ico">🚙</span><div class="grow"><b>${c.name}</b>
    <div class="small muted">${fmtInt(c.kg)} kg · condition ${c.cond}% · scrap value ~${money(scrapValue(c))}${canRepair(c) ? ` · repaired ~${money(c.resale)}` : ''}</div></div>
    ${btn(`Buy ${money(c.price)}`, 'buyJunk', c.id, { cls: 'sm buy', disabled: !canAfford(c.price) || y.cars.length >= L.cap })}</div>`).join('');
  const cars = y.cars.map((c) => `<div class="list-item"><span class="big-ico">${c.status === 'ready' ? '✨' : c.status === 'repair' ? '🔧' : '🗜️'}</span>
    <div class="grow"><b>${c.name}</b> <span class="small muted">${c.cond}% · paid ${money(c.paid)}</span>
    ${c.status === 'ready' ? `<div class="small good">Ready to sell for ${money(c.sale)}</div>` : `<div class="small muted">${c.status === 'repair' ? 'Repairing' : 'Scrapping'}: ${+c.done.toFixed(1)}/${c.work} work</div>${bar(c.done / c.work * 100)}`}</div>
    ${c.status === 'ready' ? btn(`Sell ${money(c.sale)}`, 'sellRepaired', c.id, { cls: 'sm buy' }) : ''}
    ${c.status === 'scrap' && canRepair(c) && c.done === 0 ? btn(`Repair instead (${money(repairCost(c))})`, 'junkRepair', c.id, { cls: 'sm', disabled: !canAfford(repairCost(c)) }) : ''}</div>`).join('');
  return `<h2 class="section">🚗 Scrapyard</h2>
  <div class="grid g4 section">
    <div class="card kpi"><div class="lbl">Yard</div><div class="val">${y.cars.length}/${L.cap}</div><div class="small muted">Level ${y.level + 1} · speed ×${L.speed}</div></div>
    <div class="card kpi"><div class="lbl">Workers (${money(YARD_WAGE)}/day each)</div><div class="val">${y.workers}</div>
      <div class="row">${btn('Hire', 'yardHire', '', { cls: 'sm buy', disabled: y.workers >= L.cap })}${btn('Fire', 'yardFire', '', { cls: 'sm sell', disabled: !y.workers })}</div></div>
    <div class="card kpi"><div class="lbl">Scrap metal</div><div class="val">${fmtInt(y.metal)} kg</div>
      <div class="small">@ ${price(y.metalPrice)}/kg = ${money(y.metal * y.metalPrice)}</div>${btn('Sell metal', 'sellMetal', '', { cls: 'sm sell', disabled: y.metal <= 0 })}</div>
    <div class="card kpi"><div class="lbl">Upgrade</div>${next ? `<div class="small muted">Room for ${next.cap} cars, speed ×${next.speed}</div>${btn(`Upgrade (${money(next.cost)})`, 'yardUpgrade', '', { cls: 'sm', disabled: !canAfford(next.cost) })}` : '<div class="val">MAX</div>'}</div>
  </div>
  <div class="card section tight"><div class="row between"><div><div class="small">${siteLabel(y.site)}</div>${billsHtml(y.bills)}</div>
    <div class="row">${y.site.own ? '' : btn(`🔑 Buy the lot (${money(sitePrice(y.site))})`, 'yardBuySite', '', { cls: 'sm', disabled: !canAfford(sitePrice(y.site)) })}
    ${btn(y.insured ? '🛡️ Insured' : '⚠️ Uninsured', 'yardInsure', '', { cls: 'sm ' + (y.insured ? 'on' : '') })}</div></div></div>
  <div class="card section"><h3>Scrap metal price ($/kg)</h3>${chart('metal', y.metalHist, 90, { labels: true })}</div>
  <div class="grid g2">
    <div class="card"><div class="row between"><h3>Today's junk auction</h3></div>${offers || '<p class="muted">Sold out. New cars tomorrow.</p>'}</div>
    <div class="card"><div class="row between"><h3>In your yard</h3>${btn(`💪 Work yourself (${YARD_WORK_ENERGY}⚡)`, 'yardWork', '', { cls: 'sm', disabled: S.energy < YARD_WORK_ENERGY })}</div>
      ${cars || '<p class="muted">Empty. Buy some junk cars!</p>'}</div>
  </div>`;
}
