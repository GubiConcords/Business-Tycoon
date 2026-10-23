'use strict';
/* =====================================================================
   Energy: power plants (solar → fusion), battery storage, oil wells and
   gas fields, carbon capture and a fusion research program. Your own
   generation powers your businesses first; the surplus is sold to the grid.
   ===================================================================== */
const PLANT_TYPES = {
  solar: { name: 'Solar farm', icon: '☀️', mw: 20, cost: 1800000, cf: 0.22, fuel: 0, opex: 800, co2: 0, build: 20, renew: true, permit: ['Grid connection permit', 50000] },
  wind: { name: 'Wind farm', icon: '🌬️', mw: 30, cost: 4000000, cf: 0.33, fuel: 0, opex: 1200, co2: 0, build: 30, renew: true, permit: ['Grid connection & wildlife permit', 120000] },
  hydro: { name: 'Hydro dam', icon: '💧', mw: 150, cost: 30000000, cf: 0.45, fuel: 0, opex: 3000, co2: 0, build: 120, renew: true, permit: ['Water rights & environmental permit', 2000000] },
  gas: { name: 'Gas power plant', icon: '🔥', mw: 100, cost: 15000000, cf: 0.6, fuel: 45, gasFuel: true, opex: 3000, co2: 0.4, build: 40, permit: ['Air quality & grid permit', 500000] },
  coal: { name: 'Coal power plant', icon: '🏭', mw: 300, cost: 60000000, cf: 0.85, fuel: 30, opex: 8000, co2: 1.0, build: 60, permit: ['Air quality & mining permit', 3000000] },
  nuclear: { name: 'Nuclear power plant', icon: '☢️', mw: 1000, cost: 350000000, cf: 0.92, fuel: 10, opex: 60000, co2: 0, build: 200, permit: ['Nuclear operating license', 50000000], legal: 35 },
  fusion: { name: 'Fusion reactor', icon: '🌟', mw: 2000, cost: 1200000000, cf: 0.95, fuel: 2, opex: 100000, co2: 0, build: 120, permit: ['Fusion facility license', 100000000], needsFusion: true },
};
const EXTRACT_TYPES = {
  oilwell: { name: 'Oil well', icon: '🛢️', cost: 2000000, out: 300, opex: 2000, co2: 0.04, build: 15, dry: 0.15, life: 1500, permit: ['Drilling permit', 100000] },
  gasfield: { name: 'Natural gas field', icon: '⛽', cost: 20000000, out: 2000, opex: 8000, co2: 0.02, build: 45, dry: 0.1, life: 2000, permit: ['Drilling & pipeline permit', 1000000] },
};
const BASE_POWER_PRICE = 120;     // $/MWh wholesale
const RETAIL_MARKUP = 1.5;
const GRID_CO2 = 0.4;             // t per MWh bought from the grid
const STORAGE_CELLS = 20, STORAGE_COST = 3000, STORAGE_SPREAD = 40;
const CCS_COST = 0.3;             // share of plant cost
const FUSION_STAGES = [
  { name: 'Plasma confinement', cost: 150000000, days: 90 },
  { name: 'Net energy gain', cost: 250000000, days: 120 },
  { name: 'Commercial reactor design', cost: 400000000, days: 120 },
];

const PW = () => S.power;
const powerPrice = () => BASE_POWER_PRICE * S.utilRates.elec * worldMult('power');
const retailPrice = () => powerPrice() * RETAIL_MARKUP;
const plantValue = (p) => (p.building > 0 ? p.paid * 0.8 : PLANT_TYPES[p.type].cost * 0.6 * (p.ccs ? 1 + CCS_COST : 1)) + siteValue(p.site);
const plantGen = (p) => {
  const t = PLANT_TYPES[p.type];
  if (p.building > 0 || p.outage > 0) return 0;
  return t.mw * 24 * p.cf * (p.ccs ? 0.9 : 1) * (1 + 0.1 * execSkill('energy'));
};

registerModule({
  id: 'energy',
  init(s) {
    s.power = {
      plants: [], wells: [], storage: 0, elecSpend: 0, extraMWh: 0,
      last: { demand: 0, gen: 0, self: 0, sold: 0, revenue: 0, saved: 0, fuel: 0, gasOwn: 0 }, priceHist: [],
      fusion: { stage: 0, left: 0, done: false },
    };
  },
  assets(a) {
    const P = PW();
    a.energy = P.plants.reduce((t, p) => t + plantValue(p), 0) + P.wells.reduce((t, w) => t + (w.building > 0 ? w.paid * 0.8 : EXTRACT_TYPES[w.type].cost * 0.5 * w.left / EXTRACT_TYPES[w.type].life) + siteValue(w.site), 0)
      + P.storage * (STORAGE_CELLS * GOODS.battery.base + STORAGE_COST) * 0.6;
  },
  daily() {
    const P = PW(), F = P.fusion;
    if (F.left > 0 && --F.left <= 0) {
      if (chance(0.75)) {
        F.stage++;
        if (F.stage >= FUSION_STAGES.length) { F.done = true; timeline('🌟', 'Fusion power cracked'); log('🌟 BREAKTHROUGH: your scientists achieved commercial fusion! You can now build fusion reactors.', 'good'); showModal({ title: '🌟 Fusion achieved!', cls: 'good', body: '<p>Limitless clean power is yours. Fusion reactors are unlocked in the Energy tab.</p>' }); }
        else log(`🔬 Fusion research: "${FUSION_STAGES[F.stage - 1].name}" succeeded!`, 'good');
      } else log(`🔬 Fusion research: "${FUSION_STAGES[F.stage].name}" failed. Fund it again to retry.`, 'bad');
    }
  },
  // runs after every business has paid its bills, so we know today's electricity demand
  late() {
    const P = PW(), L = { demand: 0, gen: 0, self: 0, sold: 0, revenue: 0, saved: 0, fuel: 0, gasOwn: 0, emissions: 0 };
    // extraction
    let gasPool = 0;
    for (const w of P.wells) {
      const t = EXTRACT_TYPES[w.type];
      if (w.building > 0) { if (--w.building <= 0) { if (chance(t.dry)) { w.dry = true; log(`🕳️ Your ${t.name} came up dry. The investment is lost.`, 'bad'); } else log(`${t.icon} Your ${t.name} started producing!`, 'good'); } continue; }
      if (w.dry || w.left <= 0) continue;
      spend(t.opex, 'Energy');
      payBills(w.bills = makeBills(w.site, { elec: 20, net: 5 }, {}, true, t.cost));
      const out = t.out * Math.min(1, w.left / (t.life * 0.4));
      w.left--;
      addCO2('🛢️ Oil & gas extraction', out * t.co2);
      if (w.type === 'oilwell') { S.goods.oil.stock += out; if (w.autoSell) { const extra = Math.floor(S.goods.oil.stock - (dailyNeeds().oil || 0)); if (extra > 0) tradeGood('oil', -extra); } }
      else gasPool += out;
    }
    // generation
    const price = powerPrice();
    let gen = 0, renew = 0;
    for (const p of P.plants) {
      const t = PLANT_TYPES[p.type];
      if (p.building > 0) {
        if (--p.building <= 0) { log(`${t.icon} Your ${t.name} is online!`, 'good'); stat('plantsBuilt'); }
        continue;
      }
      p.cf = t.renew && t.mw < 100 ? clamp(t.cf + gauss() * t.cf * 0.35, 0.02, t.cf * 2) : t.cf;
      if (p.outage > 0) p.outage--;
      else if (chance(t.co2 > 0.5 ? 0.006 : 0.003)) { p.outage = randInt(3, 10); log(`🔧 Unplanned outage at your ${t.name} (${p.outage} days).`, 'warn'); }
      const g = plantGen(p);
      p.lastGen = g;
      spend(t.opex * (p.ccs ? 1.2 : 1) * (p.outage ? 0.5 : 1), 'Energy');
      payBills(p.bills = makeBills(p.site, { water: t.mw * 0.5, net: 20 }, {}, true, t.cost));
      if (!g) continue;
      let fuel = g * t.fuel * (t.gasFuel ? S.utilRates.gas : 1);
      if (t.gasFuel && gasPool > 0) { const use = Math.min(gasPool, g); gasPool -= use; L.gasOwn += use; fuel *= 1 - use / g; }
      spend(fuel, 'Energy'); L.fuel += fuel;
      addCO2(`${t.icon} ${t.name}s`, g * t.co2 * (p.ccs ? 0.15 : 1));
      gen += g;
      if (t.renew) renew += g;
    }
    if (gasPool > 0) { const v = gasPool * 45 * S.utilRates.gas * 0.9; earn(v, 'Energy'); L.revenue += v; }
    // use own power first (saves the retail price), sell the rest wholesale
    const demand = P.elecSpend / retailPrice() + P.extraMWh;
    const self = Math.min(demand, gen);
    const saved = self * retailPrice();
    if (saved > 0) earn(saved, 'Energy');
    const surplus = gen - self;
    const sellPrice = price * (1 - Math.min(0.3, surplus / 1e6));
    const subsidy = policy('subsidy') * Math.min(renew, surplus);
    const revenue = surplus * sellPrice + subsidy + P.storage * STORAGE_SPREAD;
    if (revenue > 0) earn(revenue, 'Energy');
    addCO2('⚡ Grid electricity you bought', Math.max(0, demand - self) * GRID_CO2 * (policy('carbon') > 50 ? 0.6 : 1));
    Object.assign(L, { demand, gen, self, sold: surplus, saved, revenue: L.revenue + revenue, renew, price });
    P.last = L;
    P.elecSpend = 0; P.extraMWh = 0;
    P.priceHist.push(price);
    if (P.priceHist.length > 90) P.priceHist.shift();
  },
  tabs: [{ id: 'energy', name: 'Energy', icon: '⚡', render: renderEnergy }],
  actions: {
    buildPlant(t) {
      const d = PLANT_TYPES[t];
      if (d.needsFusion && !PW().fusion.done) return toast('Crack fusion power first (research below).', 'warn');
      if (d.legal && legalPower() < d.legal) return toast(`Nuclear licensing needs legal strength ${d.legal}+.`, 'warn');
      openBusiness({
        title: `a ${d.name}`, icon: d.icon, equipment: d.cost, permit: { name: d.permit[0], cost: d.permit[1] }, rent: d.cost * 0.0003, price: d.cost * 0.15,
        extra: `<p class="small muted">${d.mw} MW · construction takes ${d.build} days.</p>`,
        done(site) { PW().plants.push({ id: uid(), type: t, site, building: d.build, paid: d.cost, outage: 0, ccs: false, cf: d.cf, lastGen: 0 }); log(`🏗️ Construction started on your ${d.name}.`); },
      });
    },
    buildWell(t) {
      const d = EXTRACT_TYPES[t];
      openBusiness({
        title: `a ${d.name}`, icon: d.icon, equipment: d.cost, permit: { name: d.permit[0], cost: d.permit[1] }, rent: d.cost * 0.0004, price: d.cost * 0.2,
        extra: `<p class="small muted">${pct(d.dry, 0)} chance it comes up dry. Production declines as the field depletes.</p>`,
        done(site) { PW().wells.push({ id: uid(), type: t, site, building: d.build, paid: d.cost, left: d.life, dry: false, autoSell: true }); log(`🏗️ Drilling started on your ${d.name}.`); },
      });
    },
    toggleCCS(id) {
      const p = PW().plants.find((x) => x.id === +id), cost = PLANT_TYPES[p.type].cost * CCS_COST;
      if (p.ccs || !pay(cost, 'Investments', 'carbon capture')) return;
      p.ccs = true;
      toast('🫧 Carbon capture installed: −85% emissions, −10% output.', 'good');
    },
    sellPlant(id) {
      const P = PW(), p = P.plants.find((x) => x.id === +id), v = plantValue(p);
      showModal({ title: `Sell your ${PLANT_TYPES[p.type].name}?`, body: `<p>Sale price: <b>${money(v)}</b>.</p>`, buttons: [{ label: `Sell for ${money(v)}`, cls: 'danger', fn: () => { earn(v, 'Investments'); P.plants.splice(P.plants.indexOf(p), 1); } }, { label: 'Cancel' }] });
    },
    toggleWellSell(id) { const w = PW().wells.find((x) => x.id === +id); w.autoSell = !w.autoSell; },
    addStorage(n) {
      n = +n;
      if (S.goods.battery.stock < STORAGE_CELLS * n) return toast(`Needs ${STORAGE_CELLS * n} battery cells in your warehouse (make them in a Battery Plant or buy them).`, 'warn');
      if (!pay(STORAGE_COST * n, 'Investments', 'storage installation')) return;
      S.goods.battery.stock -= STORAGE_CELLS * n;
      PW().storage += n;
      toast(`🔋 Added ${n} MWh of grid storage.`, 'good');
    },
    fusionFund() {
      const F = PW().fusion, st = FUSION_STAGES[F.stage];
      if (F.done || F.left > 0 || !st) return;
      if (!pay(st.cost, 'R&D', st.name)) return;
      F.left = aiCap() >= 60 ? Math.round(st.days / 2) : st.days;
      log(`🔬 Funded fusion research stage: ${st.name} (${F.left} days).`);
    },
  },
});

function renderEnergy() {
  const P = PW(), L = P.last, F = P.fusion;
  const mix = {};
  for (const p of P.plants) mix[p.type] = (mix[p.type] || 0) + (p.lastGen || 0);
  const totGen = Object.values(mix).reduce((a, b) => a + b, 0) || 1;
  const plants = P.plants.map((p) => {
    const t = PLANT_TYPES[p.type];
    return `<div class="card tight"><div class="row between"><b>${t.icon} ${t.name}</b>${p.building > 0 ? `<span class="pill warn">Building ${p.building}d</span>` : p.outage ? `<span class="pill bad">Outage ${p.outage}d</span>` : '<span class="pill good">Online</span>'}</div>
      <div class="small muted">${t.mw} MW · yesterday ${fmtInt(p.lastGen || 0)} MWh (${pct(p.cf || t.cf, 0)} capacity factor)${t.co2 ? ` · ${(t.co2 * (p.ccs ? 0.15 : 1)).toFixed(2)} t CO₂/MWh` : ' · zero emissions'}</div>
      <div class="small">${siteLabel(p.site)}</div>${billsHtml(p.bills)}
      <div class="row" style="margin-top:6px">${t.co2 ? (p.ccs ? '<span class="pill good">🫧 Carbon capture</span>' : btn(`🫧 Carbon capture (${money(t.cost * CCS_COST)})`, 'toggleCCS', p.id, { cls: 'sm' })) : ''}${btn('Sell', 'sellPlant', p.id, { cls: 'sm' })}</div></div>`;
  }).join('');
  const shop = Object.entries(PLANT_TYPES).map(([k, t]) => {
    const locked = (t.needsFusion && !F.done) || (t.legal && legalPower() < t.legal);
    const daily = t.mw * 24 * t.cf * (powerPrice() + (t.renew ? policy('subsidy') : 0)) - t.mw * 24 * t.cf * (t.fuel + t.co2 * policy('carbon')) - t.opex;
    return `<div class="card tight"><b>${t.icon} ${t.name}</b><div class="small muted">${t.mw} MW · ${pct(t.cf, 0)} capacity factor · builds in ${t.build} days · ${t.co2 ? `${t.co2} t CO₂/MWh` : 'zero carbon'}${t.renew ? ' · gets renewable subsidy' : ''}</div>
      <div class="small">Est. profit ~<b class="${cls(daily)}">${signMoney(daily)}/day</b> at today's prices &amp; carbon price</div>
      <div style="margin-top:6px">${locked ? `<span class="pill">🔒 ${t.needsFusion ? 'Needs fusion research' : `Needs legal strength ${t.legal}+`}</span>` : btn(`Build ${money(t.cost + t.permit[1])}+`, 'buildPlant', k, { cls: 'sm buy', disabled: !canAfford(t.cost + t.permit[1]) })}</div></div>`;
  }).join('');
  const wells = P.wells.map((w) => {
    const t = EXTRACT_TYPES[w.type];
    return `<div class="list-item"><span class="big-ico">${t.icon}</span><div class="grow"><b>${t.name}</b><div class="small muted">${w.building > 0 ? `Drilling: ${w.building} days left` : w.dry ? 'Dry hole' : `${pct(w.left / t.life, 0)} of reserves left`}</div></div>
      ${w.type === 'oilwell' && !w.dry ? btn(`Auto-sell oil: ${w.autoSell ? 'ON' : 'OFF'}`, 'toggleWellSell', w.id, { cls: 'sm ' + (w.autoSell ? 'on' : '') }) : ''}</div>`;
  }).join('');
  const st = FUSION_STAGES[F.stage];
  return `<h2 class="section">⚡ Energy</h2>
  <div class="grid g4 section">
    <div class="card kpi"><div class="lbl">Wholesale price</div><div class="val">${money(powerPrice())}/MWh</div>${chart('pwr', P.priceHist, 40, { color: '#ffd23f' })}</div>
    <div class="card kpi"><div class="lbl">Generated yesterday</div><div class="val">${fmtInt(L.gen)} MWh</div><div class="small muted">${pct((L.renew || 0) / (L.gen || 1), 0)} renewable</div></div>
    <div class="card kpi"><div class="lbl">Your businesses used</div><div class="val">${fmtInt(L.demand)} MWh</div><div class="small muted">${pct(L.demand ? L.self / L.demand : 0, 0)} from your own plants · saved ${money(L.saved)}</div></div>
    <div class="card kpi"><div class="lbl">Sold to the grid</div><div class="val good">${money(L.revenue)}</div><div class="small muted">${fmtInt(L.sold)} MWh · fuel ${money(L.fuel)}</div></div>
  </div>
  ${P.plants.length ? `<div class="card section"><h3>Generation mix</h3>${Object.entries(mix).map(([k, v]) => `<div class="barline" style="grid-template-columns:150px 1fr 90px"><span>${PLANT_TYPES[k].icon} ${PLANT_TYPES[k].name}</span>${bar(v / totGen * 100, PLANT_TYPES[k].renew ? 'var(--good)' : 'var(--warn)')}<span class="num right">${fmtInt(v)} MWh</span></div>`).join('')}</div>
  <div class="grid g3 section">${plants}</div>` : '<div class="banner info">Your own power plants supply your businesses first (saving the retail price), and the surplus is sold to the grid. Renewables earn the government subsidy, and fossil plants pay the carbon price.</div>'}
  <h4>Build a power plant</h4><div class="grid g3 section">${shop}</div>
  <div class="grid g3">
    <div class="card"><h3>🛢️ Oil &amp; gas</h3><p class="small muted">Oil wells fill your warehouse with crude for your refineries. Gas fields fuel your gas plants for free, and the surplus is sold.</p>
      ${wells}${Object.entries(EXTRACT_TYPES).map(([k, t]) => `<div class="row" style="margin-top:6px">${btn(`${t.icon} Drill ${t.name} (${money(t.cost + t.permit[1])}+)`, 'buildWell', k, { cls: 'sm buy', disabled: !canAfford(t.cost + t.permit[1]) })}</div>`).join('')}</div>
    <div class="card"><h3>🔋 Grid storage: ${fmtInt(P.storage)} MWh</h3><p class="small muted">Store cheap power and sell it at peak: earns ~${money(STORAGE_SPREAD)}/MWh/day. Each MWh uses ${STORAGE_CELLS} of your battery cells (you have ${fmtInt(S.goods.battery.stock)}) + ${money(STORAGE_COST)} installation.</p>
      <div class="row">${[1, 10, 100].map((n) => btn(`+${n} MWh`, 'addStorage', n, { cls: 'sm buy', disabled: S.goods.battery.stock < STORAGE_CELLS * n })).join('')}</div></div>
    <div class="card"><h3>🌟 Fusion research</h3>${F.done ? '<p class="good">Fusion achieved! Build reactors above.</p>' : `<p class="small muted">Three risky stages (75% success each).${aiCap() >= 60 ? ' Your AI halves the research time.' : ' An AI with capability 60+ would halve the research time.'}</p>
      ${FUSION_STAGES.map((s, i) => `<div class="small">${i < F.stage ? '✅' : i === F.stage ? '👉' : '⬜'} ${s.name} · ${money(s.cost)}</div>`).join('')}
      ${F.left > 0 ? `<p class="warn small">Researching: ${F.left} days left</p>` : btn(`Fund "${st.name}" (${money(st.cost)})`, 'fusionFund', '', { cls: 'sm primary', disabled: !canAfford(st.cost) })}`}</div>
  </div>`;
}
